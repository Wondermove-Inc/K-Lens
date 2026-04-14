/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Agent 스트림 채널 리스너 (Renderer)
 *
 * Main Process에서 전송된 Agent 스트림 이벤트를 수신합니다.
 * AgentIPCClient에 이벤트를 전달합니다.
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Phase 2 Extension Host 패턴)
 * - 2026-01-18: 수정 - Root Frame 전용 가드 추가
 *               (IPC가 Root Frame + Cluster Frame 양쪽에 브로드캐스트되어 중복 처리 문제 해결)
 * - 2026-01-18: 재수정 - URL 기반 프레임 구분으로 변경
 *               (window.top 체크가 Electron IPC 콜백에서 신뢰할 수 없어 URL 패턴으로 변경)
 */

import { getMessageChannelListenerInjectable } from "@skuberplus/messaging";
import { getClusterIdFromHost } from "../../../common/utils";
import { type AgentStreamEvent, agentStreamChannel } from "../common/agent-ipc-channels";
import agentStreamEventBusInjectable from "./agent-stream-event-bus.injectable";

/**
 * 🎯 Root Frame 여부 확인 (URL 기반)
 *
 * Cluster Frame URL: //{clusterId}.{host} (예: abc123.localhost:3000)
 * Root Frame URL: //{host} (예: localhost:3000)
 *
 * getClusterIdFromHost()가 undefined를 반환하면 Root Frame입니다.
 *
 * ⚠️ 이전 방식 (window.top === window)은 Electron IPC 콜백에서
 * 신뢰할 수 없어 URL 패턴 기반으로 변경했습니다.
 */
const isRootFrame = (): boolean => {
  const clusterId = getClusterIdFromHost(window.location.host);
  // clusterId가 없으면 Root Frame
  return clusterId === undefined;
};

/**
 * 🎯 Agent 스트림 채널 리스너
 *
 * Main → Renderer로 전송되는 스트림 이벤트를 수신합니다.
 *
 * ⚠️ 중요: Root Frame에서만 이벤트를 처리합니다.
 * IPC 메시지는 모든 Renderer webContents에 브로드캐스트되므로,
 * Cluster Frame에서는 이벤트를 무시하여 중복 처리를 방지합니다.
 */
const agentStreamListenerInjectable = getMessageChannelListenerInjectable({
  channel: agentStreamChannel,
  id: "agent-stream-listener",
  getHandler: (di) => {
    const eventBus = di.inject(agentStreamEventBusInjectable);

    return (event: AgentStreamEvent) => {
      // 🎯 Root Frame에서만 이벤트 처리
      // Cluster Frame (iframe)에서는 무시하여 중복 처리 방지
      if (!isRootFrame()) {
        return;
      }

      // 이벤트 버스를 통해 구독자들에게 전달
      eventBus.emit(event);
    };
  },
});

export default agentStreamListenerInjectable;
