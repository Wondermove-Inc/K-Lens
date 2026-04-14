/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 *
 * Custom Skill IPC Channels
 * Renderer ↔ Main 간 커스텀 스킬 관리 통신 채널
 */

import { getRequestChannel } from "@skuberplus/messaging";

// ============================================
// Types
// ============================================

export interface CustomSkillInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  content: string;
}

// ============================================
// Request / Response
// ============================================

export type CustomSkillRequest =
  | { type: "list" }
  | { type: "get"; id: string }
  | { type: "save"; id: string; name: string; description: string; content: string; enabled?: boolean }
  | { type: "delete"; id: string }
  | { type: "toggle"; id: string; enabled: boolean };

export type CustomSkillResponse =
  | { type: "list"; skills: CustomSkillInfo[]; maxSkills: number }
  | { type: "get"; skill: CustomSkillInfo }
  | { type: "saved"; success: boolean }
  | { type: "deleted"; success: boolean }
  | { type: "toggled"; success: boolean }
  | { type: "error"; error: string };

// ============================================
// Channel
// ============================================

export const customSkillChannel = getRequestChannel<CustomSkillRequest, CustomSkillResponse>(
  "ai-assistant:custom-skill",
);
