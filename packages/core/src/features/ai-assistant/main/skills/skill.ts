/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Skill Layer Interface Definitions
 *
 * Skills encapsulate slash command workflows so that react-loop.ts
 * stays a pure ReAct engine. Each skill owns its own prompts,
 * execution strategy, and post-processing.
 */

import type { Logger } from "@skuberplus/logger";

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

import type { AIProvider } from "../../../../common/features/user-preferences/encrypt-api-key-channel";
import type { AgentContext, AgentStreamEvent } from "../../common/agent-ipc-channels";
import type { AgentRegistry } from "../agent/agent-registry";
import type { HitlLevel } from "../agent/main-tools";
import type { ConversationLogger } from "../conversation-logger";
import type { AgentSessionManager } from "../session/agent-session-manager";

// ============================================
// Skill Context — everything a skill needs to execute
// ============================================

export interface SkillContext {
  threadId: string;
  userMessage: string;
  assistantMessageId: string;
  model: BaseChatModel;
  tools: StructuredToolInterface[];
  context: AgentContext;
  provider: AIProvider;
  // Infrastructure
  logger: Logger;
  sessionManager: AgentSessionManager;
  conversationLogger: ConversationLogger;
  agentRegistry: AgentRegistry;
  emitStreamEvent: (event: AgentStreamEvent) => void;
  getHitlLevel: () => HitlLevel;
  onInterrupt?: () => void;
  getAutoApprovalRules?: () => Promise<string[]>;
  existingMessages?: BaseMessage[];
  maxIterations?: number;
}

// ============================================
// Skill Result
// ============================================

export interface SkillResult {
  content: string;
  messages: BaseMessage[];
}

// ============================================
// Skill Manifest — metadata for routing and UI
// ============================================

export interface SkillManifest {
  /** Matches slash command name without "/" (e.g. "assess", "diagnose") */
  id: string;
  name: string;
  description: string;
  category: string;
}

// ============================================
// Skill Interface
// ============================================

export interface Skill {
  readonly manifest: SkillManifest;
  execute(ctx: SkillContext): Promise<SkillResult>;
}
