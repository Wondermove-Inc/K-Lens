/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * ReAct Loop Engine
 *
 * Replaces LangGraph createReactAgent + StateGraph with a simple
 * while-loop ReAct agent. Core loop:
 *
 * while (iterations < maxIterations) {
 *   1. model.bindTools(tools).stream(messages) → token streaming
 *   2. No tool_calls → done
 *   3. tool_calls found:
 *      a. Check isWriteOperation via metadata
 *      b. Destructive → HITL Promise → emit interrupt → await
 *      c. Approved → execute tool → add ToolMessage
 *      d. Rejected → add rejection ToolMessage
 *   4. Append AIMessage + ToolMessages to messages
 *   5. Repeat
 * }
 *
 * HITL: Promise-based instead of LangGraph interrupt().
 * Streaming: model.bindTools(tools).stream() → AIMessageChunk
 */

import crypto from "node:crypto";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { ToolApprovalType, type ToolApprovalWithDiff } from "../../common/tool-approval-types";
import { getToolApprovalInfo, isToolConcurrencySafe } from "./react-tools";
import { compactMessages } from "./utils/compact-summarizer";
import { PROVIDER_TOKEN_LIMITS, trimMessages } from "./utils/message-trimmer";
import { createCachedSystemMessage } from "./utils/prefix-cache-helper";
import { processToolResult } from "./utils/tool-result-processor";

import type { Logger } from "@skuberplus/logger";

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { StructuredToolInterface } from "@langchain/core/tools";

import type { AIProvider } from "../../../../common/features/user-preferences/encrypt-api-key-channel";
import type { AgentContext, AgentStreamEvent } from "../../common/agent-ipc-channels";
import type { HitlLevel } from "../agent/main-tools";
import type { AgentSessionManager } from "../session/agent-session-manager";

// ============================================
// Types
// ============================================

/** Pending HITL approval stored on the session */
export interface PendingHITL {
  resolve: (approved: boolean) => void;
  toolName: string;
  toolInput: Record<string, unknown>;
  approval?: ToolApprovalWithDiff;
}

export interface ReactLoopSession {
  threadId: string;
  messages: BaseMessage[];
  pendingHitl?: PendingHITL;
}

export interface ReactLoopDependencies {
  logger: Logger;
  sessionManager: AgentSessionManager;
  emitStreamEvent: (event: AgentStreamEvent) => void;
  /** Get or set the HITL level */
  getHitlLevel: () => HitlLevel;
  /** Called when entering interrupt state (for session status sync) */
  onInterrupt?: () => void;
  /** Get user-configured auto-approval rules (read live from profile store) */
  getAutoApprovalRules?: () => Promise<string[]>;
}

export interface ReactLoopOptions {
  threadId: string;
  model: BaseChatModel;
  tools: StructuredToolInterface[];
  systemPrompt: string;
  userMessage: string;
  assistantMessageId: string;
  context: AgentContext;
  provider: AIProvider;
  maxIterations?: number;
  existingMessages?: BaseMessage[];
  /** When true, skip emitting message-complete event (used by multi-phase skills like /assess) */
  suppressMessageComplete?: boolean;
}

// ============================================
// Message Sanitization
// ============================================

/**
 * Merge consecutive messages with the same role to prevent Anthropic API 400 errors.
 * Anthropic API rejects consecutive messages with the same role (e.g., two "assistant" messages in a row).
 * This can happen when ensureToolMessagePairs strips tool_calls from AIMessages during trimming.
 */
function mergeConsecutiveSameRole(messages: BaseMessage[]): BaseMessage[] {
  if (messages.length <= 1) return messages;

  const result: BaseMessage[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prev = result[result.length - 1];
    const curr = messages[i];

    // Only merge if both are same role AND neither has tool_calls/tool_call_id
    if (
      prev._getType() === curr._getType() &&
      !(prev as any).tool_calls?.length &&
      !(curr as any).tool_calls?.length &&
      !(prev as any).tool_call_id &&
      !(curr as any).tool_call_id
    ) {
      // Merge content into previous message
      const prevText = extractTextFromContent(prev.content);
      const currText = extractTextFromContent(curr.content);
      const merged = new AIMessage({ content: `${prevText}\n\n${currText}` });
      result[result.length - 1] = merged;
    } else {
      result.push(curr);
    }
  }

  return result;
}

/**
 * Sanitize AIMessage to prevent tool_use/tool_result pairing errors in Anthropic API calls.
 *
 * Problem: Anthropic streaming produces AIMessage with BOTH:
 *   - content: [{type:"text",...}, {type:"tool_use", id:"xxx",...}]  (raw response array)
 *   - tool_calls: [{id:"xxx", name:"...", args:{...}}]               (parsed by LangChain)
 *
 * LangChain only uses `tool_calls` to generate tool_use blocks when content is a STRING.
 * If content is an array, LangChain ignores tool_calls entirely, and the tool_use blocks
 * from the original content array may be stripped or mishandled → 400 error:
 * "unexpected tool_use_id found in tool_result blocks"
 *
 * Fix: When tool_calls exist, convert content to a string (extract text only).
 * LangChain will then use tool_calls to generate proper tool_use blocks.
 */
function sanitizeAIMessage(msg: AIMessage): AIMessage {
  const toolCalls = msg.tool_calls ?? [];
  if (toolCalls.length === 0) return msg;

  // Convert array content to string so LangChain uses tool_calls for tool_use generation
  let textContent: string;
  if (Array.isArray(msg.content)) {
    // Extract only text blocks, discard tool_use blocks
    textContent = msg.content
      .filter((block: any) => block?.type === "text" && typeof block?.text === "string")
      .map((block: any) => block.text)
      .join("");
  } else if (typeof msg.content === "string") {
    textContent = msg.content;
  } else {
    textContent = "";
  }

  return new AIMessage({
    content: textContent,
    tool_calls: toolCalls,
    additional_kwargs: msg.additional_kwargs,
    response_metadata: msg.response_metadata,
    id: msg.id,
  });
}

