/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Expert Panel Execution Engine
 *
 * Implements the Parallel Expert Synthesis (MoA variant) pattern:
 * 1. Multiple expert LLM calls run in parallel (Promise.all)
 * 2. A Synthesizer agent merges all analyses into a unified report
 *
 * Design decisions:
 * - Parallel execution: latency ≈ single call (max of N calls)
 * - Cost: ~4x single call (3 experts + 1 synthesizer)
 * - Streaming: synthesizer output is streamed token-by-token
 */

import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { buildSynthesizerPrompt } from "./expert-personas";
import { filterToolsForAgent, getToolApprovalInfo } from "./react-tools";

import type { Logger } from "@skuberplus/logger";

import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";

import type { AgentStreamEvent } from "../../common/agent-ipc-channels";
import type { ExpertPanelConfig, ExpertRole } from "./expert-personas";

// ============================================
// Types
// ============================================

export interface DebateRound {
  round: number;
  expertResponses: Map<string, string>;
}

export interface ExpertPanelResult {
  /** Individual expert analyses */
  expertAnalyses: Map<string, string>;
  /** Synthesized final result */
  synthesis: string;
  /** Debate history (if multi-round) */
  debateRounds?: DebateRound[];
}

type EmitFn = (event: AgentStreamEvent) => void;

// ============================================
// Content Extraction (same logic as react-loop)
// ============================================

/**
 * Sanitize AIMessage: convert array content to string when tool_calls exist.
 * LangChain only uses tool_calls for tool_use generation when content is a string.
 * Same fix as sanitizeAIMessage in react-loop.ts.
 */
function sanitizeExpertAIMessage(msg: any): any {
  const toolCalls = msg.tool_calls ?? [];
  if (toolCalls.length === 0) return msg;

  let textContent: string;
  if (Array.isArray(msg.content)) {
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

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block?.type === "text" && typeof block?.text === "string")
      .map((block: any) => block.text)
      .join("");
  }
  return "";
}

// ============================================
// Expert Panel Execution
// ============================================

/**
 * Run the Expert Panel analysis.
 *
 * Executes multiple expert LLM calls in parallel, then synthesizes
 * their outputs into a unified report via a Synthesizer call.
 */
export async function runExpertPanel(
  config: ExpertPanelConfig,
  model: BaseChatModel,
  clusterData: string,
  userQuery: string,
  emitStreamEvent: EmitFn,
  logger: Logger,
  threadId: string,
  messageId: string,
  allTools?: StructuredToolInterface[],
): Promise<ExpertPanelResult> {
  const { commandContext } = config;
  const { experts, maxDebateRounds = 1 } = config;
  const rounds = Math.min(Math.max(maxDebateRounds, 1), 2);

  logger.info("[ExpertPanel] Starting expert panel analysis", {
    expertCount: experts.length,
    rounds,
    consensusMode: config.consensusMode,
  });

  // Emit debate-start event
  emitStreamEvent({
    type: "debate-start",
    threadId,
    experts: experts.map((e) => ({ id: e.id, name: e.name })),
    roundNumber: 1,
  });

  // Phase 1: Parallel expert analysis
  const expertAnalyses = new Map<string, string>();
  const debateRounds: DebateRound[] = [];

  const analysisPrompt = buildAnalysisPrompt(clusterData, userQuery);

  // Round 1: Independent parallel analysis
  const round1Results = await runParallelExperts(
    experts,
    model,
    analysisPrompt,
    emitStreamEvent,
    logger,
    threadId,
    clusterData,
    allTools,
  );

  for (const [expertId, content] of round1Results) {
    expertAnalyses.set(expertId, content);
  }
  debateRounds.push({ round: 1, expertResponses: new Map(round1Results) });

  // Round 2 (optional): Experts review each other's analyses
  if (rounds >= 2) {
    logger.info("[ExpertPanel] Starting round 2 (cross-review)");

    emitStreamEvent({
      type: "debate-start",
      threadId,
      experts: experts.map((e) => ({ id: e.id, name: e.name })),
      roundNumber: 2,
    });

    const round2Prompt = buildCrossReviewPrompt(clusterData, userQuery, expertAnalyses, experts);

    const round2Results = await runParallelExperts(
      experts,
      model,
      round2Prompt,
      emitStreamEvent,
      logger,
      threadId,
      clusterData,
      allTools,
    );

    for (const [expertId, content] of round2Results) {
      expertAnalyses.set(expertId, content);
    }
    debateRounds.push({ round: 2, expertResponses: new Map(round2Results) });
  }

  // Phase 2: Synthesizer — stream the final report
  const synthesis = await runSynthesizer(
    model,
    expertAnalyses,
    experts,
    clusterData,
    userQuery,
    emitStreamEvent,
    logger,
    threadId,
    messageId,
    commandContext,
  );

  // Emit consensus event
  emitStreamEvent({
    type: "debate-consensus",
    threadId,
    consensus: synthesis,
  });

  logger.info("[ExpertPanel] Expert panel analysis complete", {
    expertCount: experts.length,
    synthesisLength: synthesis.length,
  });

  return {
    expertAnalyses,
    synthesis,
    debateRounds,
  };
}

