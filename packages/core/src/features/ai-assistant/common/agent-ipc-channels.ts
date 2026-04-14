/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Agent IPC 채널 정의
 *
 * Renderer ↔ Main 간 Agent 통신을 위한 IPC 채널과 타입을 정의합니다.
 *
 * 📝 Extension Host 패턴:
 * - Renderer는 "말만 한다" (요청/표시)
 * - Main은 "생각하고 실행한다" (Agent + Tool)
 * - 스트리밍은 Main → Renderer Push 방식
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Phase 2 Extension Host 패턴)
 */

import { getInjectionToken } from "@ogre-tools/injectable";
import { getMessageChannel, getRequestChannel } from "@skuberplus/messaging";

import type { AIProvider } from "../../../common/features/user-preferences/encrypt-api-key-channel";
import type { MonitorAlert, MonitorConfig, MonitorRule, MonitorStatus } from "./monitor-types";
// 🎯 2026-01-13: - ThreadMessage 확장을 위한 PlanSnapshot import
import type { PlanSnapshot } from "./plan-types";

export type {
  K8sEvent,
  MonitorAlert,
  MonitorClusterConfig,
  MonitorConfig,
  MonitorFinding,
  MonitorRule,
  MonitorStatus,
  MonitorUserPreferences,
} from "./monitor-types";

// ============================================
// 🎯 Agent 컨텍스트 타입
// ============================================

/**
 * 🎯 Agent 실행 컨텍스트
 *
 * Agent가 작업을 수행할 때 필요한 클러스터/네임스페이스 정보
 *
 * 📝 2026-01-07: 수정 - attachedContexts 필드 추가
 * - 사용자가 멘션(@)으로 선택한 리소스 목록
 * - AI가 해당 리소스에 대해 분석/작업 수행 시 참조
 */
export interface AgentContext {
  /** 현재 클러스터 ID */
  clusterId: string | null;
  /** 🆕 현재 클러스터 이름 (AI File System에서 폴더명으로 사용) */
  clusterName: string | null;
  /** 현재 네임스페이스 */
  namespace: string | null;
  /** 열린 리소스 정보 (선택적) */
  openedResource?: {
    kind: string;
    name: string;
    namespace?: string;
  } | null;
  /** 🆕 사용자가 선택한 컨텍스트 리소스 목록 (멘션) */
  attachedContexts?: Array<{
    id: string;
    type: string;
    name: string;
    namespace?: string;
  }>;
  /**
   * 🆕 Safe Zone 기본 경로 (AI File System에서 사용)
   *
   * Settings > File Explorer > Default folder path에서 설정된 경로
   * 설정되지 않은 경우 null (Handler에서 os.homedir() 사용)
   *
   * 📝 2026-01-29 FIX: Main Process에서 userPreferencesState가
   * 제대로 로드되지 않는 문제 대응 - Renderer에서 직접 전달
   */
  basePath: string | null;
  /**
   * 🆕 백그라운드 모니터가 감지한 최근 알림 (사용자 응답 시 전달)
   *
   * 📝 2026-02-27: 모니터 알림 → AI 에이전트 컨텍스트 연동
   * - MonitorAlert 타입을 직접 재사용하지 않고 필요한 필드만 인라인 정의
   * - events, raw 같은 대용량 필드를 IPC로 전송하지 않기 위함
   */
  monitorAlert?: {
    severity: "critical" | "warning" | "info";
    summary: string;
    findings: Array<{
      severity: string;
      category: string;
      title: string;
      description: string;
      suggestedCommands: string[];
    }>;
    timestamp: number;
  } | null;
}

// ============================================
// 🎯 Agent 요청 타입 (Renderer → Main)
// ============================================

/**
 * 🎯 슬래시 명령어 정보 (메시지와 함께 전달)
 *
 * 📝 2026-01-07: 수정 - 슬래시 명령어 행동 지침 전달용
 */
export interface SlashCommandInfo {
  /** 명령어 ID */
  commandId: string;
  /** 명령어 이름 */
  commandName: string;
  /** 행동 지침 (purpose, workflow, actions 등) */
  behavior?: {
    purpose?: string;
    workflow?: Array<{ step: number; name: string; description: string }>;
    actions?: string[];
    allowedTools?: string[];
    /** 🆕 출력 형식 가이드 */
    outputFormat?: string;
    /** 🆕 사용 가능한 옵션 */
    options?: Array<{ name: string; description: string; defaultValue?: string | boolean }>;
    /** 🆕 사용 예시 (Few-shot) */
    examples?: string[];
    /** 🆕 관련 명령어 */
    relatedCommands?: string[];
    /** Expert Panel 사용 여부 (다관점 분석 활성화) */
    expertPanel?: boolean;
    /** Expert Panel 데이터 수집 시 실행할 쿼리 목록 (명령어별 맞춤) */
    dataQueries?: string[];
  };
}

