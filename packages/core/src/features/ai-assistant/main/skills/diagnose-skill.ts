/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Diagnose Skill — /diagnose command implementation
 *
 * Workflow:
 * 1. Data Collection: Run ReAct loop with diagnosis-focused prompt (from diagnose.md)
 * 2. Expert Panel Analysis: Feed collected data to multi-expert panel
 * 3. Return synthesized diagnostic report
 */

import { ToolMessage } from "@langchain/core/messages";
import { getSkillPrompt } from "../../agents/md-loader";
import { runReactLoop } from "../agent/react-loop";
// import { runExpertPanel } from "../agent/expert-panel"; // TODO: re-enable
import { buildBasePrompt } from "./skill-prompts";

import type { BaseMessage } from "@langchain/core/messages";

import type { Skill, SkillContext, SkillManifest, SkillResult } from "./skill";

// ============================================
// Diagnose Skill
// ============================================

export class DiagnoseSkill implements Skill {
  readonly manifest: SkillManifest = {
    id: "diagnose",
    name: "Resource Diagnose",
    description: "Diagnose Kubernetes resource issues with multi-expert analysis",
    category: "diagnostics",
  };

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { logger } = ctx;
    logger.info("[DiagnoseSkill] Starting /diagnose skill execution");

    // Phase 1: Data Collection via pure ReAct loop
    const systemPrompt = this.buildDataCollectionPrompt(ctx);

    const reactResult = await runReactLoop(
      {
        logger: ctx.logger,
        sessionManager: ctx.sessionManager,
        emitStreamEvent: ctx.emitStreamEvent,
        getHitlLevel: ctx.getHitlLevel,
        onInterrupt: ctx.onInterrupt,
        getAutoApprovalRules: ctx.getAutoApprovalRules,
      },
      {
        threadId: ctx.threadId,
        model: ctx.model as any,
        tools: ctx.tools,
        systemPrompt,
        userMessage: ctx.userMessage,
        assistantMessageId: ctx.assistantMessageId,
        context: ctx.context,
        provider: ctx.provider,
        maxIterations: ctx.maxIterations ?? 25,
        existingMessages: ctx.existingMessages,
      },
    );

    logger.info("[DiagnoseSkill] /diagnose skill execution complete");

    return reactResult;
  }

  private buildDataCollectionPrompt(ctx: SkillContext): string {
    const skillDoc = getSkillPrompt("diagnose");
    const promptContent = skillDoc?.content ?? "";

    return buildBasePrompt(ctx) + "\n" + promptContent;
  }

  // @ts-ignore temporarily unused — expert panel disabled
  private extractToolResults(messages: BaseMessage[]): string {
    const toolResults: string[] = [];

    for (const msg of messages) {
      if (msg instanceof ToolMessage) {
        const name = (msg as any).name ?? "tool";
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

        if (content.includes('"status":"error"') || content.length < 10) {
          continue;
        }

        toolResults.push(`### ${name} result:\n${content}`);
      }
    }

    return toolResults.join("\n\n---\n\n");
  }
}