// ============================================
// Internal Helpers
// ============================================

function buildAnalysisPrompt(clusterData: string, userQuery: string): string {
  return `## Cluster Data
${clusterData}

## User Request
${userQuery}

Analyze the above cluster data from your area of expertise. Be specific and actionable.
Provide your analysis in structured markdown with severity levels.`;
}

function buildCrossReviewPrompt(
  clusterData: string,
  userQuery: string,
  previousAnalyses: Map<string, string>,
  experts: ExpertRole[],
): string {
  const analysesText = experts
    .map((e) => {
      const analysis = previousAnalyses.get(e.id) ?? "(no analysis)";
      return `### ${e.name}'s Analysis:\n${analysis}`;
    })
    .join("\n\n");

  return `## Cluster Data
${clusterData}

## User Request
${userQuery}

## Other Experts' Analyses (Round 1)
${analysesText}

Review the other experts' analyses above. Refine your own analysis considering their findings.
Highlight any disagreements and provide your reasoning. Be specific and actionable.`;
}

/**
 * Run all experts in parallel via Promise.all
 */
async function runParallelExperts(
  experts: ExpertRole[],
  model: BaseChatModel,
  analysisPrompt: string,
  emitStreamEvent: EmitFn,
  logger: Logger,
  threadId: string,
  clusterData: string,
  allTools?: StructuredToolInterface[],
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  const promises = experts.map(async (expert) => {
    try {
      // Emit thinking status
      emitStreamEvent({
        type: "debate-expert-response",
        threadId,
        expertId: expert.id,
        expertName: expert.name,
        content: "",
        status: "thinking",
      });

      // Determine if this expert should use ReAct mode (independent tool usage)
      const expertTools = allTools ? filterToolsForAgent(allTools, expert) : [];
      const useReactMode = expertTools.length > 0 && !!(expert.allowedTools?.length || expert.deniedTools?.length);

      let content: string;

      if (useReactMode) {
        // ReAct mode: expert runs an independent loop with filtered tools
        logger.info(`[ExpertPanel] Expert ${expert.id} using ReAct mode`, {
          toolCount: expertTools.length,
        });

        const result = await runExpertReactLoop({
          expert,
          tools: expertTools,
          model,
          clusterData,
          analysisPrompt,
          emitStreamEvent,
          logger,
          threadId,
        });
        content = result.analysis;
      } else {
        // LLM-only mode: existing model.invoke() behavior
        const messages = [new SystemMessage(expert.systemPrompt), new HumanMessage(analysisPrompt)];

        const response = await model.invoke(messages);
        content = extractText(response.content);
      }

      // Emit complete status
      emitStreamEvent({
        type: "debate-expert-response",
        threadId,
        expertId: expert.id,
        expertName: expert.name,
        content,
        status: "complete",
      });

      results.set(expert.id, content);

      logger.info(`[ExpertPanel] Expert ${expert.id} analysis complete`, {
        contentLength: content.length,
        mode: useReactMode ? "react" : "llm-only",
      });
    } catch (error: any) {
      logger.error(`[ExpertPanel] Expert ${expert.id} failed:`, error);

      const errorContent = `[Analysis failed: ${error.message ?? "Unknown error"}]`;
      results.set(expert.id, errorContent);

      emitStreamEvent({
        type: "debate-expert-response",
        threadId,
        expertId: expert.id,
        expertName: expert.name,
        content: errorContent,
        status: "complete",
      });
    }
  });

  await Promise.all(promises);
  return results;
}

