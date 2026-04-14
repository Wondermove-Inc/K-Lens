/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Renderer에서 shell 명령 실행을 요청하는 injectable
 *
 * IPC 채널을 통해 Main Process에 shell 명령 실행을 요청합니다.
 *
 * 🔄 변경이력:
 * - 2025-12-11: 초기 생성 (Tool-Centric 아키텍처 전환)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import { shellExecuteChannel, shellExecuteInjectionToken } from "../common/shell-execute-channel";

/**
 * 🎯 shell 실행 요청 injectable
 *
 * Renderer → Main IPC 통신
 */
const shellExecuteInjectable = getInjectable({
  id: "ai-assistant-shell-execute",
  instantiate: (di) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return (args) => requestFromChannel(shellExecuteChannel, args);
  },
  injectionToken: shellExecuteInjectionToken,
});

export default shellExecuteInjectable;
