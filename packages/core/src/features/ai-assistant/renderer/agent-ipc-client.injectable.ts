/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Agent IPC Client DI 등록 (Renderer)
 *
 * Renderer에서 Agent IPC 클라이언트를 DI 컨테이너에 등록합니다.
 *
 * 📝 의존성:
 * - requestFromChannel: IPC 요청 함수
 * - agentStreamEventBus: 스트림 이벤트 버스
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Phase 2 Extension Host 패턴)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import {
  type AgentRequest,
  agentRequestChannel,
  type HitlLevelSetRequest,
  hitlLevelSetChannel,
  type LogUIMessageRequest,
  logUIMessageChannel,
  type MonitorConfig,
  monitorCheckNowChannel,
  monitorConfigGetChannel,
  monitorConfigSetChannel,
  monitorCustomRuleAddChannel,
  monitorStartChannel,
  monitorStatusChannel,
  monitorStopChannel,
  type ThreadDeleteRequest,
  type ThreadListRequest,
  type ThreadLoadRequest,
  threadDeleteChannel,
  threadListChannel,
  threadLoadChannel,
} from "../common/agent-ipc-channels";
import { userProfileChannel } from "../common/user-profile-channels";
import { AgentIPCClient, type AgentIPCClientDependencies } from "./agent-ipc-client";
import agentStreamEventBusInjectable from "./agent-stream-event-bus.injectable";

/**
 * 🎯 Agent IPC Client Injectable
 *
 * Renderer에서 사용하는 Agent IPC 클라이언트 싱글톤 인스턴스
 */
const agentIPCClientInjectable = getInjectable({
  id: "ai-assistant-agent-ipc-client",
  instantiate: (di) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);
    const agentStreamEventBus = di.inject(agentStreamEventBusInjectable);

    // 🎯 Agent 요청 IPC 함수
    const agentRequest = (request: AgentRequest) => requestFromChannel(agentRequestChannel, request);

    // 🎯 Agent 스트림 구독 함수 (이벤트 버스 사용)
    const agentStreamSubscribe = agentStreamEventBus.subscribe.bind(agentStreamEventBus);

    // 🎯 HITL 레벨 설정 IPC 함수
    const setHitlLevel = (request: HitlLevelSetRequest) => requestFromChannel(hitlLevelSetChannel, request);

    // 🎯 Thread 목록 조회 IPC 함수
    const listThreads = (request: ThreadListRequest) => requestFromChannel(threadListChannel, request);

    // 🎯 Thread 로드 IPC 함수
    const loadThread = (request: ThreadLoadRequest) => requestFromChannel(threadLoadChannel, request);

    // 🎯 Thread 삭제 IPC 함수
    const deleteThread = (request: ThreadDeleteRequest) => requestFromChannel(threadDeleteChannel, request);

    // 🎯 UI 메시지 로깅 IPC 함수
    const logUIMessage = (request: LogUIMessageRequest) => requestFromChannel(logUIMessageChannel, request);

    /**
     * 목적: Monitor 시작 IPC 함수
     */
    const monitorStart = (request: MonitorConfig) => requestFromChannel(monitorStartChannel, request);

    /**
     * 목적: Monitor 중지 IPC 함수
     */
    const monitorStop = () => requestFromChannel(monitorStopChannel, undefined);

    /**
     * 목적: Monitor 설정 저장 IPC 함수
     */
    const monitorSetConfig = (request: MonitorConfig) => requestFromChannel(monitorConfigSetChannel, request);

    /**
     * 목적: Monitor 설정 조회 IPC 함수
     */
    const monitorGetConfig = () => requestFromChannel(monitorConfigGetChannel, undefined);

    /**
     * 목적: Monitor 상태 조회 IPC 함수
     */
    const monitorGetStatuses = () => requestFromChannel(monitorStatusChannel, undefined);

    /**
     * 목적: Monitor 즉시 점검 IPC 함수
     */
    const monitorCheckNow = (clusterId: string) => requestFromChannel(monitorCheckNowChannel, clusterId);

    /**
     * 목적: Monitor 커스텀 룰 추가 IPC 함수
     */
    const monitorAddRule = (description: string) => requestFromChannel(monitorCustomRuleAddChannel, description);

    // 🎯 피드백 전송 IPC 함수
    const sendFeedback = (feedback: any) =>
      requestFromChannel(userProfileChannel, { type: "add-feedback", feedback }).then((res: any) => ({
        success: res?.type === "feedback-added" && res?.success,
      }));

    const dependencies: AgentIPCClientDependencies = {
      agentRequest,
      agentStreamSubscribe,
      setHitlLevel,
      listThreads,
      loadThread,
      deleteThread,
      logUIMessage,
      monitorStart,
      monitorStop,
      monitorSetConfig,
      monitorGetConfig,
      monitorGetStatuses,
      monitorCheckNow,
      monitorAddRule,
      sendFeedback,
    };

    return new AgentIPCClient(dependencies);
  },
});

export default agentIPCClientInjectable;