// ============================================
// Expert ReAct Loop
// ============================================

interface ExpertReactLoopOptions {
  expert: ExpertRole;
  tools: StructuredToolInterface[];
  model: BaseChatModel;
  /** Main agent's collected cluster data (tool results) */
  clusterData: string;
  /** Analysis prompt (includes cluster data + user query) */
  analysisPrompt: string;
  emitStreamEvent: EmitFn;
  logger: Logger;
  threadId: string;
  /** Max tool-use iterations (default: 5) */
  maxIterations?: number;
}

interface ExpertReactLoopResult {
  analysis: string;
  additionalToolResults: string[];
}

/**
 * Run an independent ReAct loop for a single expert.
 *
 * Unlike the main ReAct loop:
 * - No text streaming (expert text is buffered, sent via debate-expert-response)
 * - HITL fixed to read_only (reads auto-execute, writes blocked)
 * - No session management, no ChunkBuffer/ThinkingFilter
 * - No expert panel recursion
 * - Lower iteration limit (5 vs 15)
 */
async function runExpertReactLoop(opts: ExpertReactLoopOptions): Promise<ExpertReactLoopResult> {
  const { expert, tools, model, analysisPrompt, emitStreamEvent, logger, maxIterations = 5 } = opts;

  const additionalToolResults: string[] = [];

  // Build initial messages
  const messages: BaseMessage[] = [
    new SystemMessage(expert.systemPrompt),
    new HumanMessage(
      `${analysisPrompt}\n\n` +
        `You have access to tools for additional investigation. ` +
        `Use them if you need more data to support your analysis. ` +
        `When your analysis is complete, respond with your findings without calling any tools.`,
    ),
  ];

  const boundModel = (model as any).bindTools(tools);
  let iteration = 0;
  let finalAnalysis = "";

  while (iteration < maxIterations) {
    iteration++;
    logger.info(`[ExpertReact] ${expert.id} iteration ${iteration}/${maxIterations}`);

    // Invoke model (non-streaming — expert text is buffered)
    const rawAiMessage = await boundModel.invoke(messages);
    // Sanitize: strip tool_use from content array to prevent duplicate tool_use blocks
    const aiMessage = sanitizeExpertAIMessage(rawAiMessage);
    messages.push(aiMessage);

    // Check for tool calls
    const toolCalls = aiMessage.tool_calls ?? [];
    if (toolCalls.length === 0) {
      // No tool calls — analysis complete
      finalAnalysis = extractText(aiMessage.content);
      break;
    }

    // Process tool calls
    for (const toolCall of toolCalls) {
      const toolName = toolCall.name;
      const toolInput = toolCall.args ?? {};
      const toolCallId = toolCall.id ?? `expert-${expert.id}-${Date.now()}`;

      // HITL check: read_only — block writes, auto-execute reads
      const approvalInfo = getToolApprovalInfo(toolName, toolInput, "read_only");

      if (approvalInfo.requiresApproval) {
        // Write operation — block it
        logger.info(`[ExpertReact] ${expert.id} blocked write tool: ${toolName}`);

        messages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            name: toolName,
            content:
              `[Blocked] Write operations are not allowed for expert agents. ` +
              `Please complete your analysis using the data already available ` +
              `or use read-only tools for additional investigation.`,
          }),
        );

        emitStreamEvent({
          type: "tool-execution",
          toolName,
          status: "error",
          error: `Blocked: expert ${expert.id} attempted write operation`,
        });

        continue;
      }

      // Read operation — execute
      emitStreamEvent({
        type: "tool-execution",
        toolName,
        status: "started",
        input: toolInput,
      });

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
        const resultStr = typeof result === "string" ? result : JSON.stringify(result);
        additionalToolResults.push(`[${expert.id}] ${toolName}: ${resultStr.slice(0, 500)}`);

        messages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            name: toolName,
            content: resultStr,
          }),
        );

        emitStreamEvent({
          type: "tool-execution",
          toolName,
          status: "completed",
          result: resultStr,
        });
      } catch (toolError: any) {
        logger.error(`[ExpertReact] ${expert.id} tool error:`, toolName, toolError);

        messages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            name: toolName,
            content: JSON.stringify({
              status: "error",
              message: toolError.message ?? "Tool execution failed",
            }),
          }),
        );

        emitStreamEvent({
          type: "tool-execution",
          toolName,
          status: "error",
          error: toolError.message,
        });
      }
    }

    // If max iterations reached, extract analysis from last AI message
    if (iteration >= maxIterations) {
      logger.warn(`[ExpertReact] ${expert.id} reached max iterations`);
      finalAnalysis =
        extractText(aiMessage.content) ||
        `[Expert ${expert.id} reached iteration limit. Partial analysis based on collected data.]`;
    }
  }

  return { analysis: finalAnalysis, additionalToolResults };
}