// ============================================
// Content Extraction Helpers
// ============================================

/**
 * Extract text content from LLM chunk (handles OpenAI string and Anthropic array formats)
 */
function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block?.type === "text" && typeof block?.text === "string")
      .map((block: any) => block.text)
      .join("");
  }
  return "";
}

/**
 * Filter Gemini fake tool call text patterns
 */
function filterGeminiToolCallText(chunk: string): string {
  if (!chunk) return chunk;
  let result = chunk;
  result = result.replace(/Tool Call:\s*\{[^}]*\}/gi, "");
  result = result.replace(/\{[^{}]*"(?:tool_code|executable_code|code_execution)"[^{}]*\}/gi, "");
  result = result.replace(new RegExp(`^\\s*print\\s*\\(\\s*\\w+\\s*\\(\\s*\\)\\s*\\)\\s*$`, "gim"), "");
  return result;
}

/**
 * Reverse structured query tool calls to kubectl equivalent for display.
 */
function reverseToKubectl(toolName: string, p: Record<string, unknown>): string | null {
  const ns = typeof p.namespace === "string" ? ` -n ${p.namespace}` : "";
  const allNs = p.allNamespaces === true ? " --all-namespaces" : "";
  const nsFlag = allNs || ns;

  switch (toolName) {
    case "getPods": {
      const label = typeof p.labelSelector === "string" ? ` -l ${p.labelSelector}` : "";
      return `kubectl get pods${nsFlag}${label}`;
    }
    case "getDeployments":
      return `kubectl get deployments${nsFlag}`;
    case "getServices":
      return `kubectl get services${nsFlag}`;
    case "getNodes":
      return "kubectl get nodes";
    case "getNamespaces":
      return "kubectl get namespaces";
    case "getLogs": {
      const pod = typeof p.podName === "string" ? ` ${p.podName}` : "";
      const container = typeof p.container === "string" ? ` -c ${p.container}` : "";
      const tail = typeof p.tailLines === "number" ? ` --tail=${p.tailLines}` : "";
      const since = typeof p.since === "string" ? ` --since=${p.since}` : "";
      return `kubectl logs${pod}${ns}${container}${tail}${since}`;
    }
    case "describeResource": {
      const type = typeof p.resourceType === "string" ? p.resourceType : "";
      const name = typeof p.resourceName === "string" ? ` ${p.resourceName}` : "";
      return `kubectl describe ${type}${name}${ns}`;
    }
    default:
      return null;
  }
}

/**
 * Format interrupt payload for display
 */
function formatRequestString(toolName: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return payload ? String(payload) : "";
  }
  const p = payload as Record<string, unknown>;

  // kubectl: command + args format
  if (typeof p.command === "string" && Array.isArray(p.args)) {
    const prefix = toolName === "helm" ? "helm" : "kubectl";
    const cmd = `${prefix} ${p.command} ${(p.args as string[]).join(" ")}`;
    return p.stdin ? `${cmd}\n\n(YAML content below)` : cmd;
  }

  // helm: subcommand + args string format
  if (toolName === "helm" && typeof p.command === "string") {
    const args = typeof p.args === "string" ? p.args : "";
    return `helm ${p.command} ${args}`.trim();
  }

  // shell: command string
  if (toolName === "shell" && typeof p.command === "string") {
    return `$ ${p.command}`;
  }

  // File tools: filename-based
  if (typeof p.filename === "string") {
    const folder = typeof p.folderType === "string" ? `[${p.folderType}] ` : "";
    return `${toolName}: ${folder}${p.filename}`;
  }

  // Structured query tools → reverse to kubectl equivalent
  const kubectlReverse = reverseToKubectl(toolName, p);
  if (kubectlReverse) return kubectlReverse;

  // Fallback: show tool name + compact JSON (skip empty objects)
  const json = JSON.stringify(payload);
  return json === "{}" ? toolName : `${toolName}: ${json}`;
}

// ============================================
// Thinking Filter
// ============================================

class ThinkingFilter {
  private buffer = "";
  private isInside = false;
  private placeholderSent = false;

  reset(): void {
    this.buffer = "";
    this.isInside = false;
    this.placeholderSent = false;
  }

  filter(chunk: string): string {
    const openPatterns = ["<think>", "<thinking>", "<reasoning>"];
    const closePatterns = ["</think>", "</thinking>", "</reasoning>"];
    const PLACEHOLDER = "\u200B";

    let result = "";
    let buf = this.buffer + chunk;
    this.buffer = "";

    while (buf.length > 0) {
      if (this.isInside) {
        let found = false;
        for (const pattern of closePatterns) {
          const idx = buf.toLowerCase().indexOf(pattern.toLowerCase());
          if (idx !== -1) {
            buf = buf.slice(idx + pattern.length);
            this.isInside = false;
            found = true;
            break;
          }
        }
        if (!found) {
          this.buffer = buf;
          break;
        }
      } else {
        let minIdx = -1;
        let matchedLen = 0;
        for (const pattern of openPatterns) {
          const idx = buf.toLowerCase().indexOf(pattern.toLowerCase());
          if (idx !== -1 && (minIdx === -1 || idx < minIdx)) {
            minIdx = idx;
            matchedLen = pattern.length;
          }
        }
        if (minIdx !== -1) {
          result += buf.slice(0, minIdx);
          buf = buf.slice(minIdx + matchedLen);
          this.isInside = true;
          if (!this.placeholderSent) {
            result += PLACEHOLDER;
            this.placeholderSent = true;
          }
        } else {
          result += buf;
          break;
        }
      }
    }

    return result;
  }
}

// ============================================
// Chunk Buffering (IPC batching)
// ============================================

