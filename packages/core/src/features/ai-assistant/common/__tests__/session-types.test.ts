/**
 * 🎯 목적: AI Assistant 세션 타입 테스트
 * 01: SessionManager 구현
 *
 * 📝 주의사항:
 * - TDD RED 단계: 타입 정의 및 유틸리티 함수 테스트
 * - 타입 가드, 팩토리 함수, 검증 로직 테스트
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (01)
 *
 * @packageDocumentation
 */

import {
  createEmptySession,
  createSessionCheckpoint,
  createSessionMessage,
  createSessionSummary,
  generateCheckpointId,
  generateMessageId,
  generateSessionId,
  isMessageRole,
  isSession,
  isSessionCheckpoint,
  isSessionEventType,
  isSessionMessage,
  isSessionStatus,
  isSessionSummary,
} from "../session-manager";
import {
  type AddMessageInput,
  type CreateCheckpointInput,
  type CreateSessionInput,
  SESSION_MANAGER_DEFAULTS,
  type Session,
  type SessionCheckpoint,
  type SessionEvent,
  type SessionListOptions,
  type SessionListResult,
  type SessionManagerConfig,
  type SessionMessage,
  type SessionStatus,
  type SessionSummary,
  type SessionToolCall,
  type UpdateSessionInput,
} from "../session-types";

