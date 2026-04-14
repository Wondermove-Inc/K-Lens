/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 *
 * 🎯 목적: AI 에이전트 설정 편집 Tools
 *
 * AI가 채팅 중 에이전트 설정 MD 파일을 읽고 편집할 수 있는 도구.
 * 화이트리스트 기반 — EDITABLE_CONFIGS에 등록된 파일만 접근 가능.
 * 사용자 커스텀 skill CRUD 도구 추가.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  deleteCustomSkillFile,
  deleteUserOverride,
  EDITABLE_CONFIGS,
  getAllCustomSkills,
  getBundledContent,
  getEffectiveContent,
  readCustomSkill,
  saveCustomSkill,
  writeUserOverride,
} from "../../agents/md-loader";

export function createConfigTools() {
  const configNames = EDITABLE_CONFIGS.map((c) => c.relativePath).join(", ");

  const readConfigTool = tool(
    async ({ name }: { name: string }) => {
      const config = EDITABLE_CONFIGS.find((c) => c.relativePath === name || c.name === name);
      if (!config) {
        return `Unknown config file: ${name}. Available: ${configNames}`;
      }
      const content = getEffectiveContent(config.relativePath);
      const bundled = getBundledContent(config.relativePath);
      const isOverride = content !== null && content !== bundled;
      return `--- ${config.relativePath} (${isOverride ? "customized" : "default"}) ---\n${content ?? bundled}`;
    },
    {
      name: "read_config",
      description:
        "Read an agent configuration file (SOUL.md, TOOLS.md, skills, experts). " + `Available files: ${configNames}`,
      schema: z.object({
        name: z.string().describe("Config file name or relative path (e.g. 'SOUL.md', 'skills/diagnose.md')"),
      }),
    },
  );

  const editConfigTool = tool(
    async ({ name, content }: { name: string; content: string }) => {
      const config = EDITABLE_CONFIGS.find((c) => c.relativePath === name || c.name === name);
      if (!config) {
        return `Unknown config file: ${name}. Available: ${configNames}`;
      }
      writeUserOverride(config.relativePath, content);
      return `Config ${config.relativePath} updated successfully. Changes take effect on next AI conversation.`;
    },
    {
      name: "edit_config",
      description:
        "Edit an agent configuration file. Creates a user override — the bundled default is preserved. " +
        "IMPORTANT: Always read_config first, then modify and pass the full content. " +
        "User can reset to default via Settings UI.",
      schema: z.object({
        name: z.string().describe("Config file name or relative path"),
        content: z.string().describe("Full updated markdown content"),
      }),
    },
  );

  const resetConfigTool = tool(
    async ({ name }: { name: string }) => {
      const config = EDITABLE_CONFIGS.find((c) => c.relativePath === name || c.name === name);
      if (!config) {
        return `Unknown config file: ${name}. Available: ${configNames}`;
      }
      const deleted = deleteUserOverride(config.relativePath);
      if (deleted) {
        return `Config ${config.relativePath} reset to bundled default.`;
      }
      return `Config ${config.relativePath} was already using the default.`;
    },
    {
      name: "reset_config",
      description: "Reset an agent configuration file to its bundled default by removing the user override.",
      schema: z.object({
        name: z.string().describe("Config file name or relative path"),
      }),
    },
  );

  // ============================================
  // 🎯 Custom Skill Tools (보편적 패턴)
  // ============================================

  const listCustomSkillsTool = tool(
    async () => {
      const skills = getAllCustomSkills();
      if (skills.size === 0) {
        return "No custom skills defined. Use create_custom_skill to create one.";
      }
      const lines: string[] = ["Custom Skills:"];
      for (const [id, doc] of skills) {
        const status = doc.meta.enabled !== false ? "✅ enabled" : "❌ disabled";
        lines.push(`- ${id}: ${doc.meta.name} (${status}) — ${doc.meta.description}`);
      }
      return lines.join("\n");
    },
    {
      name: "list_custom_skills",
      description:
        "List all user-defined custom skills with their descriptions and status. " +
        "Custom skills define reusable workflows and procedures (e.g., deployment playbooks, review checklists).",
      schema: z.object({}),
    },
  );

  const createCustomSkillTool = tool(
    async ({
      id,
      name,
      description,
      content: skillContent,
    }: {
      id: string;
      name: string;
      description: string;
      content: string;
    }) => {
      // Validate id
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
        return "Invalid skill ID. Use lowercase letters, numbers, and hyphens only. Must start with letter or number.";
      }

      // Build MD with frontmatter
      const md = [
        "---",
        "id: " + id,
        "name: " + name,
        "description: " + description,
        "enabled: true",
        "---",
        skillContent,
      ].join("\n");

      saveCustomSkill(id, md);
      return (
        'Custom skill "' +
        name +
        '" (id: ' +
        id +
        ") created successfully. It will be available when its description matches the user\'s request."
      );
    },
    {
      name: "create_custom_skill",
      description:
        "Create a new custom skill. The description is the ONLY trigger mechanism — " +
        "it determines when the AI loads and applies this skill. " +
        "Write descriptions that are 'pushy' (assertive about when to activate). " +
        "The content is loaded on-demand via Progressive Disclosure.",
      schema: z.object({
        id: z.string().describe("Unique skill ID (lowercase, hyphens allowed, e.g. 'deploy-workflow')"),
        name: z.string().describe("Display name (e.g. 'Deployment Workflow')"),
        description: z
          .string()
          .describe(
            "Trigger description — the ONLY mechanism that activates this skill. Write it 'pushy' and assertive.\n\n" +
              "MUST include:\n" +
              "1. Concrete trigger conditions: specific situations, symptoms, error messages, user request patterns\n" +
              "2. Boundary conditions: when NOT to use this skill (prevents false positives and overfitting)\n" +
              "3. Bilingual keywords if users may ask in multiple languages\n\n" +
              "PRINCIPLES:\n" +
              "- Generalize: use patterns, not specific values (e.g., 'container restart issues' not 'nginx pod OOMKilled')\n" +
              "- Be pushy: assertively state when the skill MUST be loaded\n" +
              "- Avoid overfitting: don't tie to one narrow scenario\n\n" +
              "GOOD example: 'Systematic diagnosis of pod failures and restart loops. " +
              "MUST USE when: pods in CrashLoopBackOff, OOMKilled, container exit errors, repeated restarts, probe failures. " +
              "DO NOT USE for: simple pod listing, resource creation, or scaling operations.'\n\n" +
              "BAD example: 'Use for Kubernetes troubleshooting' (too vague, triggers on everything)",
          ),
        content: z
          .string()
          .describe(
            "Skill instructions in markdown. Follow the Why-First principle — explain WHY before HOW.\n\n" +
              "Recommended structure:\n" +
              "## When to Apply\n(specific trigger conditions — mirror the description)\n\n" +
              "## Why This Matters\n(context: what goes wrong without this procedure, common mistakes)\n\n" +
              "## Steps\n(numbered procedure, generalized — no hardcoded values)\n" +
              "- Each step should explain the intent, not just the command\n" +
              "- Include decision points: 'If X, do Y; if Z, do W'\n\n" +
              "## Output Requirements\n(format, structure, what to include/exclude)\n\n" +
              "## Boundary\n(what this skill does NOT cover — prevents scope creep)\n\n" +
              "## Examples (optional)\n(input→output pairs showing expected behavior)",
          ),
      }),
    },
  );

  const editCustomSkillTool = tool(
    async ({ id, content: skillContent }: { id: string; content: string }) => {
      const existing = readCustomSkill(id);
      if (!existing) {
        return 'Custom skill "' + id + '" not found. Use list_custom_skills to see available skills.';
      }

      // Preserve frontmatter, update content
      const md = [
        "---",
        "id: " + existing.meta.id,
        "name: " + existing.meta.name,
        "description: " + existing.meta.description,
        "enabled: " + (existing.meta.enabled !== false),
        "---",
        skillContent,
      ].join("\n");

      saveCustomSkill(id, md);
      return 'Custom skill "' + existing.meta.name + '" updated. Changes take effect in the next conversation.';
    },
    {
      name: "edit_custom_skill",
      description:
        "Edit an existing custom skill's content. Use list_custom_skills first to see the current skill, " +
        "then provide the full updated content.",
      schema: z.object({
        id: z.string().describe("Skill ID to edit"),
        content: z.string().describe("Full updated skill content (markdown)"),
      }),
    },
  );

  // retrieve_custom_skill tool 제거 — AI가 read_file로 스킬 MD 파일을 직접 읽는 방식으로 전환
  // (Claude/Codex Agent Skills의 Progressive Disclosure 패턴)

  const deleteCustomSkillTool = tool(
    async ({ id }: { id: string }) => {
      const existing = readCustomSkill(id);
      if (!existing) {
        return 'Custom skill "' + id + '" not found.';
      }
      const deleted = deleteCustomSkillFile(id);
      if (deleted) {
        return 'Custom skill "' + existing.meta.name + '" deleted.';
      }
      return 'Failed to delete skill "' + id + '".';
    },
    {
      name: "delete_custom_skill",
      description: "Delete a user-defined custom skill.",
      schema: z.object({
        id: z.string().describe("Skill ID to delete"),
      }),
    },
  );

  return [
    readConfigTool,
    editConfigTool,
    resetConfigTool,
    listCustomSkillsTool,
    createCustomSkillTool,
    editCustomSkillTool,
    deleteCustomSkillTool,
  ];
}