/**
 * Run the synthesizer with streaming output
 */
async function runSynthesizer(
  model: BaseChatModel,
  expertAnalyses: Map<string, string>,
  experts: ExpertRole[],
  clusterData: string,
  userQuery: string,
  emitStreamEvent: EmitFn,
  logger: Logger,
  threadId: string,
  messageId: string,
  commandContext?: { purpose: string; outputFormat?: string },
): Promise<string> {
  // Build the synthesizer input with all expert analyses
  const expertInputs = experts
    .map((e) => {
      const analysis = expertAnalyses.get(e.id) ?? "(no analysis)";
      return `### ${e.name} (${e.focusAreas.join(", ")}):\n${analysis}`;
    })
    .join("\n\n---\n\n");

  const synthesisPrompt = `## Original User Query
${userQuery}

## Cluster Data Summary
${clusterData.slice(0, 3000)}${clusterData.length > 3000 ? "\n...(truncated)" : ""}

## Expert Analyses

${expertInputs}

Synthesize the above expert analyses into a unified, actionable report.`;

  const messages = [new SystemMessage(buildSynthesizerPrompt(commandContext)), new HumanMessage(synthesisPrompt)];

  logger.info("[ExpertPanel] Starting synthesis");

  // Stream the synthesizer output
  let synthesis = "";

  try {
    const stream = await (model as any).stream(messages);

    for await (const chunk of stream) {
      if (chunk.content) {
        const text = extractText(chunk.content);
        if (text) {
          // Handle Anthropic cumulative chunks
          let delta = text;
          if (synthesis.length > 0 && text.startsWith(synthesis)) {
            delta = text.slice(synthesis.length);
          }

          if (delta) {
            synthesis += delta;
            emitStreamEvent({
              type: "message-chunk",
              chunk: delta,
              messageId,
            });
          }
        }
      }
    }
  } catch (error: any) {
    logger.error("[ExpertPanel] Synthesis streaming failed:", error);

    // Fallback: try non-streaming invoke
    try {
      const response = await model.invoke(messages);
      synthesis = extractText(response.content);

      emitStreamEvent({
        type: "message-chunk",
        chunk: synthesis,
        messageId,
      });
    } catch (fallbackError: any) {
      logger.error("[ExpertPanel] Synthesis fallback also failed:", fallbackError);
      synthesis = "[Synthesis failed. Individual expert analyses are available above.]";
    }
  }

  return synthesis;
}