// 상수는 session-manager에서 내부 사용이므로 직접 정의
const VALID_SESSION_STATUSES = ["active", "paused", "completed", "cancelled", "expired"] as const;
const VALID_MESSAGE_ROLES = ["user", "assistant", "system", "tool"] as const;
const VALID_SESSION_EVENT_TYPES = [
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

// ============================================
// 🎯 상수 테스트
// ============================================

describe("Session Constants", () => {
  describe("VALID_SESSION_STATUSES", () => {
    it("모든 유효한 세션 상태를 포함해야 한다", () => {
      expect(VALID_SESSION_STATUSES).toContain("active");
      expect(VALID_SESSION_STATUSES).toContain("paused");
      expect(VALID_SESSION_STATUSES).toContain("completed");
      expect(VALID_SESSION_STATUSES).toContain("cancelled");
      expect(VALID_SESSION_STATUSES).toContain("expired");
      expect(VALID_SESSION_STATUSES).toHaveLength(5);
    });
  });

  describe("VALID_MESSAGE_ROLES", () => {
    it("모든 유효한 메시지 역할을 포함해야 한다", () => {
      expect(VALID_MESSAGE_ROLES).toContain("user");
      expect(VALID_MESSAGE_ROLES).toContain("assistant");
      expect(VALID_MESSAGE_ROLES).toContain("system");
      expect(VALID_MESSAGE_ROLES).toContain("tool");
      expect(VALID_MESSAGE_ROLES).toHaveLength(4);
    });
  });

  describe("VALID_SESSION_EVENT_TYPES", () => {
    it("모든 유효한 이벤트 타입을 포함해야 한다", () => {
      expect(VALID_SESSION_EVENT_TYPES).toContain("session_created");
      expect(VALID_SESSION_EVENT_TYPES).toContain("session_resumed");
      expect(VALID_SESSION_EVENT_TYPES).toContain("session_paused");
      expect(VALID_SESSION_EVENT_TYPES).toContain("session_completed");
      expect(VALID_SESSION_EVENT_TYPES).toContain("session_cancelled");
      expect(VALID_SESSION_EVENT_TYPES).toContain("session_expired");
      expect(VALID_SESSION_EVENT_TYPES).toContain("message_added");
      expect(VALID_SESSION_EVENT_TYPES).toContain("checkpoint_created");
      expect(VALID_SESSION_EVENT_TYPES).toContain("checkpoint_restored");
      expect(VALID_SESSION_EVENT_TYPES).toHaveLength(9);
    });
  });

  describe("SESSION_MANAGER_DEFAULTS", () => {
    it("기본 설정값이 정의되어 있어야 한다", () => {
      expect(SESSION_MANAGER_DEFAULTS.maxSessions).toBe(100);
      expect(SESSION_MANAGER_DEFAULTS.sessionExpiryMs).toBe(7 * 24 * 60 * 60 * 1000);
      expect(SESSION_MANAGER_DEFAULTS.autoCheckpoint).toBe(true);
      expect(SESSION_MANAGER_DEFAULTS.autoCheckpointInterval).toBe(5);
    });
  });
});

// ============================================
// 🎯 타입 가드 테스트
// ============================================

describe("Type Guards", () => {
  describe("isSessionStatus", () => {
    it("유효한 세션 상태를 인식해야 한다", () => {
      expect(isSessionStatus("active")).toBe(true);
      expect(isSessionStatus("paused")).toBe(true);
      expect(isSessionStatus("completed")).toBe(true);
      expect(isSessionStatus("cancelled")).toBe(true);
      expect(isSessionStatus("expired")).toBe(true);
    });

    it("유효하지 않은 값을 거부해야 한다", () => {
      expect(isSessionStatus("invalid")).toBe(false);
      expect(isSessionStatus("")).toBe(false);
      expect(isSessionStatus("ACTIVE")).toBe(false);
      expect(isSessionStatus(123 as unknown as string)).toBe(false);
      expect(isSessionStatus(null as unknown as string)).toBe(false);
    });
  });

  describe("isMessageRole", () => {
    it("유효한 메시지 역할을 인식해야 한다", () => {
      expect(isMessageRole("user")).toBe(true);
      expect(isMessageRole("assistant")).toBe(true);
      expect(isMessageRole("system")).toBe(true);
      expect(isMessageRole("tool")).toBe(true);
    });

    it("유효하지 않은 값을 거부해야 한다", () => {
      expect(isMessageRole("admin")).toBe(false);
      expect(isMessageRole("")).toBe(false);
      expect(isMessageRole("USER")).toBe(false);
    });
  });

  describe("isSessionEventType", () => {
    it("유효한 이벤트 타입을 인식해야 한다", () => {
      expect(isSessionEventType("session_created")).toBe(true);
      expect(isSessionEventType("message_added")).toBe(true);
      expect(isSessionEventType("checkpoint_created")).toBe(true);
    });

    it("유효하지 않은 값을 거부해야 한다", () => {
      expect(isSessionEventType("unknown_event")).toBe(false);
      expect(isSessionEventType("")).toBe(false);
    });
  });

  describe("isSessionMessage", () => {
    it("유효한 SessionMessage 객체를 인식해야 한다", () => {
      const validMessage: SessionMessage = {
        id: "msg-001",
        role: "user",
        content: "Hello",
        timestamp: "2026-01-05T10:00:00.000Z",
      };
      expect(isSessionMessage(validMessage)).toBe(true);
    });

    it("toolCall이 있는 메시지도 유효해야 한다", () => {
      const messageWithTool: SessionMessage = {
        id: "msg-002",
        role: "tool",
        content: "kubectl get pods",
        timestamp: "2026-01-05T10:00:00.000Z",
        toolCall: {
          name: "kubectl",
          args: { command: "get pods" },
          status: "success",
        },
      };
      expect(isSessionMessage(messageWithTool)).toBe(true);
    });

    it("필수 필드가 없으면 거부해야 한다", () => {
      expect(isSessionMessage({})).toBe(false);
      expect(isSessionMessage({ id: "msg-001" })).toBe(false);
      expect(isSessionMessage({ id: "msg-001", role: "user" })).toBe(false);
      expect(isSessionMessage(null)).toBe(false);
      expect(isSessionMessage(undefined)).toBe(false);
      expect(isSessionMessage("string")).toBe(false);
    });

    it("잘못된 필드 타입을 거부해야 한다", () => {
      expect(
        isSessionMessage({
          id: 123,
          role: "user",
          content: "Hello",
          timestamp: "2026-01-05T10:00:00.000Z",
        }),
      ).toBe(false);
    });
  });

  describe("isSessionCheckpoint", () => {
    it("유효한 SessionCheckpoint 객체를 인식해야 한다", () => {
      const validCheckpoint: SessionCheckpoint = {
        id: "cp-001",
        sessionId: "session-001",
        label: "계획 승인됨",
        timestamp: "2026-01-05T10:05:00.000Z",
        messageIndex: 4,
        isAutomatic: true,
      };
      expect(isSessionCheckpoint(validCheckpoint)).toBe(true);
    });

    it("선택적 필드가 있어도 유효해야 한다", () => {
      const checkpointWithOptional: SessionCheckpoint = {
        id: "cp-002",
        sessionId: "session-001",
        label: "수동 저장",
        description: "사용자가 수동으로 저장",
        timestamp: "2026-01-05T10:10:00.000Z",
        messageIndex: 8,
        isAutomatic: false,
        metadata: { reason: "user_request" },
      };
      expect(isSessionCheckpoint(checkpointWithOptional)).toBe(true);
    });

    it("필수 필드가 없으면 거부해야 한다", () => {
      expect(isSessionCheckpoint({})).toBe(false);
      expect(isSessionCheckpoint({ id: "cp-001" })).toBe(false);
      expect(isSessionCheckpoint(null)).toBe(false);
    });
  });

  describe("isSession", () => {
    it("유효한 Session 객체를 인식해야 한다", () => {
      const validSession: Session = {
        id: "session-001",
        threadId: "thread-abc",
        title: "Pod 상태 분석",
        status: "active",
        messages: [],
        checkpoints: [],
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:00:00.000Z",
      };
      expect(isSession(validSession)).toBe(true);
    });

    it("메시지와 체크포인트가 있는 세션도 유효해야 한다", () => {
      const sessionWithData: Session = {
        id: "session-001",
        threadId: "thread-abc",
        title: "Pod 상태 분석",
        status: "active",
        messages: [
          {
            id: "msg-001",
            role: "user",
            content: "Hello",
            timestamp: "2026-01-05T10:00:00.000Z",
          },
        ],
        checkpoints: [
          {
            id: "cp-001",
            sessionId: "session-001",
            label: "시작",
            timestamp: "2026-01-05T10:00:00.000Z",
            messageIndex: 0,
            isAutomatic: true,
          },
        ],
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:00:00.000Z",
        clusterId: "cluster-1",
        namespace: "default",
      };
      expect(isSession(sessionWithData)).toBe(true);
    });

    it("필수 필드가 없으면 거부해야 한다", () => {
      expect(isSession({})).toBe(false);
      expect(isSession({ id: "session-001" })).toBe(false);
      expect(isSession(null)).toBe(false);
      expect(isSession(undefined)).toBe(false);
    });

    it("잘못된 상태 값을 거부해야 한다", () => {
      const invalidSession = {
        id: "session-001",
        threadId: "thread-abc",
        title: "Test",
        status: "invalid_status",
        messages: [],
        checkpoints: [],
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:00:00.000Z",
      };
      expect(isSession(invalidSession)).toBe(false);
    });
  });

  describe("isSessionSummary", () => {
    it("유효한 SessionSummary 객체를 인식해야 한다", () => {
      const validSummary: SessionSummary = {
        id: "session-001",
        title: "Pod 상태 분석",
        status: "active",
        messageCount: 5,
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:15:00.000Z",
      };
      expect(isSessionSummary(validSummary)).toBe(true);
    });

    it("선택적 필드가 있어도 유효해야 한다", () => {
      const summaryWithOptional: SessionSummary = {
        id: "session-001",
        title: "Pod 상태 분석",
        status: "completed",
        messageCount: 10,
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:30:00.000Z",
        clusterId: "cluster-1",
        preview: "Pod 상태를 확인해줘...",
      };
      expect(isSessionSummary(summaryWithOptional)).toBe(true);
    });

    it("필수 필드가 없으면 거부해야 한다", () => {
      expect(isSessionSummary({})).toBe(false);
      expect(isSessionSummary(null)).toBe(false);
    });
  });
});

// ============================================
// 🎯 ID 생성 함수 테스트
// ============================================

describe("ID Generators", () => {
  describe("generateSessionId", () => {
    it("session- 접두사가 있어야 한다", () => {
      const id = generateSessionId();
      expect(id).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    it("매번 고유한 ID를 생성해야 한다", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSessionId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("generateMessageId", () => {
    it("msg- 접두사가 있어야 한다", () => {
      const id = generateMessageId();
      expect(id).toMatch(/^msg-\d+-[a-z0-9]+$/);
    });

    it("매번 고유한 ID를 생성해야 한다", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateMessageId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("generateCheckpointId", () => {
    it("cp- 접두사가 있어야 한다", () => {
      const id = generateCheckpointId();
      expect(id).toMatch(/^cp-\d+-[a-z0-9]+$/);
    });

    it("매번 고유한 ID를 생성해야 한다", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateCheckpointId());
      }
      expect(ids.size).toBe(100);
    });
  });
});

// ============================================
// 🎯 팩토리 함수 테스트
// ============================================

describe("Factory Functions", () => {
  describe("createEmptySession", () => {
    it("기본값으로 빈 세션을 생성해야 한다", () => {
      const session = createEmptySession();

      expect(session.id).toMatch(/^session-/);
      expect(session.threadId).toMatch(/^thread-/);
      expect(session.title).toBe("새 대화");
      expect(session.status).toBe("active");
      expect(session.messages).toEqual([]);
      expect(session.checkpoints).toEqual([]);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    it("입력값으로 세션을 생성해야 한다", () => {
      const input: CreateSessionInput = {
        title: "Pod 분석",
        clusterId: "cluster-1",
        namespace: "default",
        modelName: "gpt-5.2",
        metadata: { source: "test" },
      };

      const session = createEmptySession(input);

      expect(session.title).toBe("Pod 분석");
      expect(session.clusterId).toBe("cluster-1");
      expect(session.namespace).toBe("default");
      expect(session.modelName).toBe("gpt-5.2");
      expect(session.metadata).toEqual({ source: "test" });
    });

    it("threadId가 제공되면 사용해야 한다", () => {
      const input: CreateSessionInput & { threadId?: string } = {
        title: "Test",
      };
      // threadId는 CreateSessionInput에 없지만 내부적으로 생성됨
      const session = createEmptySession(input);
      expect(session.threadId).toMatch(/^thread-/);
    });
  });

  describe("createSessionMessage", () => {
    it("기본 메시지를 생성해야 한다", () => {
      const input: AddMessageInput = {
        role: "user",
        content: "Hello, world!",
      };

      const message = createSessionMessage(input);

      expect(message.id).toMatch(/^msg-/);
      expect(message.role).toBe("user");
      expect(message.content).toBe("Hello, world!");
      expect(message.timestamp).toBeDefined();
    });

    it("도구 호출 정보가 있는 메시지를 생성해야 한다", () => {
      const input: AddMessageInput = {
        role: "tool",
        content: "kubectl get pods",
        toolCall: {
          name: "kubectl",
          args: { command: "get pods" },
        },
      };

      const message = createSessionMessage(input);

      expect(message.toolCall).toBeDefined();
      expect(message.toolCall?.name).toBe("kubectl");
      expect(message.toolCall?.args).toEqual({ command: "get pods" });
      expect(message.toolCall?.status).toBe("pending");
    });

    it("메타데이터를 포함해야 한다", () => {
      const input: AddMessageInput = {
        role: "assistant",
        content: "Response",
        metadata: { tokens: 100 },
      };

      const message = createSessionMessage(input);

      expect(message.metadata).toEqual({ tokens: 100 });
    });
  });

  describe("createSessionCheckpoint", () => {
    it("기본 체크포인트를 생성해야 한다", () => {
      const input: CreateCheckpointInput = {
        label: "계획 승인됨",
      };

      const checkpoint = createSessionCheckpoint("session-001", 5, input);

      expect(checkpoint.id).toMatch(/^cp-/);
      expect(checkpoint.sessionId).toBe("session-001");
      expect(checkpoint.label).toBe("계획 승인됨");
      expect(checkpoint.messageIndex).toBe(5);
      expect(checkpoint.isAutomatic).toBe(false);
      expect(checkpoint.timestamp).toBeDefined();
    });

    it("자동 체크포인트를 생성해야 한다", () => {
      const input: CreateCheckpointInput = {
        label: "자동 저장",
        isAutomatic: true,
      };

      const checkpoint = createSessionCheckpoint("session-001", 10, input);

      expect(checkpoint.isAutomatic).toBe(true);
    });

    it("설명과 메타데이터를 포함해야 한다", () => {
      const input: CreateCheckpointInput = {
        label: "상세 체크포인트",
        description: "사용자 요청에 의한 저장",
        metadata: { reason: "user_request" },
      };

      const checkpoint = createSessionCheckpoint("session-001", 7, input);

      expect(checkpoint.description).toBe("사용자 요청에 의한 저장");
      expect(checkpoint.metadata).toEqual({ reason: "user_request" });
    });
  });

  describe("createSessionSummary", () => {
    it("세션에서 요약을 생성해야 한다", () => {
      const session: Session = {
        id: "session-001",
        threadId: "thread-abc",
        title: "Pod 상태 분석",
        status: "active",
        messages: [
          {
            id: "msg-001",
            role: "user",
            content: "Pod 상태를 확인해줘",
            timestamp: "2026-01-05T10:00:00.000Z",
          },
          {
            id: "msg-002",
            role: "assistant",
            content: "네, Pod 상태를 확인하겠습니다.",
            timestamp: "2026-01-05T10:00:05.000Z",
          },
        ],
        checkpoints: [],
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:00:05.000Z",
        clusterId: "cluster-1",
      };

      const summary = createSessionSummary(session);

      expect(summary.id).toBe("session-001");
      expect(summary.title).toBe("Pod 상태 분석");
      expect(summary.status).toBe("active");
      expect(summary.messageCount).toBe(2);
      expect(summary.createdAt).toBe("2026-01-05T10:00:00.000Z");
      expect(summary.updatedAt).toBe("2026-01-05T10:00:05.000Z");
      expect(summary.clusterId).toBe("cluster-1");
    });

    it("마지막 메시지 미리보기를 생성해야 한다", () => {
      const session: Session = {
        id: "session-001",
        threadId: "thread-abc",
        title: "Test",
        status: "active",
        messages: [
          {
            id: "msg-001",
            role: "user",
            content: "이것은 매우 긴 메시지입니다. 미리보기에서는 앞부분만 표시되어야 합니다.",
            timestamp: "2026-01-05T10:00:00.000Z",
          },
        ],
        checkpoints: [],
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:00:00.000Z",
      };

      const summary = createSessionSummary(session);

      expect(summary.preview).toBeDefined();
      expect(summary.preview!.length).toBeLessThanOrEqual(53); // 50 + "..."
    });

    it("빈 메시지 배열일 때 미리보기가 없어야 한다", () => {
      const session: Session = {
        id: "session-001",
        threadId: "thread-abc",
        title: "Empty",
        status: "active",
        messages: [],
        checkpoints: [],
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:00:00.000Z",
      };

      const summary = createSessionSummary(session);

      expect(summary.preview).toBeUndefined();
    });
  });
});
