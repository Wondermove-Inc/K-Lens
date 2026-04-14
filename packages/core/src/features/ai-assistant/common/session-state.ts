/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * AI Assistant SessionState MobX 상태 관리 통합 모듈
 *
 * 세션 목록, 현재 세션, 메시지, 체크포인트 등
 * UI 상태 관리와 액션을 하나의 파일로 통합합니다.
 *
 * @packageDocumentation
 */

import { action, makeAutoObservable, runInAction } from "mobx";

import type { SessionManager } from "./session-manager";
import type { Session, SessionCheckpoint, SessionListOptions, SessionMessage, SessionSummary } from "./session-types";

// ============================================
// 타입 정의
// ============================================

/** SessionState Observable 상태 인터페이스 */
export interface ISessionStateObservable {
  sessions: SessionSummary[];
  currentSession: Session | null;
  isLoading: boolean;
  error: Error | null;
  totalSessions: number;
  hasMore: boolean;
}

/** SessionState Computed 속성 인터페이스 */
export interface ISessionStateComputed {
  hasCurrentSession: boolean;
  hasError: boolean;
  sessionCount: number;
  currentSessionId: string | null;
  currentSessionTitle: string | null;
  currentMessages: SessionMessage[];
  currentCheckpoints: SessionCheckpoint[];
  messageCount: number;
  checkpointCount: number;
}

/** SessionState 전체 인터페이스 */
export interface ISessionState extends ISessionStateObservable, ISessionStateComputed {}

/** 세션 생성 입력 (State용 — 간소화) */
export interface CreateSessionInput {
  title?: string;
  clusterId?: string;
}

/** 체크포인트 생성 입력 (State용 — 간소화) */
export interface CreateCheckpointInput {
  label: string;
  description?: string;
}

// ============================================
// SessionState 클래스
// ============================================

/**
 * SessionState — AI 대화 세션의 UI 상태 관리
 *
 * SessionManager와 연동하여 실제 데이터를 관리하며,
 * MobX observable/action 패턴으로 UI 반응성을 제공합니다.
 */
export class SessionState implements ISessionState {
  // Observable 상태
  sessions: SessionSummary[] = [];
  currentSession: Session | null = null;
  isLoading = false;
  error: Error | null = null;
  totalSessions = 0;
  hasMore = false;
  currentOffset = 0;
  readonly pageSize = 20;

  private readonly manager: SessionManager;

  constructor(manager: SessionManager) {
    this.manager = manager;
    makeAutoObservable(this, {
      loadSessions: action,
      loadMoreSessions: action,
      refreshSessions: action,
      createNewSession: action,
      selectSession: action,
      closeCurrentSession: action,
      updateCurrentSessionTitle: action,
      deleteSession: action,
      addUserMessage: action,
      addAssistantMessage: action,
      createCheckpoint: action,
      rollbackToCheckpoint: action,
      exportCurrentSession: action,
      importSession: action,
      cleanupExpiredSessions: action,
      clearError: action,
      reset: action,
      refreshCurrentSession: action,
    });
  }

  // --- Computed 속성 ---

  get hasCurrentSession(): boolean {
    return this.currentSession !== null;
  }

  get hasError(): boolean {
    return this.error !== null;
  }

  get sessionCount(): number {
    return this.sessions.length;
  }

  get currentSessionId(): string | null {
    return this.currentSession?.id ?? null;
  }

  get currentSessionTitle(): string | null {
    return this.currentSession?.title ?? null;
  }

  get currentMessages(): SessionMessage[] {
    return this.currentSession?.messages ?? [];
  }

  get currentCheckpoints(): SessionCheckpoint[] {
    return this.currentSession?.checkpoints ?? [];
  }

  get messageCount(): number {
    return this.currentSession?.messages.length ?? 0;
  }

  get checkpointCount(): number {
    return this.currentSession?.checkpoints.length ?? 0;
  }

  // --- 세션 목록 관리 ---

  async loadSessions(options?: SessionListOptions): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const result = this.manager.listSessions({
        limit: options?.limit ?? this.pageSize,
        offset: options?.offset ?? 0,
        ...options,
      });