/**
 * 🎯 메시지 전송 요청
 */
export interface AgentSendMessageRequest {
  type: "send-message";
  /** LangGraph thread ID (세션 구분) */
  threadId: string;
  /** 사용자 입력 텍스트 */
  message: string;
  /** AI Provider */
  provider: AIProvider;
  /** 모델 ID (선택적) */
  modelId?: string;
  /** 실행 컨텍스트 */
  context: AgentContext;
  /** Renderer에서 생성한 Assistant 메시지 ID (스트림 이벤트 매칭용) */
  assistantMessageId: string;
  /** 🆕 슬래시 명령어 정보 (슬래시 명령어 사용 시) */
  slashCommand?: SlashCommandInfo;
}

/**
 * 🎯 Interrupt 재개 요청 (HITL/Clarify 응답)
 */
export interface AgentResumeInterruptRequest {
  type: "resume-interrupt";
  /** LangGraph thread ID */
  threadId: string;
  /** Interrupt에 대한 응답 (승인/거절/값) */
  response: unknown;
  /** AI Provider */
  provider: AIProvider;
}

/**
 * 🎯 Agent 리셋 요청
 */
export interface AgentResetRequest {
  type: "reset";
  /** 특정 thread만 리셋 (없으면 전체) */
  threadId?: string;
}

/**
 * 🎯 Agent 취소 요청
 *
 * 현재 실행 중인 Agent 작업을 중단합니다.
 */
export interface AgentCancelRequest {
  type: "cancel";
  /** 취소할 Thread ID */
  threadId: string;
}

/**
 * 🎯 Agent 요청 Union 타입
 */
export type AgentRequest =
  | AgentSendMessageRequest
  | AgentResumeInterruptRequest
  | AgentResetRequest
  | AgentCancelRequest;

// ============================================
// 🎯 Agent 스트리밍 이벤트 타입 (Main → Renderer)
// ============================================

/**
 * 🎯 메시지 청크 이벤트
 */
export interface AgentMessageChunkEvent {
  type: "message-chunk";
  /** 메시지 청크 내용 */
  chunk: string;
  /** 메시지 ID (같은 메시지의 청크들은 동일 ID) */
  messageId: string;
}

/**
 * 🎯 메시지 완료 이벤트
 */
export interface AgentMessageCompleteEvent {
  type: "message-complete";
  /** 전체 메시지 내용 */
  content: string;
  /** 메시지 ID */
  messageId: string;
}

/**
 * 🎯 Interrupt 이벤트 (HITL/Clarify/RecursionLimit/PlanApproval)
 *
 * 📝 2026-01-10: 수정 - recursion_limit 타입 추가
 * - recursionLimit 도달 시 사용자에게 계속 여부를 묻는 interrupt
 * 📝 2026-01-12: Auto Plan Tracker - plan_approval 타입 추가
 * - Plan 생성 후 사용자 승인을 기다리는 interrupt
 */
export interface AgentInterruptEvent {
  type: "interrupt";
  /** Interrupt 종류 */
  interruptType: "hitl" | "clarify" | "recursion_limit" | "plan_approval";
  /** Interrupt 페이로드 (Tool 정보, 질문 등) */
  payload: unknown;
  /** 관련 Thread ID */
  threadId: string;
}

/**
 * 🎯 Tool 실행 이벤트
 */
export interface AgentToolExecutionEvent {
  type: "tool-execution";
  /** Tool 이름 */
  toolName: string;
  /** 실행 상태 */
  status: "started" | "completed" | "error";
  /** Tool 입력 (started 시) */
  input?: unknown;
  /** Tool 결과 (completed 시) */
  result?: unknown;
  /** 에러 메시지 (error 시) */
  error?: string;
}

/**
 * 🎯 Agent 완료 이벤트
 */
export interface AgentCompleteEvent {
  type: "complete";
  /** Thread ID */
  threadId: string;
  /** 최종 상태 */
  finalState?: Record<string, unknown>;
}

/**
 * 🎯 Agent 에러 이벤트
 */
export interface AgentErrorEvent {
  type: "error";
  /** 에러 메시지 */
  error: string;
  /** 에러 코드 */
  code?: string;
  /** Thread ID */
  threadId?: string;
}

// ============================================
// 🎯 Expert Debate 이벤트 타입 (Multi-Expert Panel)
// ============================================

