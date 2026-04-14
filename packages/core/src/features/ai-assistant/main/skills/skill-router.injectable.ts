/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Skill Router DI Registration
 *
 * Creates a SkillRouter and populates it from:
 * - Built-in skills (AssessSkill, DiagnoseSkill, ReactSkill instances)
 * - Custom skills (loaded from SkillRegistry JSON files)
 */

import { getInjectable } from "@ogre-tools/injectable";
import skillRegistryInjectable from "./skill-registry.injectable";
import { SkillRouter } from "./skill-router";

const skillRouterInjectable = getInjectable({
  id: "ai-assistant-skill-router",
  instantiate: async (di) => {
    const skillRegistry = di.inject(skillRegistryInjectable);
    const router = new SkillRouter();

    await router.rebuild(skillRegistry);

    return router;
  },
});

export default skillRouterInjectable;
