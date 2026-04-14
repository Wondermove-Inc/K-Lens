/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * ReAct Agent System Prompts
 *
 * Builds system prompts for the single ReAct loop agent.
 * - K8s operations expert persona (from SOUL.md)
 * - Safety rules
 * - Slash command behavior injection (from skill MDs)
 * - Diagnostic approach guide
 */

import { buildCustomSkillsPrompt, getSkillPrompt, getSoulPrompt, getToolsPrompt } from "../../agents/md-loader";
import {
  buildPersonalizationPrompt,
  PERSONALIZATION_REMINDER,
} from "../../common/prompts/partials/user-personalization";

import type { AgentContext, SlashCommandInfo } from "../../common/agent-ipc-channels";
import type { PlanSnapshot } from "../../common/plan-types";
import type { ClusterWorkspaceContext, UserProfile } from "../../common/user-profile-types";
import type { ConversationLogger } from "../conversation-logger";

/**
 * Build system prompt for the ReAct agent
 */
export async function buildSystemPrompt(
  threadId: string,
  context: AgentContext,
  options?: {
    slashCommand?: SlashCommandInfo;
    conversationLogger?: ConversationLogger;
    userProfile?: Readonly<UserProfile>;
    /** 현재 클러스터의 워크스페이스 컨텍스트 */
    clusterContext?: Readonly<ClusterWorkspaceContext>;
  },
): Promise<string> {
  const parts: string[] = [];

  // Core persona from SOUL.md
  parts.push(getSoulPrompt());

  // 🎯 v3: 개인화는 TOOLS.md 직전으로 이동 (recency bias 최대화)

  // Previous plan context
  if (options?.conversationLogger) {
    const previousPlan = await getPreviousPlanSnapshot(threadId, options.conversationLogger);
    if (previousPlan) {
      const completedCount = previousPlan.steps.filter((s) => s.status === "completed").length;
      const stepsList = previousPlan.steps
        .map((step, idx) => `${idx + 1}. [${step.status}] ${step.description || step.title}`)
        .join("\n");

      parts.push(`
## Previous Plan Context
The user has an active plan in this conversation:
- **Title**: ${previousPlan.title}
- **Status**: ${previousPlan.status} (${completedCount} of ${previousPlan.steps.length} steps completed)
- **Current Step**: ${previousPlan.currentStepIndex + 1} of ${previousPlan.steps.length}

**Steps**:
${stepsList}

If the user refers to "the plan", "previous plan", or similar expressions in any language, use this context.`);
    }
  }

  // Cluster/namespace context
  if (context.clusterId) {
    parts.push(`\nCurrent cluster ID: ${context.clusterId}`);
  }
  if (context.namespace) {
    parts.push(`Current namespace: ${context.namespace}`);
  }
  if (context.openedResource) {
    parts.push(
      `\nCurrently viewing: ${context.openedResource.kind}/${context.openedResource.name}` +
        (context.openedResource.namespace ? ` in namespace ${context.openedResource.namespace}` : ""),
    );
  }

  // Attached contexts (mentions)
  if (context.attachedContexts && context.attachedContexts.length > 0) {
    parts.push("\n## Selected Resources (User Context):");
    parts.push("The user has specifically selected the following resources for this conversation:");
    context.attachedContexts.forEach((ctx, index) => {
      const nsInfo = ctx.namespace ? ` (namespace: ${ctx.namespace})` : "";
      parts.push(`${index + 1}. ${ctx.type}/${ctx.name}${nsInfo}`);
    });
    parts.push("Please focus your analysis and actions on these selected resources.");
  }

  // 🎯 커스텀 skill 상시 주입 (보편적 패턴)
  const customSkillsPrompt = buildCustomSkillsPrompt();
  if (customSkillsPrompt) {
    parts.push(customSkillsPrompt);
  }

  // Slash command behavior — inject from skill MD
  if (options?.slashCommand?.behavior) {
    const slashCommand = options.slashCommand;
    const skillDoc = getSkillPrompt(slashCommand.commandName.replace(/^\//, ""));

    if (skillDoc) {
      // Use pre-assembled MD content directly
      parts.push(skillDoc.content);
    } else {
      // Fallback: build from behavior object (for user-defined JSON skills)
      const behavior = slashCommand.behavior!;
      parts.push("\n## Command Behavior Guidelines:");
      parts.push(`You are executing the "/${slashCommand.commandName}" command.`);

      if (behavior.purpose) {
        parts.push(`\n### Purpose:\n${behavior.purpose}`);
      }

      if (behavior.workflow && behavior.workflow.length > 0) {
        parts.push("\n### Workflow Steps:");
        behavior.workflow.forEach((step) => {
          parts.push(`Step ${step.step} - ${step.name}: ${step.description}`);
        });
      }

      if (behavior.actions && behavior.actions.length > 0) {
        parts.push("\n### Required Actions:");
        behavior.actions.forEach((action) => {
          parts.push(`- ${action}`);
        });
      }

      if (behavior.allowedTools && behavior.allowedTools.length > 0) {
        parts.push("\n### Allowed Tools:");
        parts.push(`You may use these tools: ${behavior.allowedTools.join(", ")}`);
      }

      if (behavior.outputFormat) {
        parts.push(`\n### Output Format:\n${behavior.outputFormat}`);
      }

      if (behavior.options && behavior.options.length > 0) {
        parts.push("\n### Available Options:");
        behavior.options.forEach((opt) => {
          const defaultInfo = opt.defaultValue !== undefined ? ` (default: ${opt.defaultValue})` : "";
          parts.push(`- --${opt.name}: ${opt.description}${defaultInfo}`);
        });
      }

      if (behavior.examples && behavior.examples.length > 0) {
        parts.push("\n### Usage Examples:");
        behavior.examples.forEach((example) => {
          parts.push(`- ${example}`);
        });
      }

      if (behavior.relatedCommands && behavior.relatedCommands.length > 0) {
        parts.push("\n### Related Commands:");
        parts.push(`After completing this task, you may suggest: ${behavior.relatedCommands.join(", ")}`);
      }

      parts.push(`
### Post-Workflow Instructions
After completing the required workflow steps above, check if the user's input contains additional requests beyond the command itself.
If so, fulfill them using available tools after the main workflow is complete.
⚠️ Do NOT call save_to_cluster again if you already saved the report in a previous step.
The command arguments may contain BOTH the target AND additional user instructions - process them accordingly.`);

      // Expert Panel mode hint with data collection checklist
      if (behavior.expertPanel) {
        let querySection = "";
        if (behavior.dataQueries?.length) {
          const queryList = behavior.dataQueries.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n");
          querySection = `\n\n**Recommended Data Queries** (cover as many as relevant):\n${queryList}\n\nRun these across MULTIPLE iterations (3-5 tool calls per iteration).\nSkip queries that are not relevant to the user's request or cluster configuration.\nDo NOT stop after a single batch — aim for thorough coverage.`;
        }

        parts.push(`
### Expert Panel Mode
After gathering cluster data, an expert panel (Security, Performance, Reliability)
will analyze the data from multiple perspectives and produce a unified report.
Your ONLY job is to collect comprehensive cluster data. Do NOT produce your own analysis.
The expert panel will handle all analysis automatically.${querySection}`);
      }

      parts.push("\nFollow these guidelines while responding to the user's request.");
    }
  }

  // 🎯 v3: 유저 개인화 컨텍스트 (TOOLS.md 직전 = system prompt 끝부분, recency bias 최대화)
  if (options?.userProfile) {
    const personalization = buildPersonalizationPrompt(options.userProfile, options?.clusterContext);

    if (personalization) {
      parts.push(`\n${personalization}`);
    }
  }

  // File management + Tool descriptions from TOOLS.md
  parts.push(getToolsPrompt());

  // 🎯 v3: 개인화 리마인더 (system prompt 맨 끝 = user message 직전, recency bias 최대화)
  if (options?.userProfile) {
    const hasMemories = (options.userProfile.memories ?? []).length > 0;
    const hasFeedback = (options.userProfile.feedbackHistory ?? []).some((f) => f.rating === "negative");

    if (hasMemories || hasFeedback) {
      parts.push(`\n${PERSONALIZATION_REMINDER}`);
    }
  }

  return parts.join("\n");
}

/**
 * Get previous plan snapshot from conversation logger
 */
export async function getPreviousPlanSnapshot(
  threadId: string,
  conversationLogger: ConversationLogger,
): Promise<PlanSnapshot | null> {
  try {
    const messages = await conversationLogger.getThreadMessages(threadId);

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg.planSnapshot) continue;

      const snapshot = msg.planSnapshot;
      if (snapshot.status === "completed" || snapshot.status === "rejected") continue;
      if (snapshot.conversationId !== threadId) continue;

      return snapshot;
    }

    return null;
  } catch {
    return null;
  }
}
