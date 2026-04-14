/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Agent Registry IPC Channels
 *
 * IPC channels for agent CRUD operations between Renderer and Main Process.
 * Used by the Agents settings tab in Preferences Dialog.
 */

import { getRequestChannel } from "@skuberplus/messaging";

import type { AgentDefinition } from "../main/agent/agent-registry";

// ============================================
// Request/Response types
// ============================================

/** List all agents (including disabled) */
export interface AgentListRequest {
  type: "list";
}

export interface AgentListResponse {
  success: boolean;
  agents: AgentDefinition[];
  error?: string;
}

/** Save (create or update) an agent */
export interface AgentSaveRequest {
  type: "save";
  agent: AgentDefinition;
}

export interface AgentSaveResponse {
  success: boolean;
  error?: string;
}

/** Delete a user-defined agent */
export interface AgentDeleteRequest {
  type: "delete";
  agentId: string;
}

export interface AgentDeleteResponse {
  success: boolean;
  error?: string;
}

/** Reset a built-in agent to its default */
export interface AgentResetRequest {
  type: "reset";
  agentId: string;
}

export interface AgentResetResponse {
  success: boolean;
  error?: string;
}

/** Get available tool names (for UI tool selection) */
export interface AgentGetToolNamesRequest {
  type: "get-tool-names";
}

export interface AgentGetToolNamesResponse {
  success: boolean;
  toolNames: string[];
}

/** Union request type */
export type AgentRegistryRequest =
  | AgentListRequest
  | AgentSaveRequest
  | AgentDeleteRequest
  | AgentResetRequest
  | AgentGetToolNamesRequest;

/** Union response type */
export type AgentRegistryResponse =
  | AgentListResponse
  | AgentSaveResponse
  | AgentDeleteResponse
  | AgentResetResponse
  | AgentGetToolNamesResponse;

// ============================================
// IPC Channel
// ============================================

export const agentRegistryChannel = getRequestChannel<AgentRegistryRequest, AgentRegistryResponse>(
  "ai-assistant:agent-registry",
);
