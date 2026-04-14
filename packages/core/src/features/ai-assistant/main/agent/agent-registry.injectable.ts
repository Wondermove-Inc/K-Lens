/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import * as path from "path";
import directoryForUserDataInjectable from "../../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { AgentRegistry } from "./agent-registry";

const agentRegistryInjectable = getInjectable({
  id: "ai-assistant-agent-registry",
  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const userDataDir = di.inject(directoryForUserDataInjectable);
    const agentsDir = path.join(userDataDir, "ai-agents");

    return new AgentRegistry(agentsDir, logger);
  },
  lifecycle: lifecycleEnum.singleton,
});

export default agentRegistryInjectable;
