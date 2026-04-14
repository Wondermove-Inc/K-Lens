/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * AI Assistant SessionManager 통합 모듈
 *
 * 세션 CRUD, 메시지/체크포인트 관리, 내보내기/가져오기,
 * 팩토리 함수, 목록 유틸리티, 타입 가드를 하나의 파일로 통합합니다.
 *
 * @packageDocumentation
 */

import { SESSION_MANAGER_DEFAULTS } from "./session-types";

import type {
  AddMessageInput,
  CreateCheckpointInput,
  CreateSessionInput,
  ISessionManager,
  MessageRole,
  Session,
  SessionCheckpoint,
  SessionEventType,
  SessionListOptions,
  SessionListResult,
  SessionManagerConfig,
  SessionMessage,
  SessionStatus,
  SessionSummary,
  UpdateSessionInput,
} from "./session-types";

// ============================================
// ID 생성 함수
// ============================================

export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `session-${timestamp}-${random}`;
}

export function generateMessageId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `msg-${timestamp}-${random}`;
}

export function generateCheckpointId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `cp-${timestamp}-${random}`;
}

export function generateThreadId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `thread-${timestamp}-${random}`;
}

// ============================================
// 팩토리 함수
// ============================================

export function createEmptySession(input?: CreateSessionInput): Session {
  const now = new Date().toISOString();
  return {
    id: generateSessionId(),
    threadId: generateThreadId(),
    title: input?.title ?? "새 대화",
    status: "active",
    messages: [],
    checkpoints: [],
    createdAt: now,
    updatedAt: now,
    clusterId: input?.clusterId,
    namespace: input?.namespace,
    modelName: input?.modelName,
    metadata: input?.metadata,
  };
}

export function createSessionMessage(input: AddMessageInput): SessionMessage {
  const message: SessionMessage = {
    id: generateMessageId(),
    role: input.role,
    content: input.content,
    timestamp: new Date().toISOString(),
    metadata: input.metadata,
  };

  if (input.toolCall) {
    message.toolCall = {
      name: input.toolCall.name,
      args: input.toolCall.args,
      status: "pending",
    };
  }

  return message;
}

export function createSessionCheckpoint(
  sessionId: string,
  messageIndex: number,
  input: CreateCheckpointInput,
): SessionCheckpoint {
  return {
    id: generateCheckpointId(),
    sessionId,
    label: input.label,
    description: input.description,
    timestamp: new Date().toISOString(),
    messageIndex,
    isAutomatic: input.isAutomatic ?? false,
    metadata: input.metadata,
  };
}

export function createSessionSummary(session: Session): SessionSummary {
  const lastMessage = session.messages[session.messages.length - 1];
  let preview: string | undefined;

  if (lastMessage) {
    const content = lastMessage.content;
    preview = content.length > 50 ? content.substring(0, 50) + "..." : content;
  }

  return {
    id: session.id,
    title: session.title,
    status: session.status,
    messageCount: session.messages.length,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    clusterId: session.clusterId,
    preview,
  };
}

// ============================================
// 타입 가드
// ============================================

const VALID_SESSION_STATUSES: readonly SessionStatus[] = [
  "active",
  "paused",
  "completed",
  "cancelled",
  "expired",
] as const;

const VALID_MESSAGE_ROLES: readonly MessageRole[] = ["user", "assistant", "system", "tool"] as const;

const VALID_SESSION_EVENT_TYPES: readonly SessionEventType[] = [
  "session_created",
  "session_resumed",
  "session_paused",
  "session_completed",
  "session_cancelled",
  "session_expired",
  "message_added",
  "checkpoint_created",
  "checkpoint_restored",
] as const;

export function isSessionStatus(status: string): status is SessionStatus {
  return typeof status === "string" && VALID_SESSION_STATUSES.includes(status as SessionStatus);
}

export function isMessageRole(role: string): role is MessageRole {
  return typeof role === "string" && VALID_MESSAGE_ROLES.includes(role as MessageRole);
}

export function isSessionEventType(eventType: string): eventType is SessionEventType {
  return typeof eventType === "string" && VALID_SESSION_EVENT_TYPES.includes(eventType as SessionEventType);
}

export function isSessionMessage(obj: unknown): obj is SessionMessage {
  if (typeof obj !== "object" || obj === null) return false;
  const m = obj as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.role === "string" &&
    isMessageRole(m.role) &&
    typeof m.content === "string" &&
    typeof m.timestamp === "string"
  );
}

