/**
 * 🎯 목적: useSessionRestore 훅 테스트
 * 02: 세션 복원 UI
 *
 * 📝 테스트 케이스:
 * - 초기 상태
 * - 세션 로드
 * - 검색/필터
 * - 정렬
 * - 페이지네이션
 * - 세션 선택/삭제/생성
 * - 키보드 네비게이션
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (02)
 *
 * @packageDocumentation
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { useSessionRestore } from "../use-session-restore";

import type { SessionState } from "../../../common/session-state";
import type { SessionSummary } from "../../../common/session-types";

// ============================================
// 🎯 Mock 설정
// ============================================

/**
 * 테스트용 세션 요약 생성
 */
function createMockSessionSummary(overrides?: Partial<SessionSummary>): SessionSummary {
  const id = overrides?.id ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    title: overrides?.title ?? "테스트 세션",
    status: overrides?.status ?? "active",
    messageCount: overrides?.messageCount ?? 5,
    checkpointCount: overrides?.checkpointCount ?? 2,
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: overrides?.updatedAt ?? new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock SessionState 생성
 */
function createMockSessionState(overrides?: Partial<SessionState>): jest.Mocked<SessionState> {
  return {
    sessions: [],
    currentSession: null,
    isLoading: false,
    error: null,
    totalSessions: 0,
    hasMore: false,
    hasCurrentSession: false,
    hasError: false,
    sessionCount: 0,
    currentSessionId: null,
    currentSessionTitle: null,
    currentMessages: [],
    currentCheckpoints: [],
    messageCount: 0,
    checkpointCount: 0,
    currentOffset: 0,
    pageSize: 20,
    loadSessions: jest.fn(),
    loadMoreSessions: jest.fn(),
    refreshSessions: jest.fn(),
    createNewSession: jest.fn(),
    selectSession: jest.fn(),
    closeCurrentSession: jest.fn(),
    updateCurrentSessionTitle: jest.fn(),
    deleteSession: jest.fn(),
    refreshCurrentSession: jest.fn(),
    addUserMessage: jest.fn(),
    addAssistantMessage: jest.fn(),
    createCheckpoint: jest.fn(),
    rollbackToCheckpoint: jest.fn(),
    exportCurrentSession: jest.fn(),
    importSession: jest.fn(),
    cleanupExpiredSessions: jest.fn(),
    clearError: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  } as jest.Mocked<SessionState>;
}

// ============================================
// 🎯 테스트 Suite
// ============================================

describe("useSessionRestore", () => {
  let mockSessionState: jest.Mocked<SessionState>;

  beforeEach(() => {
    mockSessionState = createMockSessionState();
    jest.clearAllMocks();
  });

  // ----------------------------------------
  // 초기 상태 테스트
  // ----------------------------------------
  describe("초기 상태", () => {
    it("초기 세션 목록이 빈 배열이어야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      expect(result.current.sessions).toEqual([]);
    });

    it("초기 로딩 상태가 false여야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      expect(result.current.isLoading).toBe(false);
    });

    it("초기 에러가 null이어야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      expect(result.current.error).toBeNull();
    });

    it("초기 검색어가 빈 문자열이어야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      expect(result.current.searchQuery).toBe("");
    });

    it("초기 정렬 옵션이 newest여야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      expect(result.current.sortOption).toBe("newest");
    });

    it("초기 하이라이트 인덱스가 -1이어야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      expect(result.current.highlightedIndex).toBe(-1);
    });
  });

  // ----------------------------------------
  // 자동 로드 테스트
  // ----------------------------------------
  describe("자동 로드", () => {
    it("autoLoad가 true일 때 마운트 시 세션을 로드해야 한다", async () => {
      renderHook(() => useSessionRestore(mockSessionState, { autoLoad: true }));

      await waitFor(() => {
        expect(mockSessionState.loadSessions).toHaveBeenCalled();
      });
    });

    it("autoLoad가 false일 때 마운트 시 세션을 로드하지 않아야 한다", () => {
      renderHook(() => useSessionRestore(mockSessionState, { autoLoad: false }));

      expect(mockSessionState.loadSessions).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------
  // 세션 목록 테스트
  // ----------------------------------------
  describe("세션 목록", () => {
    it("SessionState의 세션 목록을 반환해야 한다", () => {
      const sessions = [
        createMockSessionSummary({ id: "1", title: "세션 1" }),
        createMockSessionSummary({ id: "2", title: "세션 2" }),
      ];
      mockSessionState.sessions = sessions;

      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      expect(result.current.sessions).toEqual(sessions);
    });

    it("SessionState의 총 개수를 반환해야 한다", () => {
      mockSessionState.totalSessions = 100;

      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      expect(result.current.totalCount).toBe(100);
    });

    it("SessionState의 hasMore를 반환해야 한다", () => {
      mockSessionState.hasMore = true;

      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      expect(result.current.hasMore).toBe(true);
    });
  });

  // ----------------------------------------
  // 검색 기능 테스트
  // ----------------------------------------
  describe("검색 기능", () => {
    it("검색어를 설정할 수 있어야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      act(() => {
        result.current.setSearchQuery("쿠버네티스");
      });

      expect(result.current.searchQuery).toBe("쿠버네티스");
    });

    it("검색어 변경 시 검색 상태가 업데이트되어야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      act(() => {
        result.current.setSearchQuery("테스트");
      });

      // 클라이언트 사이드 필터링이므로 loadSessions 재호출 없이 상태만 업데이트
      expect(result.current.searchQuery).toBe("테스트");
    });
  });

  // ----------------------------------------
  // 정렬 기능 테스트
  // ----------------------------------------
  describe("정렬 기능", () => {
    it("정렬 옵션을 변경할 수 있어야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      act(() => {
        result.current.setSortOption("oldest");
      });

      expect(result.current.sortOption).toBe("oldest");
    });

    it("초기 정렬 옵션을 지정할 수 있어야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState, { initialSort: "alphabetical" }));

      expect(result.current.sortOption).toBe("alphabetical");
    });
  });

  // ----------------------------------------
  // 세션 선택 테스트
  // ----------------------------------------
  describe("세션 선택", () => {
    it("세션을 선택할 수 있어야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      act(() => {
        result.current.selectSession("session-123");
      });

      expect(result.current.selectedSessionId).toBe("session-123");
    });
  });

  // ----------------------------------------
  // 세션 삭제 테스트
  // ----------------------------------------
  describe("세션 삭제", () => {
    it("세션을 삭제할 수 있어야 한다", async () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      await act(async () => {
        await result.current.deleteSession("session-123");
      });

      expect(mockSessionState.deleteSession).toHaveBeenCalledWith("session-123");
    });
  });

  // ----------------------------------------
  // 새 세션 생성 테스트
  // ----------------------------------------
  describe("새 세션 생성", () => {
    it("새 세션을 생성할 수 있어야 한다", async () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      await act(async () => {
        await result.current.createNewSession("새 대화");
      });

      expect(mockSessionState.createNewSession).toHaveBeenCalledWith({ title: "새 대화" });
    });

    it("제목 없이 새 세션을 생성할 수 있어야 한다", async () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      await act(async () => {
        await result.current.createNewSession();
      });

      expect(mockSessionState.createNewSession).toHaveBeenCalledWith({ title: undefined });
    });
  });

  // ----------------------------------------
  // 페이지네이션 테스트
  // ----------------------------------------
  describe("페이지네이션", () => {
    it("더 많은 세션을 로드할 수 있어야 한다", async () => {
      mockSessionState.hasMore = true;
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      await act(async () => {
        await result.current.loadMore();
      });

      expect(mockSessionState.loadMoreSessions).toHaveBeenCalled();
    });

    it("hasMore가 false면 로드하지 않아야 한다", async () => {
      mockSessionState.hasMore = false;
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      await act(async () => {
        await result.current.loadMore();
      });

      expect(mockSessionState.loadMoreSessions).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------
  // 키보드 네비게이션 테스트
  // ----------------------------------------
  describe("키보드 네비게이션", () => {
    it("하이라이트를 아래로 이동할 수 있어야 한다", () => {
      mockSessionState.sessions = [createMockSessionSummary({ id: "1" }), createMockSessionSummary({ id: "2" })];
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      act(() => {
        result.current.moveHighlightDown();
      });

      expect(result.current.highlightedIndex).toBe(0);
    });

    it("하이라이트를 위로 이동할 수 있어야 한다", () => {
      mockSessionState.sessions = [createMockSessionSummary({ id: "1" }), createMockSessionSummary({ id: "2" })];
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      // 먼저 아래로 이동
      act(() => {
        result.current.moveHighlightDown();
        result.current.moveHighlightDown();
      });

      // 위로 이동
      act(() => {
        result.current.moveHighlightUp();
      });

      expect(result.current.highlightedIndex).toBe(0);
    });

    it("하이라이트가 목록 범위를 벗어나지 않아야 한다", () => {
      mockSessionState.sessions = [createMockSessionSummary({ id: "1" })];
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      // 여러 번 아래로 이동
      act(() => {
        result.current.moveHighlightDown();
        result.current.moveHighlightDown();
        result.current.moveHighlightDown();
      });

      expect(result.current.highlightedIndex).toBe(0);
    });

    it("하이라이트된 세션을 선택할 수 있어야 한다", () => {
      mockSessionState.sessions = [createMockSessionSummary({ id: "session-1" })];
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      act(() => {
        result.current.moveHighlightDown();
        result.current.selectHighlighted();
      });

      expect(result.current.selectedSessionId).toBe("session-1");
    });
  });

  // ----------------------------------------
  // 새로고침 테스트
  // ----------------------------------------
  describe("새로고침", () => {
    it("세션 목록을 새로고침할 수 있어야 한다", async () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockSessionState.refreshSessions).toHaveBeenCalled();
    });
  });

  // ----------------------------------------
  // 내보내기/가져오기 테스트
  // ----------------------------------------
  describe("내보내기/가져오기", () => {
    it("세션을 내보낼 수 있어야 한다", async () => {
      mockSessionState.exportCurrentSession.mockResolvedValue('{"id":"test"}');
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      let exportedData: string | undefined;
      await act(async () => {
        exportedData = await result.current.exportSession("session-123");
      });

      expect(mockSessionState.selectSession).toHaveBeenCalledWith("session-123");
    });

    it("세션을 가져올 수 있어야 한다", async () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      await act(async () => {
        await result.current.importSession('{"id":"imported"}');
      });

      expect(mockSessionState.importSession).toHaveBeenCalledWith('{"id":"imported"}');
    });
  });

  // ----------------------------------------
  // 에러 처리 테스트
  // ----------------------------------------
  describe("에러 처리", () => {
    it("SessionState의 에러를 반환해야 한다", () => {
      const error = new Error("로드 실패");
      mockSessionState.error = error;

      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      expect(result.current.error).toBe(error);
    });

    it("에러를 초기화할 수 있어야 한다", () => {
      const { result } = renderHook(() => useSessionRestore(mockSessionState));

      act(() => {
        result.current.clearError();
      });

      expect(mockSessionState.clearError).toHaveBeenCalled();
    });
  });
});
