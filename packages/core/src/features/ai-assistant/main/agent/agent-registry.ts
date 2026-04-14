/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Agent Registry
 *
 * Loads agent definitions from JSON files and merges with built-in agents.
 * Supports CRUD operations for user-defined agents.
 *
 * Priority: User agents (userData/ai-agents/*.json) override built-in agents
 * with the same ID. User agents with unique IDs are appended.
 */

import * as fs from "fs";
import * as path from "path";
import { BUILTIN_EXPERT_ROLES } from "./expert-personas";

import type { Logger } from "@skuberplus/logger";

import type { ExpertRole } from "./expert-personas";

/** Extended ExpertRole with version and enabled flag for JSON persistence */
export interface AgentDefinition extends ExpertRole {
  /** Agent version (semver) */
  version?: string;
  /** Whether this agent is enabled (default: true) */
  enabled?: boolean;
  /** Whether this is a built-in agent (set at runtime, not persisted) */
  isBuiltin?: boolean;
  /** Whether a built-in agent has been overridden by user (set at runtime) */
  isOverridden?: boolean;
}

export class AgentRegistry {
  private cache: AgentDefinition[] | null = null;

  constructor(
    private readonly agentsDir: string,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all expert agents (cached, merged from built-in + user agents)
   */
  async getExperts(): Promise<AgentDefinition[]> {
    if (this.cache) return this.cache;

    const userAgents = await this.loadUserAgents();
    this.cache = this.mergeAgents(BUILTIN_EXPERT_ROLES, userAgents);
    return this.cache;
  }

  /**
   * Get all agents including disabled ones (for settings UI)
   */
  async getAllAgents(): Promise<AgentDefinition[]> {
    const userAgents = await this.loadUserAgents();
    return this.mergeAgents(BUILTIN_EXPERT_ROLES, userAgents);
  }

  /**
   * Get only enabled agents (for expert panel execution)
   */
  async getEnabledExperts(): Promise<ExpertRole[]> {
    const all = await this.getExperts();
    return all.filter((a) => a.enabled !== false);
  }

  /**
   * Save a user agent definition to disk
   */
  async saveUserAgent(agent: AgentDefinition): Promise<void> {
    await this.ensureAgentsDir();

    const filePath = path.join(this.agentsDir, `${agent.id}.json`);
    const toSave: Record<string, unknown> = {
      id: agent.id,
      name: agent.name,
      version: agent.version ?? "1.0.0",
      systemPrompt: agent.systemPrompt,
      focusAreas: agent.focusAreas,
      enabled: agent.enabled ?? true,
      ...(agent.allowedTools?.length ? { allowedTools: agent.allowedTools } : {}),
      ...(agent.deniedTools?.length ? { deniedTools: agent.deniedTools } : {}),
    };

    await fs.promises.writeFile(filePath, JSON.stringify(toSave, null, 2), "utf-8");
    this.logger.info(`[AgentRegistry] Agent saved: ${agent.id}`);
    this.invalidateCache();
  }

  /**
   * Delete a user agent definition from disk
   */
  async deleteUserAgent(id: string): Promise<void> {
    const filePath = path.join(this.agentsDir, `${id}.json`);

    try {
      await fs.promises.unlink(filePath);
      this.logger.info(`[AgentRegistry] Agent deleted: ${id}`);
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    this.invalidateCache();
  }

  /**
   * Reset a built-in agent to its default (removes user override)
   */
  async resetAgent(id: string): Promise<void> {
    await this.deleteUserAgent(id);
  }

  /** Invalidate cache (call after any mutation) */
  invalidateCache(): void {
    this.cache = null;
  }

  // ============================================
  // Private methods
  // ============================================

  private async loadUserAgents(): Promise<AgentDefinition[]> {
    try {
      await fs.promises.access(this.agentsDir);
    } catch {
      // Directory doesn't exist - no user agents
      return [];
    }

    const agents: AgentDefinition[] = [];

    try {
      const files = await fs.promises.readdir(this.agentsDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.agentsDir, file);
          const content = await fs.promises.readFile(filePath, "utf-8");
          const parsed = JSON.parse(content);

          if (this.validateAgentDefinition(parsed)) {
            agents.push(parsed);
          } else {
            this.logger.warn(`[AgentRegistry] Invalid agent file skipped: ${file}`);
          }
        } catch (error) {
          this.logger.warn(`[AgentRegistry] Failed to load agent file: ${file}`, error);
        }
      }
    } catch (error) {
      this.logger.error("[AgentRegistry] Failed to read agents directory", error);
    }

    return agents;
  }

  private mergeAgents(builtinRoles: ExpertRole[], userAgents: AgentDefinition[]): AgentDefinition[] {
    const userMap = new Map(userAgents.map((a) => [a.id, a]));
    const result: AgentDefinition[] = [];

    // Process built-in agents (user can override)
    for (const builtin of builtinRoles) {
      const userOverride = userMap.get(builtin.id);

      if (userOverride) {
        result.push({
          ...userOverride,
          isBuiltin: true,
          isOverridden: true,
        });
        userMap.delete(builtin.id);
      } else {
        result.push({
          ...builtin,
          version: "1.0.0",
          enabled: true,
          isBuiltin: true,
          isOverridden: false,
        });
      }
    }

    // Append remaining user-only agents
    for (const userAgent of userMap.values()) {
      result.push({
        ...userAgent,
        isBuiltin: false,
        isOverridden: false,
      });
    }

    return result;
  }

  private validateAgentDefinition(obj: unknown): obj is AgentDefinition {
    if (typeof obj !== "object" || obj === null) return false;
    const record = obj as Record<string, unknown>;

    const isValid =
      typeof record.id === "string" &&
      record.id.length > 0 &&
      typeof record.name === "string" &&
      record.name.length > 0 &&
      typeof record.systemPrompt === "string" &&
      Array.isArray(record.focusAreas);

    if (!isValid) return false;

    // Validate optional tool arrays
    if (record.allowedTools !== undefined && !this.isStringArray(record.allowedTools)) return false;
    if (record.deniedTools !== undefined && !this.isStringArray(record.deniedTools)) return false;

    return true;
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }

  private async ensureAgentsDir(): Promise<void> {
    try {
      await fs.promises.mkdir(this.agentsDir, { recursive: true });
    } catch (error: any) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }
}
