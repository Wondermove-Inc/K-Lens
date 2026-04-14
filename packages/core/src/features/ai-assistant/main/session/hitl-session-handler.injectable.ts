/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: HITL 세션 목록 IPC 핸들러
 *
 * Renderer에서 대기 중인 HITL 세션 목록을 조회할 수 있게 합니다.
 * 새로고침/앱 재시작 후 HITL 상태 복원에 사용됩니다.
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Phase 3 HITL 영구 저장)
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import { type HitlSessionInfo, hitlSessionListChannel } from "../../common/agent-ipc-channels";
import agentSessionManagerInjectable from "./agent-session-manager.injectable";

/**
 * 🎯 HITL 세션 목록 IPC 핸들러
 *
 * 대기 중인 HITL 세션 목록을 반환합니다.
 */
const hitlSessionListHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-hitl-session-list-handler",
  channel: hitlSessionListChannel,
  getHandler: (di) => {
    const sessionManager = di.inject(agentSessionManagerInjectable);

    return async (request) => {
      const pendingSessions = sessionManager.getAllPendingHitlSessions();

      // 🎯 클러스터 ID 필터 적용
      const filteredSessions = request.clusterId
        ? pendingSessions.filter((s: any) => s.clusterId === request.clusterId)
        : pendingSessions;

      // 🎯 HitlSessionInfo 형태로 변환
      const sessions: HitlSessionInfo[] = filteredSessions.map((s: any) => ({
        id: s.id,
        threadId: s.threadId,
        interruptType: s.interruptType,
        payload: s.payload,
        createdAt: s.createdAt,
        clusterId: s.clusterId,
        namespace: s.namespace,
      }));

      return { sessions };
    };
  },
});

export default hitlSessionListHandlerInjectable;
