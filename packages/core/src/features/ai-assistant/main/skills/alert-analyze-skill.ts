/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * AlertAnalyze Skill — /alert-analyze command implementation
 *
 * Triggered by the "AI Analysis" button in ClusterAlertsPopover.
 * Performs read-only diagnosis of a specific Kubernetes alert using
 * a focused ReAct loop (maxIterations: 8).
 *
 * Unlike /diagnose, this skill:
 * - Targets a single alert (not broad resource diagnosis)
 * - Uses fewer iterations (cost-efficient)
 * - Skips expert panel (single-pass analysis)
 * - Enforces read-only operations in prompt
 */

import { runReactLoop } from "../agent/react-loop";
import { buildBasePrompt } from "./skill-prompts";

import type { Skill, SkillContext, SkillManifest, SkillResult } from "./skill";

// ============================================
// AlertAnalyze Skill
// ============================================

export class AlertAnalyzeSkill implements Skill {
  readonly manifest: SkillManifest = {
    id: "alert-analyze",
    name: "Alert Analysis",
    description: "Analyze Kubernetes alert and provide advisory",
    category: "diagnostics",
  };

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { logger } = ctx;
    logger.info("[AlertAnalyzeSkill] Starting alert analysis");

    const systemPrompt = this.buildAlertPrompt(ctx);

    const result = await runReactLoop(
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
        maxIterations: ctx.maxIterations ?? 8,
        existingMessages: ctx.existingMessages,
      },
    );

    logger.info("[AlertAnalyzeSkill] Alert analysis complete", {
      contentLength: result.content.length,
    });

    return result;
  }

  private buildAlertPrompt(ctx: SkillContext): string {
    const parts: string[] = [];

    parts.push(buildBasePrompt(ctx));

    parts.push(`
## Command: /alert-analyze
You are executing the "/alert-analyze" command for Kubernetes alert analysis.

### Purpose
Analyze a specific Kubernetes alert and provide root cause analysis with remediation advice.

### IMPORTANT: Read-Only Operations Only
You MUST only use read-only operations. Do NOT modify, delete, scale, or apply any resources.
Allowed operations: get, describe, logs, top, events.
Forbidden operations: delete, apply, patch, edit, scale, drain, cordon, taint.

### Analysis Workflow
1. **Identify the resource** — Parse the alert to determine the affected resource type and name.
2. **Gather current state** — Use kubectl get/describe on the affected resource.
3. **Check events** — Query events related to the resource (kubectl get events --field-selector involvedObject.name={name}).
4. **Check logs** (if Pod) — Retrieve recent logs and previous container logs if applicable.
5. **Check related resources** — Look at parent resources (Deployment, ReplicaSet, StatefulSet) and related services.
6. **Analyze and report** — Synthesize findings into a clear diagnostic report.

### Output Format
Provide your analysis in this structure:

#### Alert Summary
Brief description of what triggered the alert.

#### Current Resource State
Key status fields and conditions.

#### Root Cause Analysis
Most likely cause(s) based on gathered evidence.

#### Recommended Actions
Prioritized steps to resolve the issue, with specific kubectl commands where helpful.

#### Prevention Tips
How to prevent this issue from recurring.`);

    return parts.join("\n");
  }
}