class ChunkBuffer {
  private buffers = new Map<string, string>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private readonly flushMs = 50;
  private readonly maxSize = 100;

  constructor(private readonly emit: (event: AgentStreamEvent) => void) {}

  start(messageId: string): void {
    this.stop(messageId);
    this.buffers.set(messageId, "");
    const id = setInterval(() => this.flush(messageId), this.flushMs);
    this.intervals.set(messageId, id);
  }

  add(chunk: string, messageId: string): void {
    const current = this.buffers.get(messageId) ?? "";
    const updated = current + chunk;
    this.buffers.set(messageId, updated);
    if (updated.length >= this.maxSize) this.flush(messageId);
  }

  flush(messageId: string): void {
    const buf = this.buffers.get(messageId);
    if (buf && buf.length > 0) {
      this.emit({ type: "message-chunk", chunk: buf, messageId });
      this.buffers.set(messageId, "");
    }
  }

  stop(messageId: string): void {
    const id = this.intervals.get(messageId);
    if (id) {
      clearInterval(id);
      this.intervals.delete(messageId);
    }
    this.flush(messageId);
    this.buffers.delete(messageId);
  }
}

// ============================================
// ReAct Loop
// ============================================

/**
 * Run the ReAct loop agent.
 *
 * This is the main entry point replacing LangGraph's createReactAgent.
 * Returns the final assistant content and the full message history.
 */
