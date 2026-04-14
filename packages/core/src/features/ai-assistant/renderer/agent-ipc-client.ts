/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Renderer용 Agent IPC 클라이언트
 *
 * Main Process의 AgentHost와 통신하는 Renderer 클라이언트입니다.
 * UI는 이 클라이언트를 통해 Agent 요청을 전송하고 결과를 수신합니다.
 *
 * 📝 Extension Host 패턴:
 * - Renderer는 "말만 한다" (요청/표시)
 * - Main은 "생각하고 실행한다" (Agent + Tool)
 * - 이 클라이언트는 Renderer의 "말"을 Main으로 전달합니다
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Phase 2 Extension Host 패턴)
 */

import { planState } from "../common/plan-state";

import type { AIProvider } from "../../../common/features/user-preferences/encrypt-api-key-channel";
import type {
  AgentContext,
  AgentRequest,
  AgentRequestFn,
  AgentRequestResponse,
  AgentStreamEvent,
  AgentStreamSubscribeFn,
  HitlLevel,
  HitlLevelSetRequest,
  HitlLevelSetResponse,
  LogUIMessageRequest,
  LogUIMessageResponse,
  MonitorConfig,
  MonitorRule,
  MonitorStatus,
  SlashCommandInfo,
  ThreadDeleteRequest,
  ThreadDeleteResponse,
  ThreadInfo,
  ThreadListRequest,
  ThreadListResponse,
  ThreadLoadRequest,
  ThreadLoadResponse,
  ThreadMessage,
} from "../common/agent-ipc-channels";
import type { FeedbackEntry } from "../common/user-profile-types";

// ============================================
// 🎯 Agent IPC Client 타입
// ============================================

/**
 * 🎯 HITL 레벨 설정 IPC 함수 타입
 */
export type HitlLevelSetFn = (request: HitlLevelSetRequest) => Promise<HitlLevelSetResponse>;

/**
 * 🎯 Thread 목록 조회 IPC 함수 타입
 */
export type ThreadListFn = (request: ThreadListRequest) => Promise<ThreadListResponse>;

/**
 * 🎯 Thread 로드 IPC 함수 타입
 */
export type ThreadLoadFn = (request: ThreadLoadRequest) => Promise<ThreadLoadResponse>;

/**
 * 🎯 Thread 삭제 IPC 함수 타입
 */
export type ThreadDeleteFn = (request: ThreadDeleteRequest) => Promise<ThreadDeleteResponse>;

/**
 * 🎯 UI 메시지 로깅 IPC 함수 타입
 *
 * 📝 2026-01-13: 해결
 */
export type LogUIMessageFn = (request: LogUIMessageRequest) => Promise<LogUIMessageResponse>;

/**
 * 목적: Monitor 시작 함수 타입
 */
export type MonitorStartFn = (request: MonitorConfig) => Promise<void>;

/**
 * 목적: Monitor 중지 함수 타입
 */
export type MonitorStopFn = () => Promise<void>;

/**
 * 목적: Monitor 설정 저장 함수 타입
 */
export type MonitorSetConfigFn = (request: MonitorConfig) => Promise<void>;

/**
 * 목적: Monitor 설정 조회 함수 타입
 */
export type MonitorGetConfigFn = () => Promise<MonitorConfig>;

/**
 * 목적: Monitor 상태 목록 조회 함수 타입
 */
export type MonitorGetStatusesFn = () => Promise<MonitorStatus[]>;

/**
 * 목적: Monitor 즉시 점검 함수 타입
 */
export type MonitorCheckNowFn = (clusterId: string) => Promise<void>;

/**
 * 목적: Monitor 커스텀 룰 추가 함수 타입
 */
export type MonitorAddRuleFn = (description: string) => Promise<MonitorRule>;
export type SendFeedbackFn = (feedback: FeedbackEntry) => Promise<{ success: boolean }>;

