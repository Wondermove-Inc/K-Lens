/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 유저 프로필 IPC 채널 정의
 *
 * Renderer ↔ Main 간 유저 프로필 관련 통신 채널입니다.
 * - 프로필 조회
 * - 피드백 전송
 * - 프로필 리셋
 *
 * @packageDocumentation
 *
 * 🔄 변경이력:
 * - 2026-03-19: 초기 생성
 */

import { getRequestChannel } from "@skuberplus/messaging";

import type { FeedbackEntry, UserProfile } from "./user-profile-types";

// ============================================
// 🎯 요청/응답 타입
// ============================================

export type UserProfileRequest =
  | { type: "get-profile" }
  | { type: "get-profile-md" }
  | { type: "update-profile-md"; content: string }
  | { type: "add-feedback"; feedback: FeedbackEntry }
  | { type: "reset-profile" }
  | { type: "set-auto-learn"; enabled: boolean }
  | { type: "set-language"; language: string | null }
  | { type: "set-workspace-learning"; enabled: boolean }
  | { type: "set-auto-approval-rules"; rules: string[] };

export type UserProfileResponse =
  | { type: "profile"; profile: UserProfile }
  | { type: "profile-md"; content: string }
  | { type: "profile-md-updated"; success: boolean }
  | { type: "feedback-added"; success: boolean }
  | { type: "profile-reset"; success: boolean }
  | { type: "setting-updated"; success: boolean };

// ============================================
// 🎯 IPC 채널
// ============================================

export const userProfileChannel = getRequestChannel<UserProfileRequest, UserProfileResponse>(
  "ai-assistant:user-profile",
);
