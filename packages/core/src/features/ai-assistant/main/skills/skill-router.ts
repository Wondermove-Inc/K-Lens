/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Skill Router
 *
 * Maps slash command names to Skill implementations.
 * Supports both built-in (MD-based) and custom (JSON-loaded) skills.
 * Unregistered commands fall through to the existing react-loop path.
 */

import { syncSlashCommandEnabled } from "../../common/slash-commands";
import { AlertAnalyzeSkill } from "./alert-analyze-skill";
import { REACT_SKILL_CONFIGS } from "./command-configs";
import { buildPromptFromBehavior, ReactSkill } from "./react-skill";

import type { Skill } from "./skill";
import type { SkillRegistry } from "./skill-registry";

export class SkillRouter {
  private skills = new Map<string, Skill>();

  register(skill: Skill): void {
    this.skills.set(skill.manifest.id, skill);
  }

  resolve(commandName: string): Skill | undefined {
    const id = commandName.startsWith("/") ? commandName.slice(1) : commandName;
    return this.skills.get(id);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Rebuild the router from built-in + custom skills.
   * Called on initialization and when SkillRegistry changes.
   */
  async rebuild(registry: SkillRegistry): Promise<void> {
    this.skills.clear();

    // 1. Register built-in skills that have dedicated classes
    this.register(new AlertAnalyzeSkill());

    // 2. Register built-in ReAct skills (from MD files — includes assessment, diagnose)
    for (const config of REACT_SKILL_CONFIGS) {
      this.register(new ReactSkill(config));
    }

    // 3. Load custom/overridden skills from registry
    const allSkills = await registry.getAll();
    const disabledIds = new Set<string>();

    for (const def of allSkills) {
      // Skip disabled skills
      if (def.enabled === false) {
        this.skills.delete(def.id);
        disabledIds.add(def.id);
        continue;
      }

      // Custom or overridden skills → create ReactSkill from definition
      if (def.behavior) {
        this.register(
          new ReactSkill({
            manifest: {
              id: def.id,
              name: def.name,
              description: def.description,
              category: def.category,
            },
            promptContent: buildPromptFromBehavior(def.id, def.behavior),
          }),
        );
      }
    }

    // 4. Sync disabled state to slash command palette
    syncSlashCommandEnabled(disabledIds);
  }
}