export interface AgentIPCClientDependencies {
  /** Agent 요청 IPC 함수 */
  readonly agentRequest: AgentRequestFn;
  /** Agent 스트림 구독 IPC 함수 */
  readonly agentStreamSubscribe: AgentStreamSubscribeFn;
  /** HITL 레벨 설정 IPC 함수 */
  readonly setHitlLevel: HitlLevelSetFn;
  /** Thread 목록 조회 IPC 함수 */
  readonly listThreads: ThreadListFn;
  /** Thread 로드 IPC 함수 */
  readonly loadThread: ThreadLoadFn;
  /** Thread 삭제 IPC 함수 */
  readonly deleteThread: ThreadDeleteFn;
  /** 🆕 UI 메시지 로깅 IPC 함수 */
  readonly logUIMessage: LogUIMessageFn;
  /** 🆕 Monitor 시작 IPC 함수 */
  readonly monitorStart?: MonitorStartFn;
  /** 🆕 Monitor 중지 IPC 함수 */
  readonly monitorStop?: MonitorStopFn;
  /** 🆕 Monitor 설정 저장 IPC 함수 */
  readonly monitorSetConfig?: MonitorSetConfigFn;
  /** 🆕 Monitor 설정 조회 IPC 함수 */
  readonly monitorGetConfig?: MonitorGetConfigFn;
  /** 🆕 Monitor 상태 목록 조회 IPC 함수 */
  readonly monitorGetStatuses?: MonitorGetStatusesFn;
  /** 🆕 Monitor 즉시 점검 IPC 함수 */
  readonly monitorCheckNow?: MonitorCheckNowFn;
  /** 🆕 Monitor 커스텀 룰 추가 IPC 함수 */
  readonly monitorAddRule?: MonitorAddRuleFn;
  /** 🎯 피드백 전송 IPC 함수 */
  readonly sendFeedback?: SendFeedbackFn;
}

// ============================================
// 🎯 Agent IPC Client 클래스
// ============================================

/**
 * 🎯 Renderer용 Agent IPC 클라이언트
 *
 * Main Process의 AgentHost와 IPC를 통해 통신합니다.
 * UI 컴포넌트는 이 클라이언트를 사용해 Agent와 상호작용합니다.
 *
 * @example
 * ```typescript
 * // 메시지 전송
 * const response = await client.sendMessage({
 *   threadId: "thread-1",
 *   message: "Get all pods",
 *   provider: "openai",
 *   context: { clusterId: "cluster-1", namespace: "default" },
 * });
 *
 * // 스트림 구독
 * const unsubscribe = client.subscribeToStream((event) => {
 *   if (event.type === "message-chunk") {
 *     console.log("Chunk:", event.chunk);
 *   }
 * });
 * ```
 */
export class AgentIPCClient {
  /** 현재 구독 해제 함수 */
  private unsubscribe: (() => void) | null = null;

  /** 등록된 이벤트 핸들러들 */
  private eventHandlers: Set<(event: AgentStreamEvent) => void> = new Set();

  constructor(private readonly dependencies: AgentIPCClientDependencies) {
    // 🎯 자동으로 스트림 구독 시작
    this.startStreamSubscription();
  }

  // ============================================
  // 🎯 공개 API
  // ============================================

  /**
   * 🎯 메시지 전송
   *
   * 📝 2026-01-07: 수정 - slashCommand 파라미터 추가
   * - 슬래시 명령어 정보 및 행동 지침을 Main Process에 전달
   *
   * @param params - 전송 파라미터
   * @returns 요청 응답 (실제 결과는 스트림으로 전달)
   */
  async sendMessage(params: {
    threadId: string;
    message: string;
    provider: AIProvider;
    modelId?: string;
    context: AgentContext;
    /** Renderer에서 생성한 Assistant 메시지 ID (스트림 이벤트 매칭용) */
    assistantMessageId: string;
    /** 🆕 슬래시 명령어 정보 (슬래시 명령어 사용 시) */
    slashCommand?: SlashCommandInfo;
  }): Promise<AgentRequestResponse> {
    const request: AgentRequest = {
      type: "send-message",
      threadId: params.threadId,
      message: params.message,
      provider: params.provider,
      modelId: params.modelId,
      context: params.context,
      assistantMessageId: params.assistantMessageId,
      slashCommand: params.slashCommand,
    };

    return this.dependencies.agentRequest(request);
  }

  /**
   * 🎯 Interrupt 재개 (HITL/Clarify 응답)
   *
   * @param params - 재개 파라미터
   * @returns 요청 응답
   */
  async resumeInterrupt(params: {
    threadId: string;
    response: unknown;
    provider: AIProvider;
  }): Promise<AgentRequestResponse> {
    const request: AgentRequest = {
      type: "resume-interrupt",
      threadId: params.threadId,
      response: params.response,
      provider: params.provider,
    };

    return this.dependencies.agentRequest(request);
  }

