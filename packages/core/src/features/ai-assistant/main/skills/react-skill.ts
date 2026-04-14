/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Generic ReAct Skill
 *
 * Configurable skill for simple slash commands that follow the
 * standard pattern: build system prompt → run ReAct loop → return.
 * No Expert Panel, no multi-phase workflow.
 *
 * Used by: /pods, /deployments, /services, /logs, /metrics, /events,
 *          /solve, /devops, /finops, /research
 */

import { runReactLoop } from "../agent/react-loop";
import { buildBasePrompt } from "./skill-prompts";

import type { Skill, SkillContext, SkillManifest, SkillResult } from "./skill";

// ============================================
// Behavior Config (legacy — for user-defined JSON skills)
// ============================================

export interface ReactSkillBehavior {
  purpose: string;
  workflow?: Array<{ step: number; name: string; description: string }>;
  actions?: string[];
  outputFormat?: string;
  options?: Array<{ name: string; description: string; defaultValue?: string | boolean }>;
  examples?: string[];
  relatedCommands?: string[];
  /** Expert panel mode — used by react-prompts.ts fallback path */
  expertPanel?: boolean;
  /** Allowed tools — used by react-prompts.ts fallback path */
  allowedTools?: string[];
  /** Data queries for expert panel — used by react-prompts.ts fallback path */
  dataQueries?: string[];
}

export interface ReactSkillConfig {
  manifest: SkillManifest;
  /** Pre-assembled prompt content from MD (preferred) */
  promptContent?: string;
  /** Legacy behavior config for user-defined JSON skills */
  behavior?: ReactSkillBehavior;
}

/**
 * Build prompt text from a ReactSkillBehavior object.
 * Used for user-defined JSON skills that haven't been converted to MD.
 */
export function buildPromptFromBehavior(id: string, behavior: ReactSkillBehavior): string {
  const parts: string[] = [];

  parts.push(`\n## Command: /${id}`);
  parts.push(`You are executing the "/${id}" command.`);

  if (behavior.purpose) {
    parts.push(`\n### Purpose:\n${behavior.purpose}`);
  }

  if (behavior.workflow?.length) {
    parts.push("\n### Workflow Steps:");
    behavior.workflow.forEach((step) => {
      parts.push(`Step ${step.step} - ${step.name}: ${step.description}`);
    });
  }

  if (behavior.actions?.length) {
    parts.push("\n### Required Actions:");
    behavior.actions.forEach((action) => {
      parts.push(`- ${action}`);
    });
  }

  if (behavior.outputFormat) {
    parts.push(`\n### Output Format:\n${behavior.outputFormat}`);
  }

  if (behavior.options?.length) {
    parts.push("\n### Available Options:");
    behavior.options.forEach((opt) => {
      const defaultInfo = opt.defaultValue !== undefined ? ` (default: ${opt.defaultValue})` : "";
      parts.push(`- --${opt.name}: ${opt.description}${defaultInfo}`);
    });
  }

  if (behavior.examples?.length) {
    parts.push("\n### Usage Examples:");
    behavior.examples.forEach((example) => {
      parts.push(`- ${example}`);
    });
  }

  if (behavior.relatedCommands?.length) {
    parts.push("\n### Related Commands:");
    parts.push(`After completing this task, you may suggest: ${behavior.relatedCommands.join(", ")}`);
  }

  parts.push(`
### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.`);

  parts.push("\nFollow these guidelines while responding to the user's request.");

  return parts.join("\n");
}

// ============================================
// ReactSkill Class
// ============================================

export class ReactSkill implements Skill {
  readonly manifest: SkillManifest;
  private readonly promptContent: string;

  constructor(config: ReactSkillConfig) {
    this.manifest = config.manifest;

    // Prefer pre-assembled MD content; fall back to behavior assembly
    if (config.promptContent) {
      this.promptContent = config.promptContent;
    } else if (config.behavior) {
      this.promptContent = buildPromptFromBehavior(config.manifest.id, config.behavior);
    } else {
      this.promptContent = "";
    }
  }

  async execute(ctx: SkillContext): Promise<SkillResult> {
    ctx.logger.info(`[ReactSkill:${this.manifest.id}] Starting execution`);

    const systemPrompt = this.buildSystemPrompt(ctx);

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
        maxIterations: ctx.maxIterations ?? 25,
        existingMessages: ctx.existingMessages,
      },
    );

    ctx.logger.info(`[ReactSkill:${this.manifest.id}] Execution complete`);
    return result;
  }

  private buildSystemPrompt(ctx: SkillContext): string {
    return buildBasePrompt(ctx) + "\n" + this.promptContent;
  }
}
