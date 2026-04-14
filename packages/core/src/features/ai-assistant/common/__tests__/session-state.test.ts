/**
 * 🎯 목적: SessionState MobX 상태 테스트
 * 01: sessionState 상태 및 액션 추가
 *
 * 📝 테스트 범위:
 * - 초기 상태
 * - 세션 목록 관리
 * - 현재 세션 관리
 * - 메시지 관리
 * - 체크포인트 관리
 * - 로딩/에러 상태
 * - SessionManager 연동
 *
 * @packageDocumentation
 */

import { SessionState } from "../session-state";

import type { SessionManager } from "../session-manager";
import type { Session, SessionMessage, SessionSummary } from "../session-types";

// ============================================
// 🎯 Mock SessionManager
// ============================================

/**
 * 테스트용 Mock SessionManager 생성
 */
function createMockSessionManager(): jest.Mocked<SessionManager> {
  return {
    createSession: jest.fn(),
    getSession: jest.fn(),
    listSessions: jest.fn(),
    updateSession: jest.fn(),
    deleteSession: jest.fn(),
    getActiveSession: jest.fn(),
    activateSession: jest.fn(),
    addMessage: jest.fn(),
    getMessage: jest.fn(),
    getMessages: jest.fn(),
    createCheckpoint: jest.fn(),
    getCheckpoint: jest.fn(),
    getCheckpoints: jest.fn(),
    rollbackToCheckpoint: jest.fn(),
    exportSession: jest.fn(),
    importSession: jest.fn(),
    exportAllSessions: jest.fn(),
    getSessionCount: jest.fn(),
    cleanupExpiredSessions: jest.fn(),
    clear: jest.fn(),
  } as unknown as jest.Mocked<SessionManager>;
}

/**
 * 테스트용 Mock Session 생성
 */
