/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Agent Session Manager
 *
 * HITL 세션과 Agent 상태를 관리합니다.
 * - 대기 중인 HITL 세션 추적
 * - 앱 재시작 후 HITL 세션 복원
 * - Thread Lock 관리 (동시 실행 방지)
 *
 * 📝 HITL 세션 라이프사이클:
 * 1. Interrupt 발생 → 세션 생성 (pending)
 * 2. 사용자 응답 → 세션 해결 (resolved/rejected)
 * 3. 24시간 만료 → 자동 정리 (expired)
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Phase 3 HITL 영구 저장)
 */

import type { Logger } from "@skuberplus/logger";

// ============================================
// 🎯 HITL Session 타입
// ============================================

export type HitlSessionStatus = "pending" | "resolved" | "rejected" | "expired";

/**
 * 🎯 HITL 세션 정보
 *
 * 📝 2026-01-10: 수정 - recursion_limit 타입 추가
 * 📝 2026-01-12: Auto Plan Tracker - plan_approval 타입 추가
 */
export interface HitlSession {
  /** 세션 ID (UUID) */
  id: string;
  /** LangGraph Thread ID */
  threadId: string;
  /** Interrupt 타입 */
  interruptType: "hitl" | "clarify" | "recursion_limit" | "plan_approval" | "save_report";
  /** Interrupt 페이로드 (Tool 정보, 질문 등) */
  payload: unknown;
  /** 생성 시간 (Unix timestamp) */
  createdAt: number;
  /** 상태 */
  status: HitlSessionStatus;
  /** 클러스터 ID */
  clusterId?: string;
  /** 네임스페이스 */
  namespace?: string;
  /** 해결 시간 (있는 경우) */
  resolvedAt?: number;
  /** 사용자 응답 (있는 경우) */
  userResponse?: unknown;
}

// ============================================
// 🎯 Thread Lock 타입
// ============================================

/**
 * 🎯 Thread Lock 정보
 *
 * 동시에 같은 Thread에 대해 여러 요청이 실행되는 것을 방지합니다.
 */
export interface ThreadLock {
  threadId: string;
  acquiredAt: number;
  operation: string;
}

// ============================================
// 🎯 Agent Session Manager 의존성
// ============================================

export interface AgentSessionManagerDependencies {
  readonly logger: Logger;
}

// ============================================
// 🎯 Agent Session Manager 클래스
// ============================================

/**
 * 🎯 Agent Session Manager
 *
 * HITL 세션과 Thread Lock을 관리합니다.
 */
export class AgentSessionManager {
  /** 대기 중인 HITL 세션 */
  private hitlSessions: Map<string, HitlSession> = new Map();

  /** Thread Lock */
  private threadLocks: Map<string, ThreadLock> = new Map();

  /** 세션 만료 시간 (24시간) */
  private readonly sessionExpiryMs = 24 * 60 * 60 * 1000;

  constructor(private readonly dependencies: AgentSessionManagerDependencies) {
    // 🎯 주기적 정리 시작 (1시간마다)
    setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
  }

  // ============================================
  // 🎯 HITL 세션 관리
  // ============================================

  /**
   * 🎯 HITL 세션 생성
   *
   * @param params - 세션 파라미터
   * @returns 생성된 세션
   *
   * 📝 2026-01-10: 수정 - recursion_limit 타입 지원
   * 📝 2026-01-12: Auto Plan Tracker - plan_approval 타입 추가
   */
  createHitlSession(params: {
    id: string;
    threadId: string;
    interruptType: "hitl" | "clarify" | "recursion_limit" | "plan_approval" | "save_report";
    payload: unknown;
    clusterId?: string;
    namespace?: string;
  }): HitlSession {
    const session: HitlSession = {
      id: params.id,
      threadId: params.threadId,
      interruptType: params.interruptType,
      payload: params.payload,
      createdAt: Date.now(),
      status: "pending",
      clusterId: params.clusterId,
      namespace: params.namespace,
    };

    this.hitlSessions.set(session.id, session);

    this.dependencies.logger.info("[SessionManager] HITL 세션 생성:", {
      id: session.id,
      threadId: session.threadId,
      interruptType: session.interruptType,
    });

    return session;
  }

  /**
   * 🎯 HITL 세션 조회
   */
  getHitlSession(sessionId: string): HitlSession | undefined {
    return this.hitlSessions.get(sessionId);
  }

