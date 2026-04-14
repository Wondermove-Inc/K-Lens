/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Agent Session Manager DI 등록
 *
 * Main Process에서 Session Manager를 DI 컨테이너에 등록합니다.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { AgentSessionManager, type AgentSessionManagerDependencies } from "./agent-session-manager";

const agentSessionManagerInjectable = getInjectable({
  id: "ai-assistant-agent-session-manager",
  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);

    const dependencies: AgentSessionManagerDependencies = {
      logger,
    };

    const sessionManager = new AgentSessionManager(dependencies);

    logger.info("[AgentSessionManager] Session Manager 초기화 완료");

    return sessionManager;
  },
  lifecycle: lifecycleEnum.singleton,
});

export default agentSessionManagerInjectable;