      runInAction(() => {
        this.sessions = result.sessions;
        this.totalSessions = result.total;
        this.hasMore = result.hasMore;
        this.currentOffset = options?.offset ?? 0;
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
        this.isLoading = false;
      });
    }
  }

  async loadMoreSessions(): Promise<void> {
    if (!this.hasMore || this.isLoading) return;

    this.isLoading = true;
    this.error = null;

    try {
      const newOffset = this.currentOffset + this.pageSize;
      const result = this.manager.listSessions({
        limit: this.pageSize,
        offset: newOffset,
      });

      runInAction(() => {
        this.sessions = [...this.sessions, ...result.sessions];
        this.totalSessions = result.total;
        this.hasMore = result.hasMore;
        this.currentOffset = newOffset;
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
        this.isLoading = false;
      });
    }
  }

  async refreshSessions(): Promise<void> {
    this.currentOffset = 0;
    await this.loadSessions();
  }

  // --- 현재 세션 관리 ---

  async createNewSession(input?: CreateSessionInput): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const session = this.manager.createSession(input);

      runInAction(() => {
        this.currentSession = session;
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
        this.isLoading = false;
      });
    }
  }

  async selectSession(sessionId: string): Promise<void> {
    this.isLoading = true;
    this.error = null;

    try {
      const session = this.manager.getSession(sessionId);

      if (!session) {
        throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
      }

      this.manager.activateSession(sessionId);

      runInAction(() => {
        this.currentSession = session;
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
        this.isLoading = false;
      });
    }
  }

  closeCurrentSession(): void {
    this.currentSession = null;
  }

  async updateCurrentSessionTitle(title: string): Promise<void> {
    if (!this.currentSession) return;

    this.error = null;

    try {
      const updated = this.manager.updateSession(this.currentSession.id, { title });

      if (updated) {
        runInAction(() => {
          this.currentSession = updated;
        });
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
      });
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.error = null;

    try {
      const isCurrentSession = this.currentSession?.id === sessionId;
      this.manager.deleteSession(sessionId);

      runInAction(() => {
        if (isCurrentSession) {
          this.currentSession = null;
        }
      });

      await this.refreshSessions();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
      });
    }
  }

  async refreshCurrentSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const session = this.manager.getSession(this.currentSession.id);

      if (session) {
        runInAction(() => {
          this.currentSession = session;
        });
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
      });
    }
  }

  // --- 메시지 관리 ---

  async addUserMessage(content: string): Promise<void> {
    if (!this.currentSession) {
      this.error = new Error("활성 세션이 없습니다");
      return;
    }

    this.error = null;

    try {
      this.manager.addMessage(this.currentSession.id, { role: "user", content });
      await this.refreshCurrentSession();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
      });
    }
  }

  async addAssistantMessage(content: string): Promise<void> {
    if (!this.currentSession) {
      this.error = new Error("활성 세션이 없습니다");
      return;
    }

    this.error = null;

    try {
      this.manager.addMessage(this.currentSession.id, { role: "assistant", content });
      await this.refreshCurrentSession();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
      });
    }
  }

  // --- 체크포인트 관리 ---

  async createCheckpoint(label: string, description?: string): Promise<void> {
    if (!this.currentSession) {
      this.error = new Error("활성 세션이 없습니다");
      return;
    }

    this.error = null;

    try {
      this.manager.createCheckpoint(this.currentSession.id, { label, description });
      await this.refreshCurrentSession();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
      });
    }
  }

  async rollbackToCheckpoint(checkpointId: string): Promise<void> {
    if (!this.currentSession) {
      this.error = new Error("활성 세션이 없습니다");
      return;
    }

    this.error = null;

    try {
      const rolledBackSession = this.manager.rollbackToCheckpoint(this.currentSession.id, checkpointId);

      if (rolledBackSession) {
        runInAction(() => {
          this.currentSession = rolledBackSession;
        });
      }
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
      });
    }
  }

  // --- 내보내기/가져오기 ---

  async exportCurrentSession(): Promise<string | undefined> {
    if (!this.currentSession) return undefined;
    return this.manager.exportSession(this.currentSession.id);
  }

  async importSession(jsonData: string): Promise<void> {
    this.error = null;

    try {
      const session = this.manager.importSession(jsonData);

      if (!session) {
        throw new Error("세션을 가져올 수 없습니다: 유효하지 않은 데이터");
      }

      runInAction(() => {
        this.currentSession = session;
      });

      await this.refreshSessions();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err : new Error(String(err));
      });
    }
  }

  // --- 유틸리티 ---

  async cleanupExpiredSessions(): Promise<number> {
    const count = this.manager.cleanupExpiredSessions();
    await this.refreshSessions();
    return count;
  }

  clearError(): void {
    this.error = null;
  }

  reset(): void {
    this.sessions = [];
    this.currentSession = null;
    this.isLoading = false;
    this.error = null;
    this.totalSessions = 0;
    this.hasMore = false;
    this.currentOffset = 0;
  }
}