/**
 * 🎯 Expert Debate 시작 이벤트
 *
 * Expert Panel 분석이 시작될 때 발생합니다.
 * UI에서 전문가 카드를 표시하는 트리거로 사용됩니다.
 */
export interface AgentDebateStartEvent {
  type: "debate-start";
  /** Thread ID */
  threadId: string;
  /** 참여 전문가 목록 */
  experts: Array<{ id: string; name: string }>;
  /** 현재 라운드 번호 */
  roundNumber: number;
}

/**
 * 🎯 Expert 개별 응답 이벤트
 *
 * 각 전문가의 분석이 진행/완료될 때 발생합니다.
 */
export interface AgentDebateExpertEvent {
  type: "debate-expert-response";
  /** Thread ID */
  threadId: string;
  /** 전문가 ID */
  expertId: string;
  /** 전문가 이름 */
  expertName: string;
  /** 분석 내용 */
  content: string;
  /** 분석 상태 */
  status: "thinking" | "complete";
}

/**
 * 🎯 Expert Debate 합의 이벤트
 *
 * Synthesizer가 모든 전문가 분석을 통합한 결과입니다.
 */
export interface AgentDebateConsensusEvent {
  type: "debate-consensus";
  /** Thread ID */
  threadId: string;
  /** 합성된 최종 결과 */
  consensus: string;
}

/**
 * 🎯 Plan Step 진행 이벤트
 *
 * Plan 승인 후 각 step 실행 상태를 UI에 전달합니다.
 */
export interface AgentPlanStepUpdateEvent {
  type: "plan-step-update";
  stepIndex: number;
  status: "in_progress" | "completed" | "failed" | "skipped";
  toolName: string;
  result?: string;
  error?: string;
}

/**
 * 🎯 Agent 스트림 이벤트 Union 타입
 */
export type AgentStreamEvent =
  | AgentMessageChunkEvent
  | AgentMessageCompleteEvent
  | AgentInterruptEvent
  | AgentToolExecutionEvent
  | AgentCompleteEvent
  | AgentErrorEvent
  | AgentDebateStartEvent
  | AgentDebateExpertEvent
  | AgentDebateConsensusEvent
  | AgentPlanStepUpdateEvent;

// ============================================
// 🎯 Agent 응답 타입
// ============================================

/**
 * 🎯 Agent 요청 응답 (즉시 응답)
 *
 * 실제 결과는 스트리밍 이벤트로 전달됩니다.
 */
export interface AgentRequestResponse {
  /** 요청 수락 여부 */
  accepted: boolean;
  /** Thread ID */
  threadId: string;
  /** 에러 메시지 (accepted=false 시) */
  error?: string;
}

// ============================================
// 🎯 IPC 채널 정의
// ============================================

/**
 * 🎯 Agent 요청 채널 (Renderer → Main)
 *
 * 메시지 전송, Interrupt 재개 등의 요청
 */
export const agentRequestChannel = getRequestChannel<AgentRequest, AgentRequestResponse>("ai-assistant:agent-request");

/**
 * 🎯 Agent 스트림 이벤트 채널 (Main → Renderer)
 *
 * 스트리밍 메시지, Interrupt, 진행 상황 등의 이벤트
 */
export const agentStreamChannel = getMessageChannel<AgentStreamEvent>("ai-assistant:agent-stream");

// ============================================
// 🎯 HITL 세션 복원 채널 정의
// ============================================

/**
 * 🎯 HITL 세션 정보 (복원용)
 *
 * 📝 2026-01-10: 수정 - recursion_limit 타입 추가
 * 📝 2026-01-12: Auto Plan Tracker - plan_approval 타입 추가
 */
export interface HitlSessionInfo {
  /** 세션 ID */
  id: string;
  /** Thread ID */
  threadId: string;
  /** Interrupt 타입 */
  interruptType: "hitl" | "clarify" | "recursion_limit" | "plan_approval";
  /** Interrupt 페이로드 */
  payload: unknown;
  /** 생성 시간 */
  createdAt: number;
  /** 클러스터 ID */
  clusterId?: string;
  /** 네임스페이스 */
  namespace?: string;
}

/**
 * 🎯 HITL 세션 목록 요청
 */
export interface HitlSessionListRequest {
  /** 클러스터 ID 필터 (선택적) */
  clusterId?: string;
}

/**
 * 🎯 HITL 세션 목록 응답
 */
export interface HitlSessionListResponse {
  /** 대기 중인 HITL 세션 목록 */
  sessions: HitlSessionInfo[];
}

/**
 * 🎯 HITL 세션 목록 채널 (Renderer → Main)
 *
 * 대기 중인 HITL 세션 목록을 조회합니다.
 * 새로고침/앱 재시작 후 복원에 사용됩니다.
 */