export async function runReactLoop(
  deps: ReactLoopDependencies,
  opts: ReactLoopOptions,
): Promise<{ content: string; messages: BaseMessage[] }> {
  const { threadId, model, tools, systemPrompt, userMessage, assistantMessageId, provider, maxIterations = 25 } = opts;

  const { logger, sessionManager, emitStreamEvent, getHitlLevel } = deps;

  const thinkingFilter = new ThinkingFilter();
  const chunkBuffer = new ChunkBuffer(emitStreamEvent);

  // Build messages array
  // Anthropic: prefix caching으로 반복 시스템 프롬프트 토큰 비용 절감
  // 그 외: 기존 문자열 방식 유지
  const messages: BaseMessage[] = opts.existingMessages
    ? [...opts.existingMessages]
    : [createCachedSystemMessage(systemPrompt, provider)];

  if (userMessage) {
    messages.push(new HumanMessage(userMessage));
  }

  // Bind tools to model
  const supportsTools = "bindTools" in model && typeof model.bindTools === "function";
  if (!supportsTools) {
    throw new Error("This model does not support Tool Calling. Please use a model that supports Tool Calling.");
  }

  const boundModel = (model as any).bindTools(tools);
  let finalContent = "";
  let iteration = 0;

  // Track save_to_cluster calls to prevent LLM from saving the same report twice
  const executedSaveTools = new Set<string>();

  // Auto-continue when LLM response is truncated by max_tokens (max 3 retries)
  let autoContCount = 0;
  // Transient API error retry (max 2 retries across entire session)
  let retryCount = 0;
  // Compact: stop trying after 2 consecutive failures, notify user instead
  let compactFailures = 0;
  let compactDisabled = false;

  while (iteration < maxIterations) {
    iteration++;
    logger.info(`[ReActLoop] Iteration ${iteration}/${maxIterations}`, { threadId });

    thinkingFilter.reset();
    const messageId = iteration === 1 ? assistantMessageId : `${assistantMessageId}-${iteration}`;
    let iterationContent = "";

    // Always stream LLM text to the UI for responsiveness.
    // Expert Panel Mode prompt already tells the LLM not to produce analysis,
    // so intermediate text is brief ("gathering more data...") and useful for UX.
    chunkBuffer.start(messageId);

    // [Stage 1] Soft compact — summarize old messages when token usage > 60%
    if (iteration > 1 && !compactDisabled) {
      try {
        const compactResult = await compactMessages(messages, {
          provider,
          model: boundModel,
          preserveRecentCount: 8,
          tokenLimit: PROVIDER_TOKEN_LIMITS[provider],
          logger,
        });
        if (compactResult.wasCompacted) {
          messages.length = 0;
          messages.push(...compactResult.messages);
          compactFailures = 0;
          logger.info("[ReActLoop] Soft compact applied", {
            summarized: compactResult.summarizedCount,
            tokensSaved: compactResult.estimatedTokensSaved,
          });
        }
      } catch (compactError: any) {
        compactFailures++;
        logger.warn(`[ReActLoop] Compact failed (${compactFailures}/2):`, compactError.message);

        if (compactFailures >= 2) {
          compactDisabled = true;
          // Notify user via error event: context management degraded, suggest new session
          emitStreamEvent({
            type: "error",
            threadId,
            error:
              "This conversation is getting too long to manage context effectively. Starting a new session will give you more accurate responses.",
          });
          logger.warn("[ReActLoop] Compact disabled — user notified to start new session");
        }
      }
    }

    // [Stage 2] Hard trim — safety net (existing logic)
    const trimResult = trimMessages(messages, {
      provider,
      preserveRecentCount: 6,
      preserveSystemMessages: true,
      preserveInitialRequest: true,
    });
    if (trimResult.wasTrimmed) {
      logger.info("[ReActLoop] Messages trimmed", {
        original: trimResult.originalCount,
        trimmed: trimResult.trimmedCount,
      });
    }
    // Build final message array: SystemMessage first, then trimmed non-system messages
    // Merge consecutive same-role messages to prevent Anthropic 400 errors
    const rawCallMessages = [
      messages[0], // System message
      ...trimResult.messages.filter((m) => !(m instanceof SystemMessage)),
    ];
    const callMessages = mergeConsecutiveSameRole(rawCallMessages);

    // Debug: log message structure before API call to diagnose 400 errors
    logger.info("[ReActLoop] API call message structure:", {
      threadId,
      iteration,
      messageCount: callMessages.length,
      messages: callMessages.map((m, i) => ({
        idx: i,
        type: m._getType(),
        contentLength: typeof m.content === "string" ? m.content.length : JSON.stringify(m.content).length,
        hasToolCalls: !!(m as any).tool_calls?.length,
        toolCallIds: (m as any).tool_calls?.map((tc: any) => tc.id) ?? [],
        toolCallId: (m as any).tool_call_id ?? undefined,
      })),
    });

    // Stream LLM response
    let aiMessage: AIMessage;
    try {
      const stream = await boundModel.stream(callMessages);
      const chunks: any[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
        if (chunk.content) {
          const text = extractTextFromContent(chunk.content);
          const filtered = filterGeminiToolCallText(thinkingFilter.filter(text));
          if (filtered) {
            // Handle Anthropic cumulative chunks
            let delta = filtered;
            if (iterationContent.length > 0 && filtered.startsWith(iterationContent)) {
              delta = filtered.slice(iterationContent.length);
            }
            if (delta) {
              iterationContent += delta;
              chunkBuffer.add(delta, messageId);
            }
          }
        }
      }

      chunkBuffer.stop(messageId);

      // Concatenate chunks into final AIMessage
      if (chunks.length > 0) {
        const rawMessage = chunks.reduce((acc, chunk) => {
          if (!acc) return chunk;
          return acc.concat(chunk);
        });
        // Sanitize: strip tool_use blocks from content array when tool_calls exist.
        // Anthropic streaming produces both content[]{type:"tool_use"} AND tool_calls[].
        // When LangChain serializes this back to the API, it adds tool_use blocks from
        // BOTH sources, causing duplicate tool_use IDs → 400 invalid_request_error.
        aiMessage = sanitizeAIMessage(rawMessage);
      } else {
        aiMessage = new AIMessage({ content: iterationContent });
      }
    } catch (streamError: any) {
      chunkBuffer.stop(messageId);

      // Retry on transient API errors (429/500/502/503) with exponential backoff
      const status = streamError.status ?? streamError.statusCode;
      if ([429, 500, 502, 503].includes(status) && retryCount < 2) {
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount), 8000);
        logger.warn(`[ReActLoop] Transient error ${status}, retrying (${retryCount}/2) after ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        iteration--; // Restore iteration count — retry is not a new step
        continue;
      }

      // Log full error details + message dump for 400 diagnosis
      logger.error("[ReActLoop] Stream error:", {
        message: streamError.message,
        status: streamError.status ?? streamError.statusCode,
        errorBody: streamError.error ?? streamError.body,
        callMessageCount: callMessages.length,
        callMessageTypes: callMessages.map((m, i) => ({
          idx: i,
          type: m._getType(),
          hasToolCalls: !!(m as any).tool_calls?.length,
          toolCallCount: (m as any).tool_calls?.length ?? 0,
          toolCallId: (m as any).tool_call_id,
        })),
      });
      throw streamError;
    }

    // Add AI message to history
    messages.push(aiMessage);

    // Check for tool calls
    const toolCalls = aiMessage.tool_calls ?? [];
    if (toolCalls.length === 0) {
      // Auto-continue when response was truncated by max_tokens limit
      // Anthropic: response_metadata.stop_reason = "max_tokens"
      // OpenAI/OpenRouter: response_metadata.finish_reason = "length" (requires runtime verification)
      const stopReason = String(
        aiMessage.response_metadata?.stop_reason ??
          aiMessage.response_metadata?.finish_reason ??
          aiMessage.additional_kwargs?.stop_reason ??
          aiMessage.additional_kwargs?.finish_reason ??
          "",
      );

      const normalizedStopReason = stopReason.toLowerCase().replace(/[^a-z_]/g, "");
      const isMaxTokensTruncated =
        normalizedStopReason.includes("max_tokens") ||
        normalizedStopReason === "length" ||
        normalizedStopReason === "lengthlength";

      if (isMaxTokensTruncated && autoContCount < 3) {
        autoContCount++;
        logger.info(`[ReActLoop] Auto-continue (${autoContCount}/3) — response truncated (${stopReason})`);
        messages.push(new HumanMessage("Please continue."));
        continue;
      }

      // No tool calls - agent is done
      finalContent = iterationContent || extractTextFromContent(aiMessage.content);

      if (!opts.suppressMessageComplete) {
        emitStreamEvent({
          type: "message-complete",
          content: finalContent,
          messageId,
        });
      }

      break;
    }

    // Process tool calls
    logger.info(
      "[ReActLoop] Tool calls:",
      toolCalls.map((tc: any) => tc.name),
    );

    // Deduplicate save_to_cluster calls — LLMs sometimes call it twice despite prompt warnings
    const filteredToolCalls = toolCalls.filter((tc: any) => {
      if (tc.name === "save_to_cluster") {
        const key = `${tc.name}:${(tc.args as any)?.filename ?? ""}`;
        if (executedSaveTools.has(key)) {
          logger.warn("[ReActLoop] Blocked duplicate save_to_cluster call", { filename: (tc.args as any)?.filename });
          // Add a ToolMessage so the LLM knows the save was already done
          messages.push(
            new ToolMessage({
              tool_call_id: tc.id ?? `call-dedup-${Date.now()}`,
              name: tc.name,
              content: JSON.stringify({
                status: "success",
                message: "File was already saved in a previous step. Skipping duplicate save.",
              }),
            }),
          );
          return false;
        }
        executedSaveTools.add(key);
      }
      return true;
    });

    if (filteredToolCalls.length === 0) continue;

    const effectiveHitlLevel = getHitlLevel();
    const currentAutoApprovalRules = (await deps.getAutoApprovalRules?.()) ?? [];

    // Split tool calls: auto-approved (execute immediately) vs needs-approval (plan UI)
    const autoApprovedCalls: typeof filteredToolCalls = [];
    const approvalNeededCalls: typeof filteredToolCalls = [];

    for (const tc of filteredToolCalls) {
      const info = getToolApprovalInfo(tc.name, tc.args ?? {}, effectiveHitlLevel, currentAutoApprovalRules);
      if (info.requiresApproval) {
        approvalNeededCalls.push(tc);
      } else {
        autoApprovedCalls.push(tc);
      }
    }

    // Execute auto-approved tools immediately (parallel for safe, serial for unsafe)
    if (autoApprovedCalls.length > 0) {
      const safeCalls = autoApprovedCalls.filter((tc: any) => isToolConcurrencySafe(tc.name, tc.args ?? {}));
      const unsafeCalls = autoApprovedCalls.filter((tc: any) => !isToolConcurrencySafe(tc.name, tc.args ?? {}));

      // Parallel execution for safe tools
      if (safeCalls.length > 0) {
        for (const tc of safeCalls) {
          emitStreamEvent({ type: "tool-execution", toolName: tc.name, status: "started", input: tc.args ?? {} });
        }
        const settled = await Promise.allSettled(
          safeCalls.map(async (tc: any) => {
            const toolCallId = tc.id ?? `call-${crypto.randomUUID()}`;
            const tool = tools.find((t) => t.name === tc.name);
            if (!tool) return { toolCallId, toolName: tc.name, error: `Tool not found: ${tc.name}` };
            const result = await tool.invoke(tc.args ?? {});
            const rawStr = typeof result === "string" ? result : JSON.stringify(result);
            const processed = await processToolResult(tc.name, tc.args ?? {}, rawStr);
            return { toolCallId, toolName: tc.name, resultStr: processed.content };
          }),
        );
        for (let i = 0; i < settled.length; i++) {
          const s = settled[i];
          const tc = safeCalls[i];
          if (s.status === "fulfilled") {
            const val = s.value;
            messages.push(
              new ToolMessage({
                tool_call_id: val.toolCallId,
                name: val.toolName,
                content: val.error ? JSON.stringify({ status: "error", message: val.error }) : (val.resultStr ?? ""),
              }),
            );
            emitStreamEvent({
              type: "tool-execution",
              toolName: val.toolName,
              status: val.error ? "error" : "completed",
              ...(val.error ? { error: val.error } : { result: val.resultStr ?? "" }),
            });
          } else {
            const err = s.reason?.message ?? "Tool execution failed";
            messages.push(
              new ToolMessage({
                tool_call_id: tc.id ?? `call-${crypto.randomUUID()}`,
                name: tc.name,
                content: JSON.stringify({ status: "error", message: err }),
              }),
            );
            emitStreamEvent({ type: "tool-execution", toolName: tc.name, status: "error", error: err });
          }
        }
      }

      // Serial execution for unsafe auto-approved tools
      for (const tc of unsafeCalls) {
        const toolCallId = tc.id ?? `call-${Date.now()}`;
        emitStreamEvent({ type: "tool-execution", toolName: tc.name, status: "started", input: tc.args ?? {} });
        try {
          const tool = tools.find((t) => t.name === tc.name);
          if (!tool) {
            messages.push(
              new ToolMessage({
                tool_call_id: toolCallId,
                name: tc.name,
                content: JSON.stringify({ status: "error", message: `Tool not found: ${tc.name}` }),
              }),
            );
            emitStreamEvent({
              type: "tool-execution",
              toolName: tc.name,
              status: "error",
              error: `Tool not found: ${tc.name}`,
            });
            continue;
          }
          const result = await tool.invoke(tc.args ?? {});
          const rawStr = typeof result === "string" ? result : JSON.stringify(result);
          const processed = await processToolResult(tc.name, tc.args ?? {}, rawStr);
          messages.push(new ToolMessage({ tool_call_id: toolCallId, name: tc.name, content: processed.content }));
          emitStreamEvent({
            type: "tool-execution",
            toolName: tc.name,
            status: "completed",
            result: processed.content,
          });
        } catch (toolError: any) {
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: tc.name,
              content: JSON.stringify({ status: "error", message: toolError.message ?? "Tool execution failed" }),
            }),
          );
          emitStreamEvent({ type: "tool-execution", toolName: tc.name, status: "error", error: toolError.message });
        }
      }
    }

    // Show Plan UI only for tools that need approval
    if (approvalNeededCalls.length > 1) {
      // Build plan steps from approval-needed tool calls only
      const planSteps = approvalNeededCalls.map((tc: any, idx: number) => ({
        title: `${tc.name}`,
        command: formatRequestString(tc.name, tc.args ?? {}),
        description: `Step ${idx + 1}: ${tc.name}`,
      }));

      const planTitle = `${approvalNeededCalls.length}개 도구 실행 계획`;
      const planSummary = "";

      const approved = await requestPlanApproval(deps, threadId, planTitle, planSummary, planSteps);

      if (!approved) {
        logger.info("[ReActLoop] Plan rejected by user");
        for (const toolCall of approvalNeededCalls) {
          const toolCallId = toolCall.id ?? `call-${Date.now()}`;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolCall.name,
              content: `[User rejected] The execution plan was rejected by the user.`,
            }),
          );
        }
      } else {
        // Emit plan status: executing
        emitStreamEvent({
          type: "plan-step-update",
          stepIndex: -1, // -1 = plan-level status
          status: "in_progress",
          toolName: "",
        });

        // Partition plan steps into safe (parallel) and unsafe (serial)
        const planSafeCalls: Array<{ toolCall: any; stepIdx: number }> = [];
        const planUnsafeCalls: Array<{ toolCall: any; stepIdx: number }> = [];

        for (let stepIdx = 0; stepIdx < approvalNeededCalls.length; stepIdx++) {
          const toolCall = approvalNeededCalls[stepIdx];
          const toolInput = toolCall.args ?? {};
          if (isToolConcurrencySafe(toolCall.name, toolInput)) {
            planSafeCalls.push({ toolCall, stepIdx });
          } else {
            planUnsafeCalls.push({ toolCall, stepIdx });
          }
        }

        // Ordered results collector to maintain message order
        const planResults: Array<{
          stepIdx: number;
          toolCallId: string;
          toolName: string;
          resultStr?: string;
          error?: string;
        }> = [];

        // Phase 1: Execute safe tools in parallel
        if (planSafeCalls.length > 0) {
          for (const { toolCall, stepIdx } of planSafeCalls) {
            emitStreamEvent({
              type: "plan-step-update",
              stepIndex: stepIdx,
              status: "in_progress",
              toolName: toolCall.name,
            });
            emitStreamEvent({
              type: "tool-execution",
              toolName: toolCall.name,
              status: "started",
              input: toolCall.args ?? {},
            });
          }

          const settled = await Promise.allSettled(
            planSafeCalls.map(async ({ toolCall, stepIdx }) => {
              const toolName = toolCall.name;
              const toolInput = toolCall.args ?? {};
              const toolCallId = toolCall.id ?? `call-${crypto.randomUUID()}`;
              const tool = tools.find((t) => t.name === toolName);
              if (!tool) return { stepIdx, toolCallId, toolName, error: `Tool not found: ${toolName}` };
              const result = await tool.invoke(toolInput);
              const rawStr = typeof result === "string" ? result : JSON.stringify(result);
              const processed = await processToolResult(toolName, toolInput, rawStr);
              return { stepIdx, toolCallId, toolName, resultStr: processed.content };
            }),
          );

          for (let i = 0; i < settled.length; i++) {
            const s = settled[i];
            const { stepIdx } = planSafeCalls[i];
            const toolName = planSafeCalls[i].toolCall.name;
            if (s.status === "fulfilled") {
              planResults.push(s.value);
              if (s.value.error) {
                emitStreamEvent({
                  type: "plan-step-update",
                  stepIndex: stepIdx,
                  status: "failed",
                  toolName,
                  error: s.value.error,
                });
                emitStreamEvent({ type: "tool-execution", toolName, status: "error", error: s.value.error });
              } else {
                emitStreamEvent({
                  type: "plan-step-update",
                  stepIndex: stepIdx,
                  status: "completed",
                  toolName,
                  result: s.value.resultStr ?? "".slice(0, 200),
                });
                emitStreamEvent({
                  type: "tool-execution",
                  toolName,
                  status: "completed",
                  result: s.value.resultStr ?? "",
                });
              }
            } else {
              const err = s.reason?.message ?? "Tool execution failed";
              const toolCallId = planSafeCalls[i].toolCall.id ?? `call-${crypto.randomUUID()}`;
              planResults.push({ stepIdx, toolCallId, toolName, error: err });
              emitStreamEvent({ type: "plan-step-update", stepIndex: stepIdx, status: "failed", toolName, error: err });
              emitStreamEvent({ type: "tool-execution", toolName, status: "error", error: err });
            }
          }
        }

        // Phase 2: Execute unsafe tools serially
        for (const { toolCall, stepIdx } of planUnsafeCalls) {
          const toolName = toolCall.name;
          const toolInput = toolCall.args ?? {};
          const toolCallId = toolCall.id ?? `call-${Date.now()}-${stepIdx}`;

          emitStreamEvent({ type: "plan-step-update", stepIndex: stepIdx, status: "in_progress", toolName });
          emitStreamEvent({ type: "tool-execution", toolName, status: "started", input: toolInput });

          try {
            const tool = tools.find((t) => t.name === toolName);
            if (!tool) {
              planResults.push({ stepIdx, toolCallId, toolName, error: `Tool not found: ${toolName}` });
              emitStreamEvent({
                type: "plan-step-update",
                stepIndex: stepIdx,
                status: "failed",
                toolName,
                error: `Tool not found: ${toolName}`,
              });
              emitStreamEvent({
                type: "tool-execution",
                toolName,
                status: "error",
                error: `Tool not found: ${toolName}`,
              });
              continue;
            }

            const result = await tool.invoke(toolInput);
            const rawStr = typeof result === "string" ? result : JSON.stringify(result);
            const processed = await processToolResult(toolName, toolInput, rawStr);
            planResults.push({ stepIdx, toolCallId, toolName, resultStr: processed.content });
            emitStreamEvent({
              type: "plan-step-update",
              stepIndex: stepIdx,
              status: "completed",
              toolName,
              result: processed.content.slice(0, 200),
            });
            emitStreamEvent({ type: "tool-execution", toolName, status: "completed", result: processed.content });
          } catch (toolError: any) {
            logger.error("[ReActLoop] Plan step execution error:", toolName, toolError);
            planResults.push({ stepIdx, toolCallId, toolName, error: toolError.message ?? "Tool execution failed" });
            emitStreamEvent({
              type: "plan-step-update",
              stepIndex: stepIdx,
              status: "failed",
              toolName,
              error: toolError.message,
            });
            emitStreamEvent({ type: "tool-execution", toolName, status: "error", error: toolError.message });
          }
        }

        // Add all results to messages in original step order
        planResults.sort((a, b) => a.stepIdx - b.stepIdx);
        for (const pr of planResults) {
          messages.push(
            new ToolMessage({
              tool_call_id: pr.toolCallId,
              name: pr.toolName,
              content: pr.error ? JSON.stringify({ status: "error", message: pr.error }) : (pr.resultStr ?? ""),
            }),
          );
        }

        // All steps done — emit plan completion
        const allCompleted = approvalNeededCalls.length > 0;
        emitStreamEvent({
          type: "plan-step-update",
          stepIndex: -1,
          status: allCompleted ? "completed" : "failed",
          toolName: "",
        });
      }
    } else if (approvalNeededCalls.length > 0) {
      // Single approval-needed tool or no batch — process individually
      // (auto-approved tools already executed above)
      const safeCalls: typeof approvalNeededCalls = [];
      const unsafeCalls: typeof approvalNeededCalls = [];

      for (const toolCall of approvalNeededCalls) {
        const toolInput = toolCall.args ?? {};
        const approvalInfo = getToolApprovalInfo(
          toolCall.name,
          toolInput,
          effectiveHitlLevel,
          currentAutoApprovalRules,
        );

        // Tools needing approval must go through serial HITL flow
        if (approvalInfo.requiresApproval || !approvalInfo.concurrencySafe) {
          unsafeCalls.push(toolCall);
        } else {
          safeCalls.push(toolCall);
        }
      }

      if (safeCalls.length > 1) {
        logger.info("[ReActLoop] Parallel execution:", {
          safe: safeCalls.map((tc: any) => tc.name),
          unsafe: unsafeCalls.map((tc: any) => tc.name),
        });
      }

      // === Phase 1: Execute concurrency-safe tools in parallel ===
      if (safeCalls.length > 0) {
        // Emit started events for all safe tools
        for (const toolCall of safeCalls) {
          emitStreamEvent({
            type: "tool-execution",
            toolName: toolCall.name,
            status: "started",
            input: toolCall.args ?? {},
          });
        }

        const safeResults = await Promise.allSettled(
          safeCalls.map(async (toolCall: any) => {
            const toolName = toolCall.name;
            const toolInput = toolCall.args ?? {};
            const toolCallId = toolCall.id ?? `call-${crypto.randomUUID()}`;

            const tool = tools.find((t) => t.name === toolName);
            if (!tool) {
              return { toolCallId, toolName, error: `Tool not found: ${toolName}` };
            }

            const result = await tool.invoke(toolInput);
            const rawStr = typeof result === "string" ? result : JSON.stringify(result);
            const processed = await processToolResult(toolName, toolInput, rawStr);
            return { toolCallId, toolName, resultStr: processed.content };
          }),
        );

        // Collect results in original order
        for (let i = 0; i < safeResults.length; i++) {
          const settled = safeResults[i];
          const toolCall = safeCalls[i];
          const toolName = toolCall.name;
          const toolCallId = toolCall.id ?? `call-${crypto.randomUUID()}`;

          if (settled.status === "fulfilled") {
            const val = settled.value;
            if (val.error) {
              messages.push(
                new ToolMessage({
                  tool_call_id: val.toolCallId,
                  name: val.toolName,
                  content: JSON.stringify({ status: "error", message: val.error }),
                }),
              );
              emitStreamEvent({ type: "tool-execution", toolName: val.toolName, status: "error", error: val.error });
            } else {
              messages.push(
                new ToolMessage({
                  tool_call_id: val.toolCallId,
                  name: val.toolName,
                  content: val.resultStr ?? "",
                }),
              );
              emitStreamEvent({
                type: "tool-execution",
                toolName: val.toolName,
                status: "completed",
                result: val.resultStr ?? "",
              });
            }
          } else {
            // Promise rejected (unexpected tool crash)
            const err = settled.reason?.message ?? "Tool execution failed";
            logger.error("[ReActLoop] Parallel tool error:", toolName, settled.reason);
            messages.push(
              new ToolMessage({
                tool_call_id: toolCallId,
                name: toolName,
                content: JSON.stringify({ status: "error", message: err }),
              }),
            );
            emitStreamEvent({ type: "tool-execution", toolName, status: "error", error: err });
          }
        }
      }

      // === Phase 2: Execute unsafe tools serially (existing HITL flow) ===
      for (const toolCall of unsafeCalls) {
        const toolName = toolCall.name;
        const toolInput = toolCall.args ?? {};
        const toolCallId = toolCall.id ?? `call-${Date.now()}`;

        emitStreamEvent({
          type: "tool-execution",
          toolName,
          status: "started",
          input: toolInput,
        });

        const approvalInfo = getToolApprovalInfo(toolName, toolInput, effectiveHitlLevel, currentAutoApprovalRules);

        if (approvalInfo.requiresApproval) {
          logger.info("[ReActLoop] HITL approval required:", { toolName, toolInput });

          const approved = await requestHITLApproval(
            deps,
            threadId,
            toolName,
            toolInput,
            approvalInfo.isWriteOperation,
          );

          if (!approved) {
            logger.info("[ReActLoop] Tool rejected by user:", toolName);

            messages.push(
              new ToolMessage({
                tool_call_id: toolCallId,
                name: toolName,
                content: `[User rejected] This operation was rejected by the user. Suggest an alternative or ask for more information.`,
              }),
            );

            emitStreamEvent({
              type: "tool-execution",
              toolName,
              status: "completed",
              result: "Rejected by user",
            });

            continue;
          }
        }

        // Execute tool
        try {
          const tool = tools.find((t) => t.name === toolName);
          if (!tool) {
            messages.push(
              new ToolMessage({
                tool_call_id: toolCallId,
                name: toolName,
                content: JSON.stringify({ status: "error", message: `Tool not found: ${toolName}` }),
              }),
            );
            emitStreamEvent({
              type: "tool-execution",
              toolName,
              status: "error",
              error: `Tool not found: ${toolName}`,
            });
            continue;
          }

          const result = await tool.invoke(toolInput);
          const rawStr = typeof result === "string" ? result : JSON.stringify(result);
          const processed = await processToolResult(toolName, toolInput, rawStr);

          messages.push(new ToolMessage({ tool_call_id: toolCallId, name: toolName, content: processed.content }));
          emitStreamEvent({ type: "tool-execution", toolName, status: "completed", result: processed.content });
        } catch (toolError: any) {
          logger.error("[ReActLoop] Tool execution error:", toolName, toolError);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: JSON.stringify({ status: "error", message: toolError.message ?? "Tool execution failed" }),
            }),
          );
          emitStreamEvent({ type: "tool-execution", toolName, status: "error", error: toolError.message });
        }
      }
    }

    // If this was the last iteration, complete with current content
    if (iteration >= maxIterations) {
      finalContent = iterationContent;

      // Ask user if they want to continue
      logger.warn("[ReActLoop] Max iterations reached:", { threadId, maxIterations });

      const hitlSession = sessionManager.createHitlSession({
        id: crypto.randomUUID(),
        threadId,
        interruptType: "recursion_limit",
        payload: {
          currentLimit: maxIterations,
          nextLimit: maxIterations + 15,
          message: `Reached ${maxIterations} steps`,
        },
      });

      emitStreamEvent({
        type: "interrupt",
        threadId,
        interruptType: "recursion_limit",
        payload: {
          hitlSessionId: hitlSession.id,
          currentLimit: maxIterations,
          nextLimit: maxIterations + 15,
          message: `⚠️ Reached ${maxIterations} steps`,
          description: "Many steps were needed. Continue?",
          options: ["continue", "stop"],
          optionLabels: {
            continue: `Continue (+15 steps)`,
            stop: "Stop with current results",
          },
        },
      });

      break;
    }
  }

  return { content: finalContent, messages };
}

// ============================================
// HITL Promise-based Approval
// ============================================

/**
 * Request Plan approval via Promise.
 *
 * Bundles multiple tool calls into a Plan and waits for batch approval.
 * Uses the same interrupt/resume mechanism as HITL.
 */
async function requestPlanApproval(
  deps: ReactLoopDependencies,
  threadId: string,
  planTitle: string,
  planSummary: string,
  planSteps: Array<{ title: string; command?: string; description?: string }>,
): Promise<boolean> {
  const { sessionManager, emitStreamEvent, logger } = deps;

  const hitlSession = sessionManager.createHitlSession({
    id: crypto.randomUUID(),
    threadId,
    interruptType: "plan_approval",
    payload: { planTitle, planSummary, planSteps },
  });

  return new Promise<boolean>((resolve) => {
    (hitlSession as any)._resolve = resolve;

    deps.onInterrupt?.();

    emitStreamEvent({
      type: "interrupt",
      threadId,
      interruptType: "plan_approval",
      payload: {
        planTitle,
        planSummary,
        planSteps,
      },
    });

    logger.info("[ReActLoop] Plan approval interrupt emitted", {
      hitlSessionId: hitlSession.id,
      stepCount: planSteps.length,
    });
  });
}

/**
 * Request HITL approval via Promise.
 *
 * Creates a HITL session, emits interrupt event, and waits for user response.
 * The AgentHost resolves this Promise when it receives a resume-interrupt request.
 */
async function requestHITLApproval(
  deps: ReactLoopDependencies,
  threadId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  isWriteOperation: boolean,
): Promise<boolean> {
  const { sessionManager, emitStreamEvent, logger } = deps;

  // Build display-friendly payload
  const requestString = formatRequestString(toolName, toolInput);

  // Create HITL session
  const hitlSession = sessionManager.createHitlSession({
    id: crypto.randomUUID(),
    threadId,
    interruptType: "hitl",
    payload: {
      toolName,
      toolInput,
      isWriteOperation,
    },
  });

  // Create Promise that will be resolved when user responds
  return new Promise<boolean>((resolve) => {
    // Store resolve function on the session for AgentHost to call
    (hitlSession as any)._resolve = resolve;

    // Build approval info for file write tools (save_to_cluster, write_file)
    // so ToolApprovalDiff renders with file content preview
    let approval: ToolApprovalWithDiff | undefined;
    if (toolName === "save_to_cluster" || toolName === "write_file") {
      const content = (toolInput.content as string) ?? "";
      const filename = (toolInput.filename as string) ?? "file";
      const folderType = (toolInput.folderType as string) ?? "";
      const filePath = folderType ? `[${folderType}] ${filename}` : filename;

      // Build diff for new file (all lines are additions)
      const lines = content.split("\n");
      const diff = `--- /dev/null\n+++ b/${filename}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((l) => `+${l}`).join("\n")}`;

      approval = {
        id: `approval-${Date.now()}`,
        toolName,
        toolType: ToolApprovalType.FILE_WRITE,
        description: `Save ${filename}`,
        requiresApproval: true,
        createdAt: Date.now(),
        filePath,
        diff,
        newContent: content,
        toolInput,
        status: "pending",
        metadata: {
          filename,
          folderType: folderType || undefined,
          filesize: new TextEncoder().encode(content).length,
        },
      };
    }

    const hitlPayload = {
      question: `Execute ${toolName}?`,
      options: ["yes", "no"],
      requestString,
      actionSummary: requestString,
      toolName,
      payload: toolInput,
      approval,
    };

    // Notify agent-host to set session status to "interrupted" BEFORE emitting to UI
    // This prevents the race condition where user clicks Approve before status is set
    deps.onInterrupt?.();

    // Emit interrupt event to UI
    emitStreamEvent({
      type: "interrupt",
      threadId,
      interruptType: "hitl",
      payload: hitlPayload,
    });

    logger.info("[ReActLoop] HITL interrupt emitted, waiting for user response", {
      hitlSessionId: hitlSession.id,
      toolName,
    });
  });
}

/**
 * Resume a pending HITL approval.
 *
 * Called by AgentHost when it receives a resume-interrupt request.
 * Resolves the Promise created by requestHITLApproval.
 */
export function resolveHITLApproval(sessionManager: AgentSessionManager, threadId: string, approved: boolean): boolean {
  const session = sessionManager.getPendingHitlSession(threadId);
  if (!session) return false;

  const resolve = (session as any)._resolve as ((v: boolean) => void) | undefined;
  if (resolve) {
    resolve(approved);
    delete (session as any)._resolve;
    sessionManager.resolveHitlSession(session.id, approved ? "yes" : "no");
    return true;
  }

  return false;
}
