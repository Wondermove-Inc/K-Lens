/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Compact Summarizer
 *
 * Replaces old messages with an LLM-generated summary to manage context window.
 * 2-stage strategy:
 *   Stage 1 (this file): "Soft compact" — summarize old messages when tokens > 60% of limit
 *   Stage 2 (message-trimmer.ts): "Hard trim" — delete old messages as safety net
 *
 * If soft compact succeeds, hard trim typically won't trigger (tokens already reduced).
 * If soft compact fails, hard trim acts as fallback.
 */

import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { estimateTotalTokens, PROVIDER_TOKEN_LIMITS } from "./message-trimmer";

import type { Logger } from "@skuberplus/logger";

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import type { AIProvider } from "../../../../../common/features/user-preferences/encrypt-api-key-channel";

// ============================================
// Configuration
// ============================================

/** Compact triggers when token usage exceeds this ratio of the provider limit */
const COMPACT_THRESHOLD_RATIO = 0.6;

/** Minimum messages to summarize (not worth compacting 1-2 messages) */
const MIN_MESSAGES_TO_SUMMARIZE = 4;

// ============================================
// Types
// ============================================

export interface CompactOptions {
  provider: AIProvider;
  /** The main model — used as-is for summarization (no light model needed) */
  model: BaseChatModel;
  /** Number of recent messages to preserve verbatim (default: 8) */
  preserveRecentCount?: number;
  /** Override token limit (default: from PROVIDER_TOKEN_LIMITS) */
  tokenLimit?: number;
  logger: Logger;
}

