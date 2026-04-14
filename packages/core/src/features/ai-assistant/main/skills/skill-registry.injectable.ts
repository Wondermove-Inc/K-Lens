/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import * as path from "path";
import directoryForUserDataInjectable from "../../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { SkillRegistry } from "./skill-registry";

const skillRegistryInjectable = getInjectable({
  id: "ai-assistant-skill-registry",
  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const userDataDir = di.inject(directoryForUserDataInjectable);
    const skillsDir = path.join(userDataDir, "ai-skills");

    return new SkillRegistry(skillsDir, logger);
  },
  lifecycle: lifecycleEnum.singleton,
});

export default skillRegistryInjectable;
