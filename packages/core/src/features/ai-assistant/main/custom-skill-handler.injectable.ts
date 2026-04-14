/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 *
 * Custom Skill IPC Handler
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import {
  deleteCustomSkillFile,
  getAllCustomSkills,
  invalidateMdCache,
  MAX_CUSTOM_SKILLS,
  readCustomSkill,
  saveCustomSkill,
  setUserOverrideDir,
} from "../agents/md-loader";
import {
  type CustomSkillInfo,
  type CustomSkillRequest,
  type CustomSkillResponse,
  customSkillChannel,
} from "../common/custom-skill-channels";

/**
 * Build MD content string from parts
 */
function buildMdContent(id: string, name: string, description: string, content: string, enabled = true): string {
  return [
    "---",
    `id: ${id}`,
    `name: "${name}"`,
    `description: "${description}"`,
    `enabled: ${enabled}`,
    "---",
    "",
    content,
  ].join("\n");
}

const customSkillHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-custom-skill-handler",
  channel: customSkillChannel,
  getHandler: (di) => {
    // 🎯 직접 userDataDir를 가져와서 setUserOverrideDir 호출
    // agent-host가 아직 초기화되지 않았을 수 있으므로 여기서도 보장
    const userDataDir = di.inject(directoryForUserDataInjectable);

    if (userDataDir) {
      setUserOverrideDir(userDataDir);
    }

    return async (request: CustomSkillRequest): Promise<CustomSkillResponse> => {
      try {
        switch (request.type) {
          case "list": {
            const all = getAllCustomSkills();
            const skills: CustomSkillInfo[] = [];

            for (const [id, doc] of all) {
              skills.push({
                id,
                name: doc.meta.name || id,
                description: doc.meta.description || "",
                enabled: doc.meta.enabled !== false,
                content: doc.content,
              });
            }

            return { type: "list", skills, maxSkills: MAX_CUSTOM_SKILLS };
          }

          case "get": {
            const doc = readCustomSkill(request.id);

            if (!doc) {
              return { type: "error", error: `Skill not found: ${request.id}` };
            }

            return {
              type: "get",
              skill: {
                id: request.id,
                name: doc.meta.name || request.id,
                description: doc.meta.description || "",
                enabled: doc.meta.enabled !== false,
                content: doc.content,
              },
            };
          }

          case "save": {
            // Check max limit for new skills
            const existing = getAllCustomSkills();

            if (!existing.has(request.id) && existing.size >= MAX_CUSTOM_SKILLS) {
              return { type: "error", error: `Maximum ${MAX_CUSTOM_SKILLS} custom skills allowed` };
            }

            const md = buildMdContent(
              request.id,
              request.name,
              request.description,
              request.content,
              request.enabled ?? true,
            );

            saveCustomSkill(request.id, md);

            return { type: "saved", success: true };
          }

          case "delete": {
            const deleted = deleteCustomSkillFile(request.id);

            if (!deleted) {
              return { type: "error", error: `Failed to delete skill: ${request.id}` };
            }

            return { type: "deleted", success: true };
          }

          case "toggle": {
            const doc = readCustomSkill(request.id);

            if (!doc) {
              return { type: "error", error: `Skill not found: ${request.id}` };
            }

            const md = buildMdContent(
              request.id,
              doc.meta.name || request.id,
              doc.meta.description || "",
              doc.content,
              request.enabled,
            );

            saveCustomSkill(request.id, md);
            invalidateMdCache();

            return { type: "toggled", success: true };
          }

          default:
            return { type: "error", error: "Unknown request type" };
        }
      } catch (error) {
        return {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    };
  },
});

export default customSkillHandlerInjectable;