export function isSessionCheckpoint(obj: unknown): obj is SessionCheckpoint {
  if (typeof obj !== "object" || obj === null) return false;
  const c = obj as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.sessionId === "string" &&
    typeof c.label === "string" &&
    typeof c.timestamp === "string" &&
    typeof c.messageIndex === "number" &&
    typeof c.isAutomatic === "boolean"
  );
}

export function isSession(obj: unknown): obj is Session {
  if (typeof obj !== "object" || obj === null) return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.threadId === "string" &&
    typeof s.title === "string" &&
    typeof s.status === "string" &&
    isSessionStatus(s.status) &&
    Array.isArray(s.messages) &&
    Array.isArray(s.checkpoints) &&
    typeof s.createdAt === "string" &&
    typeof s.updatedAt === "string"
  );
}

export function isSessionSummary(obj: unknown): obj is SessionSummary {
  if (typeof obj !== "object" || obj === null) return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.title === "string" &&
    typeof s.status === "string" &&
    isSessionStatus(s.status) &&
    typeof s.messageCount === "number" &&
    typeof s.createdAt === "string" &&
    typeof s.updatedAt === "string"
  );
}

// ============================================
// 목록 조회 유틸리티
// ============================================

function filterSessions(sessions: Session[], options: Pick<SessionListOptions, "status" | "clusterId">): Session[] {
  let result = [...sessions];

  if (options.status) {
    const statusFilter = Array.isArray(options.status) ? options.status : [options.status];
    result = result.filter((s) => statusFilter.includes(s.status));
  }

  if (options.clusterId) {
    result = result.filter((s) => s.clusterId === options.clusterId);
  }

  return result;
}

function sortSessions(
  sessions: Session[],
  sortBy: "createdAt" | "updatedAt" = "updatedAt",
  sortOrder: "asc" | "desc" = "desc",
): Session[] {
  return [...sessions].sort((a, b) => {
    const aValue = sortBy === "createdAt" ? a.createdAt : a.updatedAt;
    const bValue = sortBy === "createdAt" ? b.createdAt : b.updatedAt;

    const timeCompare = sortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);

    if (timeCompare === 0) {
      return sortOrder === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
    }

    return timeCompare;
  });
}

function processSessionList(sessions: Map<string, Session>, options?: SessionListOptions): SessionListResult {
  const { limit = 50, offset = 0, status, clusterId, sortBy = "updatedAt", sortOrder = "desc" } = options ?? {};

  let sessionList = Array.from(sessions.values());
  sessionList = filterSessions(sessionList, { status, clusterId });
  sessionList = sortSessions(sessionList, sortBy, sortOrder);

  const total = sessionList.length;
  const paginatedList = sessionList.slice(offset, offset + limit);
  const summaries: SessionSummary[] = paginatedList.map(createSessionSummary);

  return {
    sessions: summaries,
    total,
    hasMore: offset + limit < total,
  };
}

// ============================================
// SessionManager
// ============================================

/**
 * AI Assistant SessionManager
 *
 * 대화 세션의 완전한 라이프사이클 관리 — CRUD, 메시지, 체크포인트,
 * 내보내기/가져오기, 자동 체크포인트를 포함합니다.
 */
export class SessionManager implements ISessionManager {
  private static instance: SessionManager | undefined;

  private sessions: Map<string, Session>;
  private activeSessionId: string | undefined;
  private readonly config: Required<SessionManagerConfig>;

  constructor(config?: SessionManagerConfig) {
    this.sessions = new Map();
    this.activeSessionId = undefined;
    this.config = { ...SESSION_MANAGER_DEFAULTS, ...config };
  }

