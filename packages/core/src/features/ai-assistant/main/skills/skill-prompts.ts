/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Shared Skill Prompt Utilities
 *
 * Base prompt sections shared across all skills:
 * - Core persona (from SOUL.md)
 * - Cluster/namespace context
 * - File management instructions (from TOOLS.md)
 * - Tool descriptions (from TOOLS.md)
 */

import { getSoulPrompt, getToolsPrompt } from "../../agents/md-loader";

import type { SkillContext } from "./skill";

/**
 * Build the base system prompt shared by all skills.
 * Skills append their command-specific sections after this.
 */
export function buildBasePrompt(ctx: SkillContext): string {
  const parts: string[] = [];

  // Core persona from SOUL.md
  parts.push(getSoulPrompt());

  // Cluster/namespace context
  if (ctx.context.clusterId) {
    parts.push(`\nCurrent cluster ID: ${ctx.context.clusterId}`);
  }
  if (ctx.context.namespace) {
    parts.push(`Current namespace: ${ctx.context.namespace}`);
  }
  if (ctx.context.openedResource) {
    parts.push(
      `\nCurrently viewing: ${ctx.context.openedResource.kind}/${ctx.context.openedResource.name}` +
        (ctx.context.openedResource.namespace ? ` in namespace ${ctx.context.openedResource.namespace}` : ""),
    );
  }

  // Attached contexts (mentions)
  if (ctx.context.attachedContexts && ctx.context.attachedContexts.length > 0) {
    parts.push("\n## Selected Resources (User Context):");
    parts.push("The user has specifically selected the following resources for this conversation:");
    ctx.context.attachedContexts.forEach((c, index) => {
      const nsInfo = c.namespace ? ` (namespace: ${c.namespace})` : "";
      parts.push(`${index + 1}. ${c.type}/${c.name}${nsInfo}`);
    });
    parts.push("Please focus your analysis and actions on these selected resources.");
  }

  // File management + Tool descriptions from TOOLS.md
  parts.push(getToolsPrompt());

  // 🎯 슬래시 커맨드 실행 중에는 커스텀 스킬 주입 안 함
  // 슬래시 커맨드는 정해진 동작만 수행해야 하므로 커스텀 스킬이 끼어들면 안 됨

  return parts.join("\n");
}
