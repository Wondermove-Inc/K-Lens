/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Skill Registry IPC Channels
 *
 * IPC channels for skill CRUD operations between Renderer and Main Process.
 * Used by the Skills settings tab in Preferences Dialog.
 */

import { getRequestChannel } from "@skuberplus/messaging";

import type { SkillDefinition } from "../main/skills/skill-registry";

// ============================================
// Request/Response types
// ============================================

/** List all skills (including disabled) */
export interface SkillListRequest {
  type: "list";
}

export interface SkillListResponse {
  success: boolean;
  skills: SkillDefinition[];
  error?: string;
}

/** Save (create or update) a skill */
export interface SkillSaveRequest {
  type: "save";
  skill: SkillDefinition;
}

export interface SkillSaveResponse {
  success: boolean;
  error?: string;
}

/** Delete a user-defined skill */
export interface SkillDeleteRequest {
  type: "delete";
  skillId: string;
}

export interface SkillDeleteResponse {
  success: boolean;
  error?: string;
}

/** Reset a built-in skill to its default */
export interface SkillResetRequest {
  type: "reset";
  skillId: string;
}

export interface SkillResetResponse {
  success: boolean;
  error?: string;
}

/** Get the effective MD content for a skill (user override or bundled default) */
export interface SkillGetContentRequest {
  type: "get-content";
  skillId: string;
}

export interface SkillGetContentResponse {
  success: boolean;
  content?: string;
  isOverridden?: boolean;
  error?: string;
}

/** Save MD content for a built-in skill (user override) */
export interface SkillSaveContentRequest {
  type: "save-content";
  skillId: string;
  content: string;
}

export interface SkillSaveContentResponse {
  success: boolean;
  error?: string;
}

/** Union request type */
export type SkillRegistryRequest =
  | SkillListRequest
  | SkillSaveRequest
  | SkillDeleteRequest
  | SkillResetRequest
  | SkillGetContentRequest
  | SkillSaveContentRequest;

/** Union response type */
export type SkillRegistryResponse =
  | SkillListResponse
  | SkillSaveResponse
  | SkillDeleteResponse
  | SkillResetResponse
  | SkillGetContentResponse
  | SkillSaveContentResponse;

// ============================================
// IPC Channel
// ============================================

export const skillRegistryChannel = getRequestChannel<SkillRegistryRequest, SkillRegistryResponse>(
  "ai-assistant:skill-registry",
);