  /**
   * 🎯 Thread의 대기 중인 HITL 세션 조회
   */
  getPendingHitlSession(threadId: string): HitlSession | undefined {
    for (const session of this.hitlSessions.values()) {
      if (session.threadId === threadId && session.status === "pending") {
        return session;
      }
    }
    return undefined;
  }

  /**
   * 🎯 모든 대기 중인 HITL 세션 조회
   */
  getAllPendingHitlSessions(): HitlSession[] {
    return Array.from(this.hitlSessions.values()).filter((session) => session.status === "pending");
  }

  /**
   * 🎯 HITL 세션 해결
   */
  resolveHitlSession(sessionId: string, response: unknown): boolean {
    const session = this.hitlSessions.get(sessionId);
    if (!session || session.status !== "pending") {
      return false;
    }

    session.status = "resolved";
    session.resolvedAt = Date.now();
    session.userResponse = response;

    this.dependencies.logger.info("[SessionManager] HITL 세션 해결:", {
      id: sessionId,
      response,
    });

    return true;
  }

  /**
   * 🎯 HITL 세션 거절
   */
  rejectHitlSession(sessionId: string, reason?: string): boolean {
    const session = this.hitlSessions.get(sessionId);
    if (!session || session.status !== "pending") {
      return false;
    }

    session.status = "rejected";
    session.resolvedAt = Date.now();
    session.userResponse = { rejected: true, reason };

    this.dependencies.logger.info("[SessionManager] HITL 세션 거절:", {
      id: sessionId,
      reason,
    });

    return true;
  }

  /**
   * 🎯 HITL 세션 삭제
   */
  deleteHitlSession(sessionId: string): boolean {
    return this.hitlSessions.delete(sessionId);
  }

  // ============================================
  // 🎯 Thread Lock 관리
  // ============================================

  /**
   * 🎯 Thread Lock 획득
   *
   * @returns Lock 획득 성공 여부
   */
  acquireThreadLock(threadId: string, operation: string): boolean {
    const existingLock = this.threadLocks.get(threadId);

    if (existingLock) {
      // 🎯 5분 이상 된 Lock은 해제
      if (Date.now() - existingLock.acquiredAt > 5 * 60 * 1000) {
        this.dependencies.logger.warn("[SessionManager] 오래된 Lock 강제 해제:", existingLock);
        this.threadLocks.delete(threadId);
      } else {
        return false;
      }
    }

    this.threadLocks.set(threadId, {
      threadId,
      acquiredAt: Date.now(),
      operation,
    });

    return true;
  }

  /**
   * 🎯 Thread Lock 해제
   */
  releaseThreadLock(threadId: string): boolean {
    return this.threadLocks.delete(threadId);
  }

  /**
   * 🎯 Thread Lock 확인
   */
  hasThreadLock(threadId: string): boolean {
    return this.threadLocks.has(threadId);
  }

  // ============================================
  // 🎯 정리 및 유틸리티
  // ============================================

  /**
   * 🎯 만료된 세션 정리
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, session] of this.hitlSessions) {
      if (session.status === "pending" && now - session.createdAt > this.sessionExpiryMs) {
        session.status = "expired";
        session.resolvedAt = now;
        this.hitlSessions.delete(id);
        cleanedCount++;

        this.dependencies.logger.info("[SessionManager] 만료된 HITL 세션 정리:", id);
      }
    }

    // 🎯 해결/거절된 오래된 세션도 정리 (7일)
    const resolvedExpiryMs = 7 * 24 * 60 * 60 * 1000;
    for (const [id, session] of this.hitlSessions) {
      if (
        (session.status === "resolved" || session.status === "rejected") &&
        session.resolvedAt &&
        now - session.resolvedAt > resolvedExpiryMs
      ) {
        this.hitlSessions.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.dependencies.logger.info("[SessionManager] 세션 정리 완료:", cleanedCount);
    }

    return cleanedCount;
  }

  /**
   * 🎯 세션 통계 반환
   */
  getSessionStats(): {
    pendingHitl: number;
    resolvedHitl: number;
    activeLocks: number;
  } {
    let pendingHitl = 0;
    let resolvedHitl = 0;

    for (const session of this.hitlSessions.values()) {
      if (session.status === "pending") pendingHitl++;
      if (session.status === "resolved") resolvedHitl++;
    }

    return {
      pendingHitl,
      resolvedHitl,
      activeLocks: this.threadLocks.size,
    };
  }

  /**
   * 🎯 전체 리셋 (테스트용)
   */
  reset(): void {
    this.hitlSessions.clear();
    this.threadLocks.clear();
    this.dependencies.logger.info("[SessionManager] 전체 리셋");
  }
}
