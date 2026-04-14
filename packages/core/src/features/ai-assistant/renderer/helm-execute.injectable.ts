/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Renderer에서 Helm 실행을 요청하는 injectable
 *
 * IPC 채널을 통해 Main Process에 Helm 명령 실행을 요청합니다.
 *
 * @description
 * - kubectl-execute.injectable.ts와 동일한 패턴
 * - IPC 채널을 통해 Main Process에 요청 전달
 *
 * 🔄 변경이력:
 * - 2026-01-08: 초기 생성 (Helm 전용 채널 구현)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import { helmExecuteChannel, helmExecuteInjectionToken } from "../common/helm-execute-channel";

/**
 * 🎯 Helm 실행 요청 injectable
 *
 * Renderer → Main IPC 통신
 */
const helmExecuteInjectable = getInjectable({
  id: "ai-assistant-helm-execute",
  instantiate: (di) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return (args) => requestFromChannel(helmExecuteChannel, args);
  },
  injectionToken: helmExecuteInjectionToken,
});

export default helmExecuteInjectable;