  static getInstance(config?: SessionManagerConfig): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager(config);
    }
    return SessionManager.instance;
  }

  static resetInstance(): void {
    SessionManager.instance = undefined;
  }

  // --- 세션 CRUD ---

  createSession(input?: CreateSessionInput): Session {
    this.enforceMaxSessions();
    const session = createEmptySession(input);
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(options?: SessionListOptions): SessionListResult {
    return processSessionList(this.sessions, options);
  }

  updateSession(sessionId: string, input: UpdateSessionInput): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const updated: Session = { ...session, updatedAt: new Date().toISOString() };
    if (input.title !== undefined) updated.title = input.title;
    if (input.status !== undefined) updated.status = input.status;
    if (input.metadata !== undefined) updated.metadata = input.metadata;

    this.sessions.set(sessionId, updated);
    return updated;
  }

  deleteSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) return false;
    this.sessions.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = undefined;
    }
    return true;
  }

  // --- 활성 세션 관리 ---

  getActiveSession(): Session | undefined {
    if (!this.activeSessionId) return undefined;
    return this.sessions.get(this.activeSessionId);
  }

  activateSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    if (this.activeSessionId && this.activeSessionId !== sessionId) {
      const prevSession = this.sessions.get(this.activeSessionId);
      if (prevSession && prevSession.status === "active") {
        this.updateSession(this.activeSessionId, { status: "paused" });
      }
    }

    this.activeSessionId = sessionId;
    return this.updateSession(sessionId, { status: "active" });
  }

  // --- 메시지 관리 ---

  addMessage(sessionId: string, input: AddMessageInput): SessionMessage | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const message = createSessionMessage(input);
    const updatedSession: Session = {
      ...session,
      messages: [...session.messages, message],
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, updatedSession);
    this.checkAutoCheckpoint(sessionId, updatedSession);
    return message;
  }

  getMessage(sessionId: string, messageId: string): SessionMessage | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return session.messages.find((m) => m.id === messageId);
  }

  getMessages(sessionId: string, limit?: number, offset?: number): SessionMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    const start = offset ?? 0;
    const end = limit !== undefined ? start + limit : undefined;
    return session.messages.slice(start, end);
  }

  // --- 체크포인트 관리 ---

  createCheckpoint(sessionId: string, input: CreateCheckpointInput): SessionCheckpoint | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const checkpoint = createSessionCheckpoint(sessionId, session.messages.length, input);
    const updatedSession: Session = {
      ...session,
      checkpoints: [...session.checkpoints, checkpoint],
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, updatedSession);
    return checkpoint;
  }

  getCheckpoint(sessionId: string, checkpointId: string): SessionCheckpoint | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return session.checkpoints.find((cp) => cp.id === checkpointId);
  }

  getCheckpoints(sessionId: string): SessionCheckpoint[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return [...session.checkpoints];
  }

  rollbackToCheckpoint(sessionId: string, checkpointId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    const checkpoint = session.checkpoints.find((cp) => cp.id === checkpointId);
    if (!checkpoint) return undefined;

    const rolledBackMessages = session.messages.slice(0, checkpoint.messageIndex);
    const rollbackCheckpoint = createSessionCheckpoint(sessionId, rolledBackMessages.length, {
      label: `롤백: ${checkpoint.label}`,
      description: `체크포인트 "${checkpoint.label}"로 롤백됨`,
      isAutomatic: true,
    });

    const updatedSession: Session = {
      ...session,
      messages: rolledBackMessages,
      checkpoints: [...session.checkpoints, rollbackCheckpoint],
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  // --- 내보내기/가져오기 ---

  exportSession(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return JSON.stringify(session, null, 2);
  }

  importSession(jsonData: string): Session | undefined {
    try {
      const parsed = JSON.parse(jsonData);
      if (!isSession(parsed)) return undefined;
      this.sessions.set(parsed.id, parsed as Session);
      return parsed as Session;
    } catch {
      return undefined;
    }
  }

  exportAllSessions(): string {
    return JSON.stringify(Array.from(this.sessions.values()), null, 2);
  }

  // --- 유틸리티 ---

  getSessionCount(): number {
    return this.sessions.size;
  }

  cleanupExpiredSessions(): number {
    const now = Date.now();
    const expiryMs = this.config.sessionExpiryMs;
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      const updatedAt = new Date(session.updatedAt).getTime();
      if (now - updatedAt > expiryMs) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  clear(): void {
    this.sessions.clear();
    this.activeSessionId = undefined;
  }

  // --- 내부 헬퍼 ---

  private enforceMaxSessions(): void {
    while (this.sessions.size >= this.config.maxSessions) {
      let oldestId: string | undefined;
      let oldestTime = Infinity;

      for (const [id, session] of this.sessions) {
        const createdAt = new Date(session.createdAt).getTime();
        if (createdAt < oldestTime) {
          oldestTime = createdAt;
          oldestId = id;
        }
      }

      if (oldestId) this.sessions.delete(oldestId);
      else break;
    }
  }

  private checkAutoCheckpoint(sessionId: string, session: Session): void {
    if (!this.config.autoCheckpoint) return;

    const { autoCheckpointInterval } = this.config;
    const messageCount = session.messages.length;

    if (messageCount > 0 && messageCount % autoCheckpointInterval === 0) {
      const checkpoint = createSessionCheckpoint(sessionId, messageCount, {
        label: `자동 체크포인트 (${messageCount} 메시지)`,
        isAutomatic: true,
      });

      const updatedSession: Session = {
        ...session,
        checkpoints: [...session.checkpoints, checkpoint],
      };

      this.sessions.set(sessionId, updatedSession);
    }
  }
}