  /**
   * 🎯 Agent 리셋
   *
   * @param threadId - 특정 스레드 리셋 (없으면 전체)
   * @returns 요청 응답
   */
  async reset(threadId?: string): Promise<AgentRequestResponse> {
    const request: AgentRequest = {
      type: "reset",
      threadId,
    };

    return this.dependencies.agentRequest(request);
  }

  /**
   * 🎯 실행 취소
   *
   * 현재 실행 중인 Agent 작업을 중단합니다.
   *
   * @param threadId - 취소할 스레드 ID
   * @returns 요청 응답
   */
  async cancelExecution(threadId: string): Promise<AgentRequestResponse> {
    const request: AgentRequest = {
      type: "cancel",
      threadId,
    };

    return this.dependencies.agentRequest(request);
  }

  /**
   * 🎯 HITL 레벨 설정
   *
   * Main Process의 HITL 레벨을 동기화합니다.
   *
   * @param level - HITL 레벨
   * @returns 설정 응답
   */
  async setHitlLevel(level: HitlLevel): Promise<HitlLevelSetResponse> {
    return this.dependencies.setHitlLevel({ level });
  }

  // ============================================
  // 🎯 Thread 관련 메서드 (Past Chats UI 연동)
  // ============================================

  /**
   * 🎯 Thread 목록 조회
   *
   * Past Chats UI에서 대화 목록을 조회합니다.
   *
   * @param limit - 최대 개수 (기본: 50)
   * @returns Thread 목록
   */
  async listThreads(limit?: number): Promise<ThreadInfo[]> {
    const response = await this.dependencies.listThreads({ limit });
    return response.threads;
  }

  /**
   * 🎯 Thread 메시지 로드
   *
   * 특정 Thread의 메시지 히스토리를 로드합니다.
   *
   * 📝 2026-02-03: Plan 영속성 개선
   * - 대화방 전환 시 해당 대화방의 Plan 자동 복원
   * - JSONL에서 로드된 planSnapshot으로 planState 초기화
   *
   * @param threadId - Thread ID
   * @returns 메시지 목록
   */
  async loadThread(threadId: string): Promise<{ success: boolean; messages: ThreadMessage[]; error?: string }> {
    const response = await this.dependencies.loadThread({ threadId });

    // 🆕 Plan 복원 로직
    if (response.success && response.messages.length > 0) {
      this.restorePlanFromMessages(response.messages, threadId);
    }

    return {
      success: response.success,
      messages: response.messages,
      error: response.error,
    };
  }

  /**
   * 🎯 Thread 삭제
   *
   * 특정 Thread를 삭제합니다.
   *
   * @param threadId - Thread ID
   * @returns 삭제 결과
   */
  async deleteThread(threadId: string): Promise<{ success: boolean; error?: string }> {
    const response = await this.dependencies.deleteThread({ threadId });
    return {
      success: response.success,
      error: response.error,
    };
  }

  /**
   * 🎯 UI 메시지 로깅
   *
   * 📝 2026-01-13: 해결
   * UI 전용 메시지(tool-approval-result, plan-viewer 등)를
   * 확장 속성과 함께 저장합니다.
   *
   * @param params - 메시지 파라미터
   * @returns 로깅 결과
   */
  async logUIMessage(params: {
    threadId: string;
    role: "user" | "assistant" | "system";
    content: string;
    presentation?: ThreadMessage["presentation"];
    toolApprovalResult?: ThreadMessage["toolApprovalResult"];
    planSnapshot?: ThreadMessage["planSnapshot"];
    planStatusMessageData?: ThreadMessage["planStatusMessageData"];
  }): Promise<{ success: boolean; error?: string }> {
    const response = await this.dependencies.logUIMessage(params);
    return {
      success: response.success,
      error: response.error,
    };
  }

  /**
   * 목적: Monitor 시작
   */
  async monitorStart(config: MonitorConfig): Promise<void> {
    await this.dependencies.monitorStart?.(config);
  }

  /**
   * 목적: Monitor 중지
   */
  async monitorStop(): Promise<void> {
    await this.dependencies.monitorStop?.();
  }

  /**
   * 목적: Monitor 설정 저장
   */
  async monitorSetConfig(config: MonitorConfig): Promise<void> {
    await this.dependencies.monitorSetConfig?.(config);
  }

