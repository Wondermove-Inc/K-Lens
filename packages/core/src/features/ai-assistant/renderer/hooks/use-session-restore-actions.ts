/**
 * 🎯 목적: useSessionRestore 훅 액션 헬퍼
 * 02: 세션 복원 UI
 *
 * 📝 주요 기능:
 * - 세션 관리 액션 생성 (삭제, 생성, 내보내기, 가져오기)
 * - 페이지네이션 액션
 * - 에러 처리 액션
 *
 * 📁 분할 배경:
 * - use-session-restore.ts의 300줄 제한 준수를 위해 분할
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (02)
 *
 * @packageDocumentation
 */

import { useCallback } from "react";

import type { SessionState } from "../../common/session-state";

// ============================================
// 🎯 액션 생성 훅 타입
// ============================================

/**
 * 세션 관리 액션 반환 타입
 */
export interface SessionManagementActions {
  /** 세션 삭제 */
  deleteSession: (sessionId: string) => Promise<void>;
  /** 새 세션 생성 */
  createNewSession: (title?: string) => Promise<void>;
  /** 세션 내보내기 */
  exportSession: (sessionId: string) => Promise<string | undefined>;
  /** 세션 가져오기 */
  importSession: (jsonData: string) => Promise<void>;
  /** 더 보기 (페이지네이션) */
  loadMore: () => Promise<void>;
  /** 새로고침 */
  refresh: () => Promise<void>;
  /** 에러 초기화 */
  clearError: () => void;
}

// ============================================
// 🎯 세션 관리 액션 훅
// ============================================

/**
 * useSessionManagementActions 훅
 *
 * 🎯 목적: SessionState와 연동한 세션 관리 액션 제공
 *
 * @param sessionState - SessionState 인스턴스
 * @returns SessionManagementActions - 세션 관리 액션
 */
export function useSessionManagementActions(sessionState: SessionState): SessionManagementActions {
  // ============================================
  // 세션 삭제
  // ============================================

  /**
   * 세션 삭제
   *
   * @param sessionId - 삭제할 세션 ID
   */
  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      await sessionState.deleteSession(sessionId);
    },
    [sessionState],
  );

  // ============================================
  // 세션 생성
  // ============================================

  /**
   * 새 세션 생성
   *
   * @param title - 세션 제목 (선택)
   */
  const createNewSession = useCallback(
    async (title?: string): Promise<void> => {
      await sessionState.createNewSession({ title });
    },
    [sessionState],
  );

  // ============================================
  // 페이지네이션
  // ============================================

  /**
   * 더 많은 세션 로드
   */
  const loadMore = useCallback(async (): Promise<void> => {
    if (sessionState.hasMore) {
      await sessionState.loadMoreSessions();
    }
  }, [sessionState]);

  // ============================================
  // 새로고침
  // ============================================

  /**
   * 세션 목록 새로고침
   */
  const refresh = useCallback(async (): Promise<void> => {
    await sessionState.refreshSessions();
  }, [sessionState]);

  // ============================================
  // 내보내기/가져오기
  // ============================================

  /**
   * 세션 내보내기
   *
   * @param sessionId - 내보낼 세션 ID
   * @returns JSON 데이터 문자열
   */
  const exportSession = useCallback(
    async (sessionId: string): Promise<string | undefined> => {
      // 해당 세션 선택 후 내보내기
      await sessionState.selectSession(sessionId);
      return sessionState.exportCurrentSession();
    },
    [sessionState],
  );

  /**
   * 세션 가져오기
   *
   * @param jsonData - JSON 데이터 문자열
   */
  const importSession = useCallback(
    async (jsonData: string): Promise<void> => {
      await sessionState.importSession(jsonData);
    },
    [sessionState],
  );

  // ============================================
  // 에러 처리
  // ============================================

  /**
   * 에러 초기화
   */
  const clearError = useCallback(() => {
    sessionState.clearError();
  }, [sessionState]);

  return {
    deleteSession,
    createNewSession,
    exportSession,
    importSession,
    loadMore,
    refresh,
    clearError,
  };
}
