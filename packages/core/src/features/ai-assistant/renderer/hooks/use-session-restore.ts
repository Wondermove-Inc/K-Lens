/**
 * 🎯 목적: useSessionRestore 커스텀 훅
 * 02: 세션 복원 UI
 *
 * 📝 주요 기능:
 * - SessionState와 연동한 세션 관리
 * - 검색/정렬/페이지네이션
 * - 키보드 네비게이션 지원
 * - 세션 선택/삭제/생성/내보내기/가져오기
 *
 * 📁 파일 분할:
 * - use-session-restore.ts: 메인 훅 (상태, 검색, 정렬, 키보드 네비게이션)
 * - use-session-restore-actions.ts: 세션 관리 액션 (삭제, 생성, 내보내기 등)
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (02)
 * - 2026-01-05: 파일 분할 (300줄 제한)
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSessionManagementActions } from "./use-session-restore-actions";

import type {
  SessionSortOption,
  UseSessionRestoreOptions,
  UseSessionRestoreReturn,
} from "../../common/session-restore-types";
import type { SessionState } from "../../common/session-state";

// ============================================
// 🎯 기본 옵션
// ============================================

/** 기본 훅 옵션 */
const DEFAULT_OPTIONS: Required<UseSessionRestoreOptions> = {
  autoLoad: false,
  initialSort: "newest",
  pageSize: 20,
};

// ============================================
// 🎯 메인 훅
// ============================================

/**
 * useSessionRestore 훅
 *
 * 🎯 목적: 세션 복원 UI를 위한 상태 및 액션 제공
 *
 * 📝 주의사항:
 * - SessionState와 연동하여 실제 데이터 관리
 * - 검색, 정렬, 페이지네이션 기능 포함
 * - 키보드 네비게이션 지원
 *
 * @param sessionState - SessionState 인스턴스
 * @param options - 훅 옵션 (autoLoad, initialSort, pageSize)
 * @returns UseSessionRestoreReturn - 상태 및 액션
 */
export function useSessionRestore(
  sessionState: SessionState,
  options?: UseSessionRestoreOptions,
): UseSessionRestoreReturn {
  // 옵션 병합
  const mergedOptions = useMemo(
    () => ({
      ...DEFAULT_OPTIONS,
      ...options,
    }),
    [options],
  );

  // 로컬 상태
  const [searchQuery, setSearchQueryState] = useState("");
  const [sortOption, setSortOptionState] = useState<SessionSortOption>(mergedOptions.initialSort);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // 현재 하이라이트 인덱스를 ref로 추적 (콜백에서 최신 값 접근용)
  const highlightedIndexRef = useRef(highlightedIndex);
  highlightedIndexRef.current = highlightedIndex;

  // 세션 관리 액션 (분할된 훅에서 가져옴)
  const managementActions = useSessionManagementActions(sessionState);

  // ============================================
  // 자동 로드
  // ============================================

  useEffect(() => {
    if (mergedOptions.autoLoad) {
      void sessionState.loadSessions();
    }
  }, [mergedOptions.autoLoad, sessionState]);

  // ============================================
  // 검색 기능
  // ============================================

  /**
   * 검색어 설정
   *
   * 📝 주의사항:
   * - 검색 필터링은 클라이언트 사이드에서 처리
   * - SessionListOptions에는 search 옵션이 없으므로
   *   sessions 배열을 필터링하여 검색 결과 표시
   *
   * @param query - 검색어
   */
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    // 클라이언트 사이드 필터링을 위해 상태만 업데이트
    // 실제 필터링은 sessions getter에서 searchQuery로 처리
  }, []);

  // ============================================
  // 정렬 기능
  // ============================================

  /**
   * 정렬 옵션 설정
   *
   * @param option - 정렬 옵션
   */
  const setSortOption = useCallback((option: SessionSortOption) => {
    setSortOptionState(option);
  }, []);

  // ============================================
  // 세션 선택
  // ============================================

  /**
   * 세션 ID로 세션 선택
   *
   * @param sessionId - 세션 ID
   */
  const selectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  // ============================================
  // 키보드 네비게이션
  // ============================================

  /**
   * 하이라이트 위로 이동
   */
  const moveHighlightUp = useCallback(() => {
    setHighlightedIndex((prev) => {
      const newIndex = Math.max(prev - 1, -1);
      highlightedIndexRef.current = newIndex;
      return newIndex;
    });
  }, []);

  /**
   * 하이라이트 아래로 이동
   */
  const moveHighlightDown = useCallback(() => {
    const maxIndex = sessionState.sessions.length - 1;
    setHighlightedIndex((prev) => {
      const newIndex = Math.min(prev + 1, maxIndex);
      highlightedIndexRef.current = newIndex;
      return newIndex;
    });
  }, [sessionState.sessions.length]);

  /**
   * 하이라이트된 세션 선택
   *
   * 📝 주의사항:
   * - highlightedIndexRef를 사용하여 최신 인덱스 값에 접근
   * - 같은 act 블록에서 moveHighlightDown 후 호출되어도 정상 동작
   */
  const selectHighlighted = useCallback(() => {
    const currentIndex = highlightedIndexRef.current;
    if (currentIndex >= 0 && currentIndex < sessionState.sessions.length) {
      const session = sessionState.sessions[currentIndex];
      setSelectedSessionId(session.id);
    }
  }, [sessionState.sessions]);

  // ============================================
  // 반환 객체
  // ============================================

  return {
    // 상태 (SessionState에서)
    sessions: sessionState.sessions,
    isLoading: sessionState.isLoading,
    error: sessionState.error,
    totalCount: sessionState.totalSessions,
    hasMore: sessionState.hasMore,

    // 로컬 상태
    searchQuery,
    sortOption,
    selectedSessionId,
    highlightedIndex,

    // 검색/정렬 액션
    setSearchQuery,
    setSortOption,

    // 세션 관리 액션 (분할된 훅에서 가져옴)
    selectSession,
    deleteSession: managementActions.deleteSession,
    exportSession: managementActions.exportSession,
    importSession: managementActions.importSession,
    createNewSession: managementActions.createNewSession,

    // 페이지네이션/새로고침 (분할된 훅에서 가져옴)
    loadMore: managementActions.loadMore,
    refresh: managementActions.refresh,

    // 키보드 네비게이션
    moveHighlightUp,
    moveHighlightDown,
    selectHighlighted,

    // 에러 처리 (분할된 훅에서 가져옴)
    clearError: managementActions.clearError,
  };
}