  /**
   * 목적: Monitor 설정 조회
   */
  async monitorGetConfig(): Promise<MonitorConfig> {
    return (
      this.dependencies.monitorGetConfig?.() ?? {
        enabled: false,
        trayResident: false,
        clusters: [],
        intervalMs: 300_000,
        provider: "anthropic",
        apiKey: "",
        modelId: "claude-sonnet-4-6",
        kubectlPath: "kubectl",
        helmPath: "helm",
      }
    );
  }

  /**
   * 목적: Monitor 상태 목록 조회
   */
  async monitorGetStatuses(): Promise<MonitorStatus[]> {
    return this.dependencies.monitorGetStatuses?.() ?? [];
  }

  /**
   * 목적: Monitor 즉시 점검
   */
  async monitorCheckNow(clusterId: string): Promise<void> {
    await this.dependencies.monitorCheckNow?.(clusterId);
  }

  /**
   * 목적: Monitor 커스텀 룰 추가
   */
  async monitorAddRule(description: string): Promise<MonitorRule> {
    const fallback: MonitorRule = {
      id: "rule-fallback",
      description,
      condition: {
        resource: "event",
        operator: "contains",
        value: description,
      },
      severity: "warning",
      enabled: true,
    };
    return this.dependencies.monitorAddRule?.(description) ?? fallback;
  }

  /**
   * 🎯 피드백 전송
   */
  async sendFeedback(
    threadId: string,
    rating: "positive" | "negative",
    category?: FeedbackEntry["category"],
    detail?: string,
  ): Promise<void> {
    const reason = category ? (detail ? `${category}: ${detail}` : category) : undefined;

    const feedback: FeedbackEntry = {
      timestamp: new Date().toISOString(),
      threadId,
      rating,
      category,
      reason,
      detail,
    };

    try {
      await this.dependencies.sendFeedback?.(feedback);
    } catch (err) {
      console.error("[AgentIPCClient] 피드백 전송 실패:", err);
    }
  }

  /**
   * 🎯 스트림 이벤트 핸들러 등록
   *
   * @param handler - 이벤트 핸들러
   * @returns unsubscribe 함수
   */
  onStreamEvent(handler: (event: AgentStreamEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * 🎯 특정 이벤트 타입에 대한 핸들러 등록
   *
   * @param eventType - 이벤트 타입
   * @param handler - 이벤트 핸들러
   * @returns unsubscribe 함수
   */
  onEvent<T extends AgentStreamEvent["type"]>(
    eventType: T,
    handler: (event: Extract<AgentStreamEvent, { type: T }>) => void,
  ): () => void {
    const wrappedHandler = (event: AgentStreamEvent) => {
      if (event.type === eventType) {
        handler(event as Extract<AgentStreamEvent, { type: T }>);
      }
    };

    this.eventHandlers.add(wrappedHandler);
    return () => {
      this.eventHandlers.delete(wrappedHandler);
    };
  }

  /**
   * 🎯 클라이언트 정리
   */
  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.eventHandlers.clear();
  }

  // ============================================
  // 🎯 내부 메서드
  // ============================================

  /**
   * 🎯 메시지에서 Plan 스냅샷 복원
   *
   * 📝 2026-02-03: Plan 영속성 개선
   * - 대화방 전환 시 이전 Plan UI 복원
   * - 가장 최근 미완료(drafting/executing) Plan만 복원
   * - completed/rejected 상태는 제외
   * - conversationId 검증으로 대화방 분리
   *
   * @param messages - 로드된 메시지 배열
   * @param threadId - 현재 스레드 ID
   */
  private restorePlanFromMessages(messages: ThreadMessage[], threadId: string): void {
    // 역순으로 최근 planSnapshot 찾기
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.planSnapshot) {
        const snapshot = msg.planSnapshot;

        // 완료/거부 상태 제외
        if (snapshot.status === "completed" || snapshot.status === "rejected") {
          continue;
        }

        // conversationId 검증
        if (snapshot.conversationId && snapshot.conversationId !== threadId) {
          continue;
        }

        // Plan 복원
        planState.initializeFromSnapshot(snapshot);
        return;
      }
    }

    // 미완료 Plan 없으면 상태 리셋
    planState.reset();
  }

  /**
   * 🎯 스트림 구독 시작
   */
  private startStreamSubscription(): void {
    if (this.unsubscribe) return;

    this.unsubscribe = this.dependencies.agentStreamSubscribe((event) => {
      // 🎯 등록된 모든 핸들러에게 이벤트 전달
      this.eventHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error("[AgentIPCClient] 이벤트 핸들러 에러:", error);
        }
      });
    });
  }
}
