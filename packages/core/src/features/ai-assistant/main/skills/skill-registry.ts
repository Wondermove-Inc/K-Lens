/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Skill Registry
 *
 * Loads skill definitions from JSON files and merges with built-in skills.
 * Supports CRUD operations for user-defined skills.
 *
 * Priority: User skills (userData/ai-skills/*.json) override built-in skills
 * with the same ID. User skills with unique IDs are appended.
 */

import * as fs from "fs";
import * as path from "path";
import { getEffectiveContent } from "../../agents/md-loader";
import { REACT_SKILL_CONFIGS } from "./command-configs";

import type { Logger } from "@skuberplus/logger";

import type { ReactSkillBehavior } from "./react-skill";

// ============================================
// Types
// ============================================

/** Skill type: "react" for standard ReAct loop, "expert-panel" for multi-expert analysis */
export type SkillType = "react" | "expert-panel";

/** Persistable skill definition (JSON format) */
export interface SkillDefinition {
  /** Unique skill ID (also used as slash command name without /) */
  id: string;
  /** Display name */
  name: string;
  /** Skill description */
  description: string;
  /** Category for grouping */
  category: string;
  /** Skill type */
  type: SkillType;
  /** Version (semver) */
  version?: string;
  /** Whether this skill is enabled (default: true) */
  enabled?: boolean;
  /** Whether this is a built-in skill (set at runtime, not persisted) */
  isBuiltin?: boolean;
  /** Whether a built-in skill has been overridden by user (set at runtime) */
  isOverridden?: boolean;
  /** UI metadata */
  ui?: {
    icon?: string;
    keywords?: string[];
    label?: string;
  };
  /** Behavior config for ReAct skills */
  behavior?: ReactSkillBehavior;
  /** Data queries for expert-panel skills */
  dataQueries?: string[];
  /** Output format for expert panel synthesis */
  outputFormat?: string;
  /** Expert IDs to use (empty = all enabled) */
  expertIds?: string[];
}

// ============================================
// Built-in skill definitions (derived from REACT_SKILL_CONFIGS)
// ============================================

const BUILTIN_REACT_SKILLS: SkillDefinition[] = REACT_SKILL_CONFIGS.map((config) => ({
  id: config.manifest.id,
  name: config.manifest.name,
  description: config.manifest.description,
  category: config.manifest.category,
  type: "react" as SkillType,
  version: "1.0.0",
  enabled: true,
}));

const ALL_BUILTIN_SKILLS = BUILTIN_REACT_SKILLS;

// ============================================
// SkillRegistry Class
// ============================================

export class SkillRegistry {
  private cache: SkillDefinition[] | null = null;

  constructor(
    private readonly skillsDir: string,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all skills (cached, merged from built-in + user skills)
   */
  async getAll(): Promise<SkillDefinition[]> {
    if (this.cache) return this.cache;

    const userSkills = await this.loadUserSkills();
    this.cache = this.mergeSkills(ALL_BUILTIN_SKILLS, userSkills);
    return this.cache;
  }

  /**
   * Get only enabled skills
   */
  async getEnabled(): Promise<SkillDefinition[]> {
    const all = await this.getAll();
    return all.filter((s) => s.enabled !== false);
  }

  /**
   * Save a user skill definition to disk
   */
  async saveUserSkill(skill: SkillDefinition): Promise<void> {
    await this.ensureSkillsDir();

    const filePath = path.join(this.skillsDir, `${skill.id}.json`);
    const toSave: Record<string, unknown> = {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      type: skill.type,
      version: skill.version ?? "1.0.0",
      enabled: skill.enabled ?? true,
      ...(skill.ui ? { ui: skill.ui } : {}),
      ...(skill.behavior ? { behavior: skill.behavior } : {}),
      ...(skill.dataQueries?.length ? { dataQueries: skill.dataQueries } : {}),
      ...(skill.outputFormat ? { outputFormat: skill.outputFormat } : {}),
      ...(skill.expertIds?.length ? { expertIds: skill.expertIds } : {}),
    };

    await fs.promises.writeFile(filePath, JSON.stringify(toSave, null, 2), "utf-8");
    this.logger.info(`[SkillRegistry] Skill saved: ${skill.id}`);
    this.invalidateCache();
  }

  /**
   * Delete a user skill definition from disk
   */
  async deleteUserSkill(id: string): Promise<void> {
    const filePath = path.join(this.skillsDir, `${id}.json`);

    try {
      await fs.promises.unlink(filePath);
      this.logger.info(`[SkillRegistry] Skill deleted: ${id}`);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    this.invalidateCache();
  }

  /**
   * Reset a built-in skill to its default (removes user override)
   */
  async resetSkill(id: string): Promise<void> {
    await this.deleteUserSkill(id);
  }

  /** Invalidate cache (call after any mutation) */
  invalidateCache(): void {
    this.cache = null;
  }

  // ============================================
  // Private methods
  // ============================================

  private async loadUserSkills(): Promise<SkillDefinition[]> {
    try {
      await fs.promises.access(this.skillsDir);
    } catch {
      return [];
    }

    const skills: SkillDefinition[] = [];

    try {
      const files = await fs.promises.readdir(this.skillsDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.skillsDir, file);
          const content = await fs.promises.readFile(filePath, "utf-8");
          const parsed = JSON.parse(content);

          if (this.validateSkillDefinition(parsed)) {
            skills.push(parsed);
          } else {
            this.logger.warn(`[SkillRegistry] Invalid skill file skipped: ${file}`);
          }
        } catch (error) {
          this.logger.warn(`[SkillRegistry] Failed to load skill file: ${file}`, error);
        }
      }
    } catch (error) {
      this.logger.error("[SkillRegistry] Failed to read skills directory", error);
    }

    return skills;
  }

  private mergeSkills(builtinSkills: SkillDefinition[], userSkills: SkillDefinition[]): SkillDefinition[] {
    const userMap = new Map(userSkills.map((s) => [s.id, s]));
    const result: SkillDefinition[] = [];

    for (const builtin of builtinSkills) {
      const userOverride = userMap.get(builtin.id);

      if (userOverride) {
        // Only mark as "Modified" if more than just enabled/disabled changed
        const isOnlyToggle =
          userOverride.name === builtin.name &&
          userOverride.description === builtin.description &&
          userOverride.category === builtin.category;

        result.push({
          ...userOverride,
          isBuiltin: true,
          isOverridden: !isOnlyToggle,
        });
        userMap.delete(builtin.id);
      } else {
        // Check if MD content has been overridden (even without JSON override)
        const hasMdOverride = getEffectiveContent(`skills/${builtin.id}.md`) !== null;

        result.push({
          ...builtin,
          isBuiltin: true,
          isOverridden: hasMdOverride,
        });
      }
    }

    for (const userSkill of userMap.values()) {
      result.push({
        ...userSkill,
        isBuiltin: false,
        isOverridden: false,
      });
    }

    return result;
  }

  private validateSkillDefinition(obj: unknown): obj is SkillDefinition {
    if (typeof obj !== "object" || obj === null) return false;
    const r = obj as Record<string, unknown>;

    const isValid =
      typeof r.id === "string" &&
      r.id.length > 0 &&
      typeof r.name === "string" &&
      r.name.length > 0 &&
      typeof r.category === "string" &&
      (r.type === "react" || r.type === "expert-panel");

    if (!isValid) return false;

    // Validate behavior if present
    if (r.behavior !== undefined) {
      if (typeof r.behavior !== "object" || r.behavior === null) return false;
      const b = r.behavior as Record<string, unknown>;
      if (typeof b.purpose !== "string") return false;
    }

    return true;
  }

  private async ensureSkillsDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.skillsDir, { recursive: true });
    } catch (error: any) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }
}