export const hitlSessionListChannel = getRequestChannel<HitlSessionListRequest, HitlSessionListResponse>(
  "ai-assistant:hitl-session-list",
);

// ============================================
// 🎯 HITL 레벨 설정 채널 정의
// ============================================

/**
 * 🎯 HITL 레벨 타입
 */
export type HitlLevel = "always_approve" | "read_only" | "allow_all";

/**
 * 🎯 HITL 레벨 설정 요청
 */
export interface HitlLevelSetRequest {
  /** HITL 레벨 */
  level: HitlLevel;
}

/**
 * 🎯 HITL 레벨 설정 응답
 */
export interface HitlLevelSetResponse {
  /** 성공 여부 */
  success: boolean;
  /** 설정된 레벨 */
  level: HitlLevel;
}

/**
 * 🎯 HITL 레벨 설정 채널 (Renderer → Main)
 *
 * Main Process의 HITL 레벨을 설정합니다.
 */
export const hitlLevelSetChannel = getRequestChannel<HitlLevelSetRequest, HitlLevelSetResponse>(
  "ai-assistant:hitl-level-set",
);

// ============================================
// 🎯 Thread 조회 채널 정의 (Past Chats UI 연동)
// ============================================

/**
 * 🎯 Thread 정보 타입
 */
export interface ThreadInfo {
  threadId: string;
  title: string;
  lastMessage: string;
  lastUpdatedAt: string;
  messageCount: number;
}

/**
 * 🎯 Thread 메시지 타입
 *
 * 📝 2026-01-13: 해결
 * - presentation, toolApprovalResult, planSnapshot 추가
 * - 대화방 전환 시 UI 메타데이터 복원 지원
 */
export interface ThreadMessage {
  role: string;
  content: string;
  timestamp: string;
  /**
   * 🆕 메시지 표현 방식
   * - "chat": 기본 채팅 버블
   * - "log": 로그 텍스트
   * - "tool-approval-result": 승인/거절 결과
   * - "plan-viewer": Plan 뷰어
   * - "plan-status-message": Plan 상태 메시지
   */
  presentation?: "chat" | "log" | "tool-approval-result" | "plan-viewer" | "plan-status-message";
  /**
   * 🆕 Tool 승인 결과 데이터 (presentation이 "tool-approval-result"일 때)
   */
  toolApprovalResult?: {
    approved: boolean;
    command: string;
    timestamp: string;
    yamlContent?: string;
    diffStats?: { additions: number; deletions: number };
    filePath?: string;
    output?: string;
  };
  /**
   * 🆕 Plan 상태 스냅샷 (presentation이 "plan-viewer"일 때)
   */
  planSnapshot?: PlanSnapshot;
  /**
   * 🆕 Plan 상태 메시지 데이터 (presentation이 "plan-status-message"일 때)
   */
  planStatusMessageData?: {
    statusType: "approved" | "completed" | "partial" | "failed" | "rejected";
    title: string;
    description?: string;
    details?: string;
    stepInfo?: { current?: number; total: number; completed?: number };
  };
}

/**
 * 🎯 Thread 목록 요청
 */
export interface ThreadListRequest {
  /** 최대 개수 (기본: 50) */
  limit?: number;
}

/**
 * 🎯 Thread 목록 응답
 */
export interface ThreadListResponse {
  /** Thread 목록 */
  threads: ThreadInfo[];
}

/**
 * 🎯 Thread 목록 조회 채널 (Renderer → Main)
 *
 * Past Chats UI에서 대화 목록을 조회합니다.
 */
export const threadListChannel = getRequestChannel<ThreadListRequest, ThreadListResponse>("ai-assistant:thread-list");

/**
 * 🎯 Thread 메시지 로드 요청
 */
export interface ThreadLoadRequest {
  /** 로드할 Thread ID */
  threadId: string;
}

/**
 * 🎯 Thread 메시지 로드 응답
 */
export interface ThreadLoadResponse {
  /** 성공 여부 */
  success: boolean;
  /** Thread ID */
  threadId: string;
  /** 메시지 목록 */
  messages: ThreadMessage[];
  /** 에러 메시지 */
  error?: string;
}

/**
 * 🎯 Thread 메시지 로드 채널 (Renderer → Main)
 *
 * 특정 Thread의 메시지 히스토리를 로드합니다.
 */
export const threadLoadChannel = getRequestChannel<ThreadLoadRequest, ThreadLoadResponse>("ai-assistant:thread-load");

/**
 * 🎯 Thread 삭제 요청
 */