export interface CompactResult {
  /** The compacted message array */
  messages: BaseMessage[];
  /** Whether compaction was performed */
  wasCompacted: boolean;
  /** Number of messages that were summarized */
  summarizedCount: number;
  /** Estimated tokens saved */
  estimatedTokensSaved: number;
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Compact old messages by summarizing them with the LLM.
 *
 * Message structure after compaction:
 *   [SystemMessage, InitialHumanMessage, CompactSummary, ...RecentMessages]
 *
 * The summary is wrapped in a HumanMessage to maintain valid message alternation
 * for the Anthropic API (no consecutive assistant messages).
 */
export async function compactMessages(messages: BaseMessage[], options: CompactOptions): Promise<CompactResult> {
  const { provider, model, preserveRecentCount = 8, logger } = options;

  const tokenLimit = options.tokenLimit ?? PROVIDER_TOKEN_LIMITS[provider] ?? 108_000;
  const compactThreshold = Math.floor(tokenLimit * COMPACT_THRESHOLD_RATIO);

  // Check if compaction is needed
  const currentTokens = estimateTotalTokens(messages);
  if (currentTokens <= compactThreshold) {
    return { messages, wasCompacted: false, summarizedCount: 0, estimatedTokensSaved: 0 };
  }

  // Segment messages into: system, initial request, summarize target, recent
  const segments = segmentMessages(messages, preserveRecentCount);

  if (segments.toSummarize.length < MIN_MESSAGES_TO_SUMMARIZE) {
    return { messages, wasCompacted: false, summarizedCount: 0, estimatedTokensSaved: 0 };
  }

  logger.info("[Compact] Starting soft compact", {
    currentTokens,
    threshold: compactThreshold,
    toSummarize: segments.toSummarize.length,
    toPreserve: segments.recent.length,
  });

  // Generate summary
  const summaryText = await generateSummary(model, segments.toSummarize, logger);

  // Build compacted message array
  const compactedMessages: BaseMessage[] = [
    ...segments.system,
    ...segments.initialRequest,
    new HumanMessage({
      content: `[Conversation Summary — ${segments.toSummarize.length} messages compacted]\n\n${summaryText}\n\n[End of Summary — Continue from here]`,
    }),
    // Add a brief AI acknowledgment to maintain valid message alternation
    new AIMessage({
      content: "Understood. I have the conversation context from the summary above. Continuing.",
    }),
    ...segments.recent,
  ];

  const newTokens = estimateTotalTokens(compactedMessages);
  const tokensSaved = currentTokens - newTokens;

  logger.info("[Compact] Soft compact completed", {
    summarizedMessages: segments.toSummarize.length,
    tokensBefore: currentTokens,
    tokensAfter: newTokens,
    tokensSaved,
  });

  return {
    messages: compactedMessages,
    wasCompacted: true,
    summarizedCount: segments.toSummarize.length,
    estimatedTokensSaved: tokensSaved,
  };
}

// ============================================
// Message Segmentation
// ============================================

interface MessageSegments {
  /** System messages (always preserved) */
  system: SystemMessage[];
  /** First HumanMessage — the user's original request (always preserved) */
  initialRequest: BaseMessage[];
  /** Messages to be summarized (old middle section) */
  toSummarize: BaseMessage[];
  /** Recent messages to preserve verbatim */
  recent: BaseMessage[];
}

function segmentMessages(messages: BaseMessage[], preserveRecentCount: number): MessageSegments {
  const system: SystemMessage[] = [];
  const nonSystem: BaseMessage[] = [];

  for (const msg of messages) {
    if (msg instanceof SystemMessage) {
      system.push(msg);
    } else {
      nonSystem.push(msg);
    }
  }

  // Find initial HumanMessage (user's first request)
  const initialRequest: BaseMessage[] = [];
  let startIdx = 0;
  if (nonSystem.length > 0 && nonSystem[0]._getType() === "human") {
    initialRequest.push(nonSystem[0]);
    startIdx = 1;
  }

  // Split remaining into "to summarize" and "recent"
  const remaining = nonSystem.slice(startIdx);
  const splitPoint = Math.max(0, remaining.length - preserveRecentCount);

  // Adjust split point to not break tool_call/ToolMessage pairs
  const adjustedSplit = adjustSplitForToolPairs(remaining, splitPoint);

  return {
    system,
    initialRequest,
    toSummarize: remaining.slice(0, adjustedSplit),
    recent: remaining.slice(adjustedSplit),
  };
}

/**
 * Adjust the split point so we don't break AIMessage(tool_calls) / ToolMessage pairs.
 * If the split would land in the middle of a tool call/result pair, move it earlier.
 */
function adjustSplitForToolPairs(messages: BaseMessage[], splitPoint: number): number {
  if (splitPoint <= 0 || splitPoint >= messages.length) return splitPoint;

  // Look at the message right after the split — if it's a ToolMessage, include its AIMessage
  let adjusted = splitPoint;

  // Walk backward from split point to find a safe boundary
  while (adjusted > 0) {
    const msg = messages[adjusted];
    if (msg instanceof ToolMessage || msg._getType() === "tool") {
      // This ToolMessage's AIMessage must be before it — move split earlier
      adjusted--;
    } else {
      break;
    }
  }

  return adjusted;
}

// ============================================
// Summary Generation
// ============================================

const COMPACT_SYSTEM_PROMPT = `You are a conversation summarizer for a Kubernetes operations assistant.
Your task is to create a concise but thorough summary of the conversation history.

CRITICAL RULES:
- Respond with TEXT ONLY. Do NOT call any tools.
- Do NOT use any tool_use blocks.
- Keep the summary focused and structured.

Preserve these details:
1. **User Request**: The user's original intent and specific questions
2. **Resources**: Cluster names, namespaces, pod/deployment/service names mentioned
3. **Findings**: Diagnostic results — errors, warnings, unhealthy resources, metrics
4. **Actions Taken**: kubectl commands executed, files saved, configurations changed
5. **Tool Results**: Key outputs from tool calls (summarize, don't include raw output)
6. **Pending Work**: Unresolved issues, next steps discussed but not yet executed
7. **Decisions**: User approvals, rejections, or preferences expressed

Format the summary with clear sections and bullet points.`;

async function generateSummary(
  model: BaseChatModel,
  messagesToSummarize: BaseMessage[],
  logger: Logger,
): Promise<string> {
  // Convert messages to readable text for the summarization prompt
  const conversationText = messagesToText(messagesToSummarize);

  const summaryMessages: BaseMessage[] = [
    new SystemMessage(COMPACT_SYSTEM_PROMPT),
    new HumanMessage(`Please summarize the following conversation:\n\n${conversationText}`),
  ];

  // Call model WITHOUT tool bindings to prevent tool calls in summary
  const baseModel =
    "bind" in model && typeof (model as any).bind === "function" ? (model as any).bind({ tools: undefined }) : model;

  const response = await baseModel.invoke(summaryMessages);

  const content =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? response.content
            .filter((b: any) => b?.type === "text")
            .map((b: any) => b.text)
            .join("")
        : String(response.content);

  if (!content || content.trim().length === 0) {
    throw new Error("Empty summary generated");
  }

  logger.info("[Compact] Summary generated", {
    inputMessages: messagesToSummarize.length,
    summaryLength: content.length,
  });

  return content.trim();
}

/**
 * Convert messages to human-readable text for the summarization prompt.
 * Tool calls and results are formatted as readable text.
 */
function messagesToText(messages: BaseMessage[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    const type = msg._getType();

    if (type === "human") {
      const text = extractText(msg.content);
      if (text) lines.push(`User: ${text}`);
    } else if (type === "ai") {
      const text = extractText(msg.content);
      const toolCalls = (msg as AIMessage).tool_calls ?? [];

      if (text) lines.push(`Assistant: ${text}`);

      for (const tc of toolCalls) {
        const argsStr = tc.args ? JSON.stringify(tc.args).slice(0, 200) : "";
        lines.push(`  → Tool call: ${tc.name}(${argsStr})`);
      }
    } else if (type === "tool") {
      const toolMsg = msg as ToolMessage;
      const name = toolMsg.name ?? "unknown";
      const content = extractText(toolMsg.content);
      // Truncate large tool results for the summary prompt
      const truncated = content.length > 500 ? content.slice(0, 500) + "... [truncated]" : content;
      lines.push(`  ← Tool result (${name}): ${truncated}`);
    }
  }

  return lines.join("\n");
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b?.type === "text" && typeof b?.text === "string")
      .map((b: any) => b.text)
      .join("");
  }
  return String(content ?? "");
}
