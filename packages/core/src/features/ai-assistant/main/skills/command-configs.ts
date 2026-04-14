/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Command Behavior Configs for ReactSkill
 *
 * Loads skill configurations from MD files via md-loader.
 * Each config creates a ReactSkill instance via skill-router.injectable.ts.
 */

import { getAllSkills } from "../../agents/md-loader";

import type { ReactSkillConfig } from "./react-skill";

/** React skill IDs (skills that use ReactSkill, not expert-panel dedicated classes) */
const REACT_SKILL_IDS = [
  "pods",
  "deployments",
  "services",
  "logs",
  "metrics",
  "events",
  "solve",
  "devops",
  "finops",
  "research",
  "assessment",
  "diagnose",
];

/**
 * Build ReactSkillConfig array from MD files.
 * Only includes react-type skills (not assess/diagnose which have dedicated classes).
 */
function buildReactSkillConfigs(): ReactSkillConfig[] {
  const allSkills = getAllSkills();
  const configs: ReactSkillConfig[] = [];

  for (const id of REACT_SKILL_IDS) {
    const doc = allSkills.get(id);
    if (!doc) continue;

    configs.push({
      manifest: {
        id: doc.meta.id,
        name: doc.meta.name,
        description: doc.meta.description,
        category: doc.meta.category,
      },
      promptContent: doc.content,
    });
  }

  return configs;
}

export const REACT_SKILL_CONFIGS: ReactSkillConfig[] = buildReactSkillConfigs();
