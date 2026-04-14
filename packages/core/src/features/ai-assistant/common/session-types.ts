/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * AI Assistant 세션 관련 타입 통합 모듈
 *
 * 세션 상태, 메시지, 체크포인트, 요약, Manager 인터페이스 등
 * 모든 세션 관련 타입을 하나의 파일에서 정의합니다.
 *
 * @packageDocumentation
 */

// ============================================
// 세션 상태 타입
// ============================================

/**
 * 세션 상태
 *
 * - active: 현재 활성 세션
 * - paused: 일시 중단
 * - completed: 정상 완료
 * - cancelled: 사용자 취소
 * - expired: 만료됨
 */
export type SessionStatus = "active" | "paused" | "completed" | "cancelled" | "expired";

/**
 * 세션 이벤트 타입
 */
export type SessionEventType =
  | "session_created"
  | "session_resumed"
  | "session_paused"
  | "session_completed"
  | "session_cancelled"
  | "session_expired"
  | "message_added"
  | "checkpoint_created"
  | "checkpoint_restored";

// ============================================
// 메시지 타입
// ============================================

/** 메시지 역할 */
export type MessageRole = "user" | "assistant" | "system" | "tool";

/** 도구 호출 정보 */
export interface SessionToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "success" | "error" | "cancelled";
  durationMs?: number;
}

/** 메시지 엔트리 */
export interface SessionMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  toolCall?: SessionToolCall;
  metadata?: Record<string, unknown>;
}

// ============================================
// 체크포인트 타입
// ============================================

/** 세션 체크포인트 — 특정 시점 스냅샷으로 롤백 지원 */
export interface SessionCheckpoint {
  id: string;
  sessionId: string;
  label: string;
  description?: string;
  timestamp: string;
  messageIndex: number;
  isAutomatic: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================
// 세션 타입
// ============================================

/** AI 대화 세션 */
export interface Session {
  id: string;
  threadId: string;
  title: string;
  status: SessionStatus;
  messages: SessionMessage[];
  checkpoints: SessionCheckpoint[];
  createdAt: string;
  updatedAt: string;
  clusterId?: string;
  namespace?: string;
  modelName?: string;
  totalTokens?: number;
  metadata?: Record<string, unknown>;
}

// ============================================
// 이벤트 & 요약 타입
// ============================================

/** 세션 라이프사이클 이벤트 */
export interface SessionEvent {
  id: string;
  type: SessionEventType;
  sessionId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/** 세션 요약 (목록 표시용) */
export interface SessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  clusterId?: string;
  preview?: string;
  checkpointCount?: number;
}

// ============================================
// 세션 목록 조회 타입
// ============================================

/** 세션 목록 조회 옵션 */
export interface SessionListOptions {
  limit?: number;
  offset?: number;
  status?: SessionStatus | SessionStatus[];
  clusterId?: string;
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

/** 세션 목록 응답 */
export interface SessionListResult {
  sessions: SessionSummary[];
  total: number;
  hasMore: boolean;
}

// ============================================
// 세션 생성/업데이트 입력 타입
// ============================================

/** 세션 생성 입력 */
export interface CreateSessionInput {
  title?: string;
  clusterId?: string;
  namespace?: string;
  modelName?: string;
  metadata?: Record<string, unknown>;
}

/** 세션 업데이트 입력 */
export interface UpdateSessionInput {
  title?: string;
  status?: SessionStatus;
  metadata?: Record<string, unknown>;
}

/** 메시지 추가 입력 */
export interface AddMessageInput {
  role: MessageRole;
  content: string;
  toolCall?: Omit<SessionToolCall, "result" | "status" | "durationMs">;
  metadata?: Record<string, unknown>;
}

/** 체크포인트 생성 입력 */
export interface CreateCheckpointInput {
  label: string;
  description?: string;
  isAutomatic?: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================
// SessionManager 인터페이스
// ============================================

/** SessionManager 인터페이스 */
export interface ISessionManager {
  // 세션 관리
  createSession(input?: CreateSessionInput): Session;
  getSession(sessionId: string): Session | undefined;
  listSessions(options?: SessionListOptions): SessionListResult;
  updateSession(sessionId: string, input: UpdateSessionInput): Session | undefined;
  deleteSession(sessionId: string): boolean;
  getActiveSession(): Session | undefined;
  activateSession(sessionId: string): Session | undefined;

  // 메시지 관리
  addMessage(sessionId: string, input: AddMessageInput): SessionMessage | undefined;
  getMessage(sessionId: string, messageId: string): SessionMessage | undefined;
  getMessages(sessionId: string, limit?: number, offset?: number): SessionMessage[];

  // 체크포인트 관리
  createCheckpoint(sessionId: string, input: CreateCheckpointInput): SessionCheckpoint | undefined;
  getCheckpoint(sessionId: string, checkpointId: string): SessionCheckpoint | undefined;
  getCheckpoints(sessionId: string): SessionCheckpoint[];
  rollbackToCheckpoint(sessionId: string, checkpointId: string): Session | undefined;

  // 내보내기/가져오기
  exportSession(sessionId: string): string | undefined;
  importSession(jsonData: string): Session | undefined;
  exportAllSessions(): string;

  // 유틸리티
  getSessionCount(): number;
  cleanupExpiredSessions(): number;
  clear(): void;
}

// ============================================
// SessionManager 설정
// ============================================

/** SessionManager 설정 */
export interface SessionManagerConfig {
  maxSessions?: number;
  sessionExpiryMs?: number;
  autoCheckpoint?: boolean;
  autoCheckpointInterval?: number;
}

/** SessionManager 기본 설정 */
export const SESSION_MANAGER_DEFAULTS: Required<SessionManagerConfig> = {
  maxSessions: 100,
  sessionExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7일
  autoCheckpoint: true,
  autoCheckpointInterval: 5,
};
