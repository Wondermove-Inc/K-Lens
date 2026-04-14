/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Renderer에서 kubectl 실행을 요청하는 injectable
 *
 * IPC 채널을 통해 Main Process에 kubectl 명령 실행을 요청합니다.
 *
 * 🔄 변경이력:
 * - 2025-12-11: 초기 생성 (Tool-Centric 아키텍처 전환)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import { kubectlExecuteChannel, kubectlExecuteInjectionToken } from "../common/kubectl-execute-channel";

/**
 * 🎯 kubectl 실행 요청 injectable
 *
 * Renderer → Main IPC 통신
 */
const kubectlExecuteInjectable = getInjectable({
  id: "ai-assistant-kubectl-execute",
  instantiate: (di) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return (args) => requestFromChannel(kubectlExecuteChannel, args);
  },
  injectionToken: kubectlExecuteInjectionToken,
});

export default kubectlExecuteInjectable;