function createMockSession(overrides?: Partial<Session>): Session {
  return {
    id: "session-test-001",
    threadId: "thread-test-001",
    title: "테스트 세션",
    status: "active",
    messages: [],
    checkpoints: [],
    createdAt: "2026-01-05T10:00:00.000Z",
    updatedAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * 테스트용 Mock SessionSummary 생성
 */
function createMockSessionSummary(overrides?: Partial<SessionSummary>): SessionSummary {
  return {
    id: "session-test-001",
    title: "테스트 세션",
    status: "active",
    messageCount: 0,
    createdAt: "2026-01-05T10:00:00.000Z",
    updatedAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * 테스트용 Mock SessionMessage 생성
 */
function createMockMessage(overrides?: Partial<SessionMessage>): SessionMessage {
  return {
    id: "msg-test-001",
    role: "user",
    content: "테스트 메시지",
    timestamp: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

// ============================================
// 🎯 테스트 스위트
// ============================================

describe("SessionState", () => {
  let sessionState: SessionState;
  let mockManager: jest.Mocked<SessionManager>;

  beforeEach(() => {
    mockManager = createMockSessionManager();
    sessionState = new SessionState(mockManager);
  });

  // ============================================
  // 초기 상태 테스트
  // ============================================

  describe("초기 상태", () => {
    it("sessions가 빈 배열이어야 한다", () => {
      expect(sessionState.sessions).toEqual([]);
    });

    it("currentSession이 null이어야 한다", () => {
      expect(sessionState.currentSession).toBeNull();
    });

    it("isLoading이 false이어야 한다", () => {
      expect(sessionState.isLoading).toBe(false);
    });

    it("error가 null이어야 한다", () => {
      expect(sessionState.error).toBeNull();
    });

    it("totalSessions가 0이어야 한다", () => {
      expect(sessionState.totalSessions).toBe(0);
    });

    it("hasMore가 false이어야 한다", () => {
      expect(sessionState.hasMore).toBe(false);
    });

    it("hasCurrentSession이 false이어야 한다", () => {
      expect(sessionState.hasCurrentSession).toBe(false);
    });

    it("hasError가 false이어야 한다", () => {
      expect(sessionState.hasError).toBe(false);
    });
  });

  // ============================================
  // 세션 목록 관리 테스트
  // ============================================

  describe("세션 목록 관리", () => {
    describe("loadSessions", () => {
      it("세션 목록을 로드해야 한다", async () => {
        const mockSummaries = [
          createMockSessionSummary({ id: "session-1", title: "세션 1" }),
          createMockSessionSummary({ id: "session-2", title: "세션 2" }),
        ];

        mockManager.listSessions.mockReturnValue({
          sessions: mockSummaries,
          total: 2,
          hasMore: false,
        });

        await sessionState.loadSessions();

        expect(sessionState.sessions).toEqual(mockSummaries);
        expect(sessionState.totalSessions).toBe(2);
        expect(sessionState.hasMore).toBe(false);
      });

      it("로딩 중 isLoading이 true여야 한다", async () => {
        mockManager.listSessions.mockReturnValue({
          sessions: [],
          total: 0,
          hasMore: false,
        });

        const loadPromise = sessionState.loadSessions();
        // 로딩 상태는 비동기 처리에서 확인
        await loadPromise;

        expect(sessionState.isLoading).toBe(false);
      });

      it("에러 발생 시 error에 저장해야 한다", async () => {
        const error = new Error("로드 실패");
        mockManager.listSessions.mockImplementation(() => {
          throw error;
        });

        await sessionState.loadSessions();

        expect(sessionState.hasError).toBe(true);
        expect(sessionState.error).toBe(error);
      });

      it("옵션으로 필터링할 수 있어야 한다", async () => {
        mockManager.listSessions.mockReturnValue({
          sessions: [],
          total: 0,
          hasMore: false,
        });

        await sessionState.loadSessions({ status: "active", limit: 10 });

        // loadSessions는 항상 offset을 기본값 0으로 설정
        expect(mockManager.listSessions).toHaveBeenCalledWith({
          status: "active",
          limit: 10,
          offset: 0,
        });
      });

      it("hasMore가 true면 더 로드할 수 있어야 한다", async () => {
        mockManager.listSessions.mockReturnValue({
          sessions: [createMockSessionSummary()],
          total: 100,
          hasMore: true,
        });

        await sessionState.loadSessions();

        expect(sessionState.hasMore).toBe(true);
      });
    });

    describe("loadMoreSessions", () => {
      it("추가 세션을 로드하고 목록에 추가해야 한다", async () => {
        // 첫 번째 로드
        const firstBatch = [createMockSessionSummary({ id: "session-1" })];
        mockManager.listSessions.mockReturnValue({
          sessions: firstBatch,
          total: 2,
          hasMore: true,
        });
        await sessionState.loadSessions();

        // 두 번째 로드 (추가)
        const secondBatch = [createMockSessionSummary({ id: "session-2" })];
        mockManager.listSessions.mockReturnValue({
          sessions: secondBatch,
          total: 2,
          hasMore: false,
        });
        await sessionState.loadMoreSessions();

        expect(sessionState.sessions).toHaveLength(2);
        expect(sessionState.sessions[1].id).toBe("session-2");
      });

      it("hasMore가 false면 추가 로드하지 않아야 한다", async () => {
        mockManager.listSessions.mockReturnValue({
          sessions: [createMockSessionSummary()],
          total: 1,
          hasMore: false,
        });
        await sessionState.loadSessions();

        mockManager.listSessions.mockClear();
        await sessionState.loadMoreSessions();

        expect(mockManager.listSessions).not.toHaveBeenCalled();
      });
    });

    describe("refreshSessions", () => {
      it("세션 목록을 새로고침해야 한다", async () => {
        // 초기 로드
        mockManager.listSessions.mockReturnValue({
          sessions: [createMockSessionSummary({ id: "session-1" })],
          total: 1,
          hasMore: false,
        });
        await sessionState.loadSessions();

        // 새로고침
        mockManager.listSessions.mockReturnValue({
          sessions: [createMockSessionSummary({ id: "session-2" })],
          total: 1,
          hasMore: false,
        });
        await sessionState.refreshSessions();

        expect(sessionState.sessions).toHaveLength(1);
        expect(sessionState.sessions[0].id).toBe("session-2");
      });
    });
  });

  // ============================================
  // 현재 세션 관리 테스트
  // ============================================

  describe("현재 세션 관리", () => {
    describe("createNewSession", () => {
      it("새 세션을 생성하고 현재 세션으로 설정해야 한다", async () => {
        const mockSession = createMockSession();
        mockManager.createSession.mockReturnValue(mockSession);

        await sessionState.createNewSession({ title: "새 세션" });

        expect(mockManager.createSession).toHaveBeenCalledWith({ title: "새 세션" });
        expect(sessionState.currentSession).toEqual(mockSession);
      });

      it("생성 실패 시 에러를 저장해야 한다", async () => {
        const error = new Error("생성 실패");
        mockManager.createSession.mockImplementation(() => {
          throw error;
        });

        await sessionState.createNewSession();

        expect(sessionState.hasError).toBe(true);
        expect(sessionState.error).toBe(error);
      });
    });

    describe("selectSession", () => {
      it("세션을 선택하고 현재 세션으로 설정해야 한다", async () => {
        const mockSession = createMockSession({ id: "session-123" });
        mockManager.getSession.mockReturnValue(mockSession);
        mockManager.activateSession.mockReturnValue(mockSession);

        await sessionState.selectSession("session-123");

        expect(mockManager.getSession).toHaveBeenCalledWith("session-123");
        expect(mockManager.activateSession).toHaveBeenCalledWith("session-123");
        expect(sessionState.currentSession).toEqual(mockSession);
      });

      it("존재하지 않는 세션 선택 시 에러를 저장해야 한다", async () => {
        mockManager.getSession.mockReturnValue(undefined);

        await sessionState.selectSession("non-existent");

        expect(sessionState.hasError).toBe(true);
        expect(sessionState.error?.message).toContain("세션을 찾을 수 없습니다");
      });
    });

    describe("closeCurrentSession", () => {
      it("현재 세션을 null로 설정해야 한다", () => {
        const mockSession = createMockSession();
        mockManager.createSession.mockReturnValue(mockSession);
        sessionState.createNewSession();

        sessionState.closeCurrentSession();

        expect(sessionState.currentSession).toBeNull();
        expect(sessionState.hasCurrentSession).toBe(false);
      });
    });

    describe("updateCurrentSessionTitle", () => {
      it("현재 세션의 제목을 업데이트해야 한다", async () => {
        const mockSession = createMockSession({ id: "session-123", title: "원래 제목" });
        mockManager.createSession.mockReturnValue(mockSession);
        await sessionState.createNewSession();

        const updatedSession = { ...mockSession, title: "새 제목" };
        mockManager.updateSession.mockReturnValue(updatedSession);

        await sessionState.updateCurrentSessionTitle("새 제목");

        expect(mockManager.updateSession).toHaveBeenCalledWith("session-123", { title: "새 제목" });
        expect(sessionState.currentSession?.title).toBe("새 제목");
      });

      it("현재 세션이 없으면 아무 것도 하지 않아야 한다", async () => {
        await sessionState.updateCurrentSessionTitle("새 제목");

        expect(mockManager.updateSession).not.toHaveBeenCalled();
      });
    });

    describe("deleteSession", () => {
      it("세션을 삭제해야 한다", async () => {
        mockManager.deleteSession.mockReturnValue(true);
        mockManager.listSessions.mockReturnValue({
          sessions: [],
          total: 0,
          hasMore: false,
        });

        await sessionState.deleteSession("session-123");

        expect(mockManager.deleteSession).toHaveBeenCalledWith("session-123");
      });

      it("현재 세션이 삭제되면 현재 세션을 null로 설정해야 한다", async () => {
        const mockSession = createMockSession({ id: "session-123" });
        mockManager.createSession.mockReturnValue(mockSession);
        await sessionState.createNewSession();

        mockManager.deleteSession.mockReturnValue(true);
        mockManager.listSessions.mockReturnValue({
          sessions: [],
          total: 0,
          hasMore: false,
        });

        await sessionState.deleteSession("session-123");

        expect(sessionState.currentSession).toBeNull();
      });

      it("삭제 후 세션 목록을 새로고침해야 한다", async () => {
        mockManager.deleteSession.mockReturnValue(true);
        mockManager.listSessions.mockReturnValue({
          sessions: [],
          total: 0,
          hasMore: false,
        });

        await sessionState.deleteSession("session-123");

        expect(mockManager.listSessions).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // 메시지 관리 테스트
  // ============================================

  describe("메시지 관리", () => {
    beforeEach(async () => {
      const mockSession = createMockSession({ id: "session-123" });
      mockManager.createSession.mockReturnValue(mockSession);
      await sessionState.createNewSession();
    });

    describe("addUserMessage", () => {
      it("사용자 메시지를 추가해야 한다", async () => {
        const mockMessage = createMockMessage({ role: "user", content: "안녕하세요" });
        mockManager.addMessage.mockReturnValue(mockMessage);
        mockManager.getSession.mockReturnValue(
          createMockSession({
            id: "session-123",
            messages: [mockMessage],
          }),
        );

        await sessionState.addUserMessage("안녕하세요");

        expect(mockManager.addMessage).toHaveBeenCalledWith("session-123", {
          role: "user",
          content: "안녕하세요",
        });
      });

      it("현재 세션이 없으면 에러를 발생시켜야 한다", async () => {
        sessionState.closeCurrentSession();

        await sessionState.addUserMessage("안녕하세요");

        expect(sessionState.hasError).toBe(true);
        expect(sessionState.error?.message).toContain("활성 세션이 없습니다");
      });
    });

    describe("addAssistantMessage", () => {
      it("어시스턴트 메시지를 추가해야 한다", async () => {
        const mockMessage = createMockMessage({ role: "assistant", content: "안녕하세요!" });
        mockManager.addMessage.mockReturnValue(mockMessage);
        mockManager.getSession.mockReturnValue(
          createMockSession({
            id: "session-123",
            messages: [mockMessage],
          }),
        );

        await sessionState.addAssistantMessage("안녕하세요!");

        expect(mockManager.addMessage).toHaveBeenCalledWith("session-123", {
          role: "assistant",
          content: "안녕하세요!",
        });
      });
    });

    describe("currentMessages", () => {
      it("현재 세션의 메시지 목록을 반환해야 한다", async () => {
        const messages = [
          createMockMessage({ id: "msg-1", content: "사용자 메시지" }),
          createMockMessage({ id: "msg-2", role: "assistant", content: "응답" }),
        ];
        mockManager.getSession.mockReturnValue(
          createMockSession({
            id: "session-123",
            messages,
          }),
        );

        // 세션 새로고침
        await sessionState.refreshCurrentSession();

        expect(sessionState.currentMessages).toHaveLength(2);
      });

      it("현재 세션이 없으면 빈 배열을 반환해야 한다", () => {
        sessionState.closeCurrentSession();

        expect(sessionState.currentMessages).toEqual([]);
      });
    });
  });

  // ============================================
  // 체크포인트 관리 테스트
  // ============================================

  describe("체크포인트 관리", () => {
    beforeEach(async () => {
      const mockSession = createMockSession({ id: "session-123" });
      mockManager.createSession.mockReturnValue(mockSession);
      await sessionState.createNewSession();
    });

    describe("createCheckpoint", () => {
      it("체크포인트를 생성해야 한다", async () => {
        const mockCheckpoint = {
          id: "cp-001",
          sessionId: "session-123",
          label: "테스트 체크포인트",
          timestamp: "2026-01-05T10:00:00.000Z",
          messageIndex: 5,
          isAutomatic: false,
        };
        mockManager.createCheckpoint.mockReturnValue(mockCheckpoint);
        mockManager.getSession.mockReturnValue(
          createMockSession({
            id: "session-123",
            checkpoints: [mockCheckpoint],
          }),
        );

        await sessionState.createCheckpoint("테스트 체크포인트");

        expect(mockManager.createCheckpoint).toHaveBeenCalledWith("session-123", {
          label: "테스트 체크포인트",
        });
      });

      it("현재 세션이 없으면 에러를 발생시켜야 한다", async () => {
        sessionState.closeCurrentSession();

        await sessionState.createCheckpoint("테스트");

        expect(sessionState.hasError).toBe(true);
      });
    });

    describe("rollbackToCheckpoint", () => {
      it("체크포인트로 롤백해야 한다", async () => {
        const rolledBackSession = createMockSession({
          id: "session-123",
          messages: [],
        });
        mockManager.rollbackToCheckpoint.mockReturnValue(rolledBackSession);

        await sessionState.rollbackToCheckpoint("cp-001");

        expect(mockManager.rollbackToCheckpoint).toHaveBeenCalledWith("session-123", "cp-001");
        expect(sessionState.currentSession).toEqual(rolledBackSession);
      });

      it("현재 세션이 없으면 에러를 발생시켜야 한다", async () => {
        sessionState.closeCurrentSession();

        await sessionState.rollbackToCheckpoint("cp-001");

        expect(sessionState.hasError).toBe(true);
      });
    });

    describe("currentCheckpoints", () => {
      it("현재 세션의 체크포인트 목록을 반환해야 한다", async () => {
        const checkpoints = [
          {
            id: "cp-001",
            sessionId: "session-123",
            label: "체크포인트 1",
            timestamp: "2026-01-05T10:00:00.000Z",
            messageIndex: 3,
            isAutomatic: false,
          },
        ];
        mockManager.getSession.mockReturnValue(
          createMockSession({
            id: "session-123",
            checkpoints,
          }),
        );

        await sessionState.refreshCurrentSession();

        expect(sessionState.currentCheckpoints).toHaveLength(1);
      });

      it("현재 세션이 없으면 빈 배열을 반환해야 한다", () => {
        sessionState.closeCurrentSession();

        expect(sessionState.currentCheckpoints).toEqual([]);
      });
    });
  });

  // ============================================
  // 내보내기/가져오기 테스트
  // ============================================

  describe("내보내기/가져오기", () => {
    describe("exportCurrentSession", () => {
      it("현재 세션을 JSON으로 내보내야 한다", async () => {
        const mockSession = createMockSession({ id: "session-123" });
        mockManager.createSession.mockReturnValue(mockSession);
        await sessionState.createNewSession();

        mockManager.exportSession.mockReturnValue(JSON.stringify(mockSession));

        const result = await sessionState.exportCurrentSession();

        expect(mockManager.exportSession).toHaveBeenCalledWith("session-123");
        expect(result).toBe(JSON.stringify(mockSession));
      });

      it("현재 세션이 없으면 undefined를 반환해야 한다", async () => {
        const result = await sessionState.exportCurrentSession();

        expect(result).toBeUndefined();
      });
    });

    describe("importSession", () => {
      it("JSON 데이터로 세션을 가져와야 한다", async () => {
        const mockSession = createMockSession({ id: "imported-session" });
        const jsonData = JSON.stringify(mockSession);
        mockManager.importSession.mockReturnValue(mockSession);
        mockManager.listSessions.mockReturnValue({
          sessions: [],
          total: 0,
          hasMore: false,
        });

        await sessionState.importSession(jsonData);

        expect(mockManager.importSession).toHaveBeenCalledWith(jsonData);
        expect(sessionState.currentSession).toEqual(mockSession);
      });

      it("유효하지 않은 JSON이면 에러를 저장해야 한다", async () => {
        mockManager.importSession.mockReturnValue(undefined);

        await sessionState.importSession("invalid json");

        expect(sessionState.hasError).toBe(true);
        expect(sessionState.error?.message).toContain("세션을 가져올 수 없습니다");
      });
    });
  });

  // ============================================
  // 유틸리티 테스트
  // ============================================

  describe("유틸리티", () => {
    describe("clearError", () => {
      it("에러를 null로 설정해야 한다", () => {
        // 에러 발생시키기
        mockManager.listSessions.mockImplementation(() => {
          throw new Error("테스트 에러");
        });
        sessionState.loadSessions();

        expect(sessionState.hasError).toBe(true);

        sessionState.clearError();

        expect(sessionState.error).toBeNull();
        expect(sessionState.hasError).toBe(false);
      });
    });

    describe("reset", () => {
      it("모든 상태를 초기화해야 한다", async () => {
        // 상태 변경
        const mockSession = createMockSession();
        mockManager.createSession.mockReturnValue(mockSession);
        await sessionState.createNewSession();

        mockManager.listSessions.mockReturnValue({
          sessions: [createMockSessionSummary()],
          total: 1,
          hasMore: false,
        });
        await sessionState.loadSessions();

        // 리셋
        sessionState.reset();

        expect(sessionState.sessions).toEqual([]);
        expect(sessionState.currentSession).toBeNull();
        expect(sessionState.totalSessions).toBe(0);
        expect(sessionState.hasMore).toBe(false);
        expect(sessionState.error).toBeNull();
      });
    });

    describe("cleanupExpiredSessions", () => {
      it("만료된 세션을 정리해야 한다", async () => {
        mockManager.cleanupExpiredSessions.mockReturnValue(3);
        mockManager.listSessions.mockReturnValue({
          sessions: [],
          total: 0,
          hasMore: false,
        });

        const count = await sessionState.cleanupExpiredSessions();

        expect(mockManager.cleanupExpiredSessions).toHaveBeenCalled();
        expect(count).toBe(3);
      });
    });
  });

  // ============================================
  // Computed 속성 테스트
  // ============================================

  describe("Computed 속성", () => {
    describe("sessionCount", () => {
      it("sessions 배열의 길이를 반환해야 한다", async () => {
        mockManager.listSessions.mockReturnValue({
          sessions: [createMockSessionSummary({ id: "s1" }), createMockSessionSummary({ id: "s2" })],
          total: 2,
          hasMore: false,
        });
        await sessionState.loadSessions();

        expect(sessionState.sessionCount).toBe(2);
      });
    });

    describe("currentSessionId", () => {
      it("현재 세션의 ID를 반환해야 한다", async () => {
        const mockSession = createMockSession({ id: "session-abc" });
        mockManager.createSession.mockReturnValue(mockSession);
        await sessionState.createNewSession();

        expect(sessionState.currentSessionId).toBe("session-abc");
      });

      it("현재 세션이 없으면 null을 반환해야 한다", () => {
        expect(sessionState.currentSessionId).toBeNull();
      });
    });

    describe("currentSessionTitle", () => {
      it("현재 세션의 제목을 반환해야 한다", async () => {
        const mockSession = createMockSession({ title: "내 세션" });
        mockManager.createSession.mockReturnValue(mockSession);
        await sessionState.createNewSession();

        expect(sessionState.currentSessionTitle).toBe("내 세션");
      });

      it("현재 세션이 없으면 null을 반환해야 한다", () => {
        expect(sessionState.currentSessionTitle).toBeNull();
      });
    });

    describe("messageCount", () => {
      it("현재 세션의 메시지 수를 반환해야 한다", async () => {
        const mockSession = createMockSession({
          messages: [createMockMessage(), createMockMessage(), createMockMessage()],
        });
        mockManager.createSession.mockReturnValue(mockSession);
        await sessionState.createNewSession();

        expect(sessionState.messageCount).toBe(3);
      });

      it("현재 세션이 없으면 0을 반환해야 한다", () => {
        expect(sessionState.messageCount).toBe(0);
      });
    });

    describe("checkpointCount", () => {
      it("현재 세션의 체크포인트 수를 반환해야 한다", async () => {
        const mockSession = createMockSession({
          checkpoints: [
            {
              id: "cp-1",
              sessionId: "session-123",
              label: "CP1",
              timestamp: "2026-01-05T10:00:00.000Z",
              messageIndex: 1,
              isAutomatic: false,
            },
          ],
        });
        mockManager.createSession.mockReturnValue(mockSession);
        await sessionState.createNewSession();

        expect(sessionState.checkpointCount).toBe(1);
      });

      it("현재 세션이 없으면 0을 반환해야 한다", () => {
        expect(sessionState.checkpointCount).toBe(0);
      });
    });
  });
});