export interface ThreadDeleteRequest {
  /** 삭제할 Thread ID */
  threadId: string;
}

/**
 * 🎯 Thread 삭제 응답
 */
export interface ThreadDeleteResponse {
  /** 성공 여부 */
  success: boolean;
  /** 삭제된 Thread ID */
  threadId: string;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 🎯 Thread 삭제 채널 (Renderer → Main)
 *
 * 특정 Thread를 삭제합니다.
 */
export const threadDeleteChannel = getRequestChannel<ThreadDeleteRequest, ThreadDeleteResponse>(
  "ai-assistant:thread-delete",
);

// ============================================
// 🎯 UI 메시지 로깅 채널 (2026-01-13:)
// ============================================

/**
 * 🎯 UI 메시지 로깅 요청
 *
 * 📝 2026-01-13: 해결
 * - Renderer에서 생성되는 UI 메시지(tool-approval-result, plan-viewer)를 Main에 전달
 * - Main의 ConversationLogger가 확장 속성과 함께 저장
 */
export interface LogUIMessageRequest {
  /** Thread ID */
  threadId: string;
  /** 메시지 역할 */
  role: "user" | "assistant" | "system";
  /** 메시지 내용 */
  content: string;
  /** 메시지 표현 방식 */
  presentation?: ThreadMessage["presentation"];
  /** Tool 승인 결과 데이터 */
  toolApprovalResult?: ThreadMessage["toolApprovalResult"];
  /** Plan 스냅샷 */
  planSnapshot?: ThreadMessage["planSnapshot"];
  /** Plan 상태 메시지 데이터 */
  planStatusMessageData?: ThreadMessage["planStatusMessageData"];
}

/**
 * 🎯 UI 메시지 로깅 응답
 */
export interface LogUIMessageResponse {
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 🎯 UI 메시지 로깅 채널 (Renderer → Main)
 *
 * Renderer에서 생성된 UI 메시지를 Main의 ConversationLogger에 저장합니다.
 */
export const logUIMessageChannel = getRequestChannel<LogUIMessageRequest, LogUIMessageResponse>(
  "ai-assistant:log-ui-message",
);

// ============================================
// 🎯 Monitor IPC 채널 정의
// ============================================

/**
 * 🎯 Monitor 시작 채널
 */
export const monitorStartChannel = getRequestChannel<MonitorConfig, void>("monitor:start");

/**
 * 🎯 Monitor 중지 채널
 */
export const monitorStopChannel = getRequestChannel<void, void>("monitor:stop");

/**
 * 🎯 Monitor 설정 저장/반영 채널
 */
export const monitorConfigSetChannel = getRequestChannel<MonitorConfig, void>("monitor:config:set");

/**
 * 🎯 Monitor 설정 조회 채널
 */
export const monitorConfigGetChannel = getRequestChannel<void, MonitorConfig>("monitor:config:get");

/**
 * 🎯 Monitor 상태 목록 조회 채널
 */
export const monitorStatusChannel = getRequestChannel<void, MonitorStatus[]>("monitor:status");

/**
 * 🎯 Monitor 즉시 점검 채널
 */
export const monitorCheckNowChannel = getRequestChannel<string, void>("monitor:check-now");

/**
 * 🎯 Monitor 커스텀 룰 추가 채널
 */
export const monitorCustomRuleAddChannel = getRequestChannel<string, MonitorRule>("monitor:rule:add");

/**
 * 🎯 Main -> Renderer 알림 푸시 채널
 */
export const monitorAlertChannel = getMessageChannel<MonitorAlert>("monitor:alert");

/**
 * 🎯 Main -> Renderer 상태 업데이트 채널
 */
export const monitorStatusUpdateChannel = getMessageChannel<MonitorStatus>("monitor:status:update");

// ============================================
// 🎯 DI 토큰 정의
// ============================================

/**
 * 🎯 Agent 요청 함수 타입
 */
export type AgentRequestFn = (request: AgentRequest) => Promise<AgentRequestResponse>;

/**
 * 🎯 Agent 스트림 구독 함수 타입
 */
export type AgentStreamSubscribeFn = (callback: (event: AgentStreamEvent) => void) => () => void; // unsubscribe 함수 반환

/**
 * 🎯 Agent 요청 DI 토큰
 */
export const agentRequestInjectionToken = getInjectionToken<AgentRequestFn>({
  id: "ai-assistant-agent-request",
});

/**
 * 🎯 Agent 스트림 구독 DI 토큰
 */
export const agentStreamSubscribeInjectionToken = getInjectionToken<AgentStreamSubscribeFn>({
  id: "ai-assistant-agent-stream-subscribe",
});
