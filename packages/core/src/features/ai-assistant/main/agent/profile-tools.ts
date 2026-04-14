/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI 프로필 편집 Tools
 *
 * AI가 채팅 중 사용자 프로필(user-profile.md)을 읽고 편집할 수 있는 도구.
 * 사용자가 "내 프로필 수정해줘"라고 하면 AI가 이 도구로 처리합니다.
 *
 * @packageDocumentation
 *
 * 🔄 변경이력:
 * - 2026-03-24: 초기 생성
 * - 2026-03-31: — edit_user_profile에 메모리 형식 가이드 추가
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { UserProfileStore } from "../user-profile/user-profile-store";

// ============================================
// 🎯 Profile Tools Factory
// ============================================

export interface ProfileToolsDependencies {
  userProfileStore: UserProfileStore;
}

export function createProfileTools(deps: ProfileToolsDependencies) {
  const { userProfileStore } = deps;

  const readProfileTool = tool(
    async () => {
      try {
        const md = await userProfileStore.getProfileMd();

        return md;
      } catch (error) {
        return `Error reading profile: ${error}`;
      }
    },
    {
      name: "read_user_profile",
      description:
        "Read the user's personalization profile (user-profile.md). " +
        "Use this when the user asks to see their profile, check what the AI has learned about them, " +
        "or before editing the profile to see current content.",
      schema: z.object({}),
    },
  );

  const editProfileTool = tool(
    async ({ content }: { content: string }) => {
      try {
        await userProfileStore.updateProfileMd(content);

        return "Profile updated successfully.";
      } catch (error) {
        return `Error updating profile: ${error}`;
      }
    },
    {
      name: "edit_user_profile",
      description:
        "Edit the user's personalization profile (user-profile.md). " +
        "Use this when the user asks to modify, add, or remove items from their profile. " +
        "IMPORTANT: Always read_user_profile first to get current content, " +
        "then modify only the requested parts and pass the full updated markdown.\n\n" +
        "FORMAT RULES for ## Memories section — each line MUST follow this exact format:\n" +
        "- [category] fact → action\n" +
        "- [category:topic] fact → action  (for environment category with topic)\n\n" +
        "Categories: preference | environment | behavior\n" +
        "- preference: Output format, style, language choices. Applied always.\n" +
        "- environment: Tech stack, infrastructure. Applied only when topic matches. MUST include topic.\n" +
        "- behavior: Interaction patterns. Applied as reference only.\n\n" +
        "The → action part is CRITICAL — it must be a specific, actionable instruction for the AI, " +
        "not just a restatement of the fact.\n" +
        "GOOD: - [preference] Prefers YAML → Provide all config/code examples in YAML only. No JSON.\n" +
        "BAD:  - [preference] Prefers YAML → Use YAML  (too vague)\n" +
        "BAD:  - Prefers YAML output  (missing [category] and → action)\n\n" +
        "Do NOT change the ## Memories header. Do NOT change ## Feedback or other sections — only modify ## Memories entries.",
      schema: z.object({
        content: z
          .string()
          .describe(
            "The full updated markdown content for user-profile.md. " +
              "Each memory line in ## Memories must use: - [category] fact → action format.",
          ),
      }),
    },
  );

  return [readProfileTool, editProfileTool];
}
