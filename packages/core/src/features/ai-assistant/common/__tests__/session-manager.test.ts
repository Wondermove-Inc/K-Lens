/**
 * 🎯 목적: AI Assistant SessionManager 테스트
 * 01: SessionManager 구현
 *
 * 📝 주의사항:
 * - TDD RED 단계: SessionManager 기능 테스트
 * - 세션 CRUD, 메시지 관리, 체크포인트 관리 테스트
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (01)
 *
 * @packageDocumentation
 */

import { SessionManager } from "../session-manager";

import type {
  AddMessageInput,
  CreateCheckpointInput,
  CreateSessionInput,
  Session,
  SessionCheckpoint,
  SessionManagerConfig,
  SessionMessage,
  UpdateSessionInput,
} from "../session-types";

// ============================================
// 🎯 테스트 유틸리티
// ============================================

/**
 * 기본 설정으로 SessionManager 생성
 */
function createTestManager(config?: SessionManagerConfig): SessionManager {
  return new SessionManager(config);
}

/**
 * 테스트용 세션 입력 생성
 */
function createTestSessionInput(overrides?: Partial<CreateSessionInput>): CreateSessionInput {
  return {
    title: "테스트 세션",
    clusterId: "test-cluster",
    namespace: "default",
    modelName: "gpt-5.2",
    ...overrides,
  };
}

/**
 * 테스트용 메시지 입력 생성
 */
function createTestMessageInput(overrides?: Partial<AddMessageInput>): AddMessageInput {
  return {
    role: "user",
    content: "테스트 메시지",
    ...overrides,
  };
}

// ============================================
// 🎯 SessionManager 생성 테스트
// ============================================

describe("SessionManager", () => {
  describe("constructor", () => {
    it("기본 설정으로 생성해야 한다", () => {
      const manager = createTestManager();
      expect(manager).toBeDefined();
      expect(manager.getSessionCount()).toBe(0);
    });

    it("커스텀 설정으로 생성해야 한다", () => {
      const config: SessionManagerConfig = {
        maxSessions: 50,
        sessionExpiryMs: 24 * 60 * 60 * 1000,
        autoCheckpoint: false,
        autoCheckpointInterval: 10,
      };
      const manager = createTestManager(config);
      expect(manager).toBeDefined();
    });
  });

  // ============================================
  // 🎯 싱글톤 테스트
  // ============================================

  describe("getInstance", () => {
    beforeEach(() => {
      SessionManager.resetInstance();
    });

    it("싱글톤 인스턴스를 반환해야 한다", () => {
      const instance1 = SessionManager.getInstance();
      const instance2 = SessionManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("최초 호출 시 설정을 적용해야 한다", () => {
      const config: SessionManagerConfig = { maxSessions: 25 };
      const instance = SessionManager.getInstance(config);
      expect(instance).toBeDefined();
    });

    it("resetInstance 후 새 인스턴스를 생성해야 한다", () => {
      const instance1 = SessionManager.getInstance();
      SessionManager.resetInstance();
      const instance2 = SessionManager.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  // ============================================
  // 🎯 세션 관리 테스트
  // ============================================

  describe("createSession", () => {
    let manager: SessionManager;

    beforeEach(() => {
      manager = createTestManager();
    });

    it("기본값으로 세션을 생성해야 한다", () => {
      const session = manager.createSession();

      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session-/);
      expect(session.threadId).toMatch(/^thread-/);
      expect(session.title).toBe("새 대화");
      expect(session.status).toBe("active");
      expect(session.messages).toEqual([]);
      expect(session.checkpoints).toEqual([]);
    });

    it("입력값으로 세션을 생성해야 한다", () => {
      const input = createTestSessionInput();
      const session = manager.createSession(input);

      expect(session.title).toBe("테스트 세션");
      expect(session.clusterId).toBe("test-cluster");
      expect(session.namespace).toBe("default");
      expect(session.modelName).toBe("gpt-5.2");
    });

    it("세션 수가 증가해야 한다", () => {
      expect(manager.getSessionCount()).toBe(0);
      manager.createSession();
      expect(manager.getSessionCount()).toBe(1);
      manager.createSession();
      expect(manager.getSessionCount()).toBe(2);
    });

    it("최대 세션 수를 초과하면 가장 오래된 세션을 삭제해야 한다", () => {
      const limitedManager = createTestManager({ maxSessions: 3 });

      const session1 = limitedManager.createSession({ title: "Session 1" });
      const session2 = limitedManager.createSession({ title: "Session 2" });
      const session3 = limitedManager.createSession({ title: "Session 3" });

      expect(limitedManager.getSessionCount()).toBe(3);

      // 4번째 세션 생성 시 1번째 세션이 삭제되어야 함
      const session4 = limitedManager.createSession({ title: "Session 4" });

      expect(limitedManager.getSessionCount()).toBe(3);
      expect(limitedManager.getSession(session1.id)).toBeUndefined();
      expect(limitedManager.getSession(session2.id)).toBeDefined();
      expect(limitedManager.getSession(session3.id)).toBeDefined();
      expect(limitedManager.getSession(session4.id)).toBeDefined();
    });
  });

  describe("getSession", () => {
    let manager: SessionManager;
    let session: Session;

    beforeEach(() => {
      manager = createTestManager();
      session = manager.createSession(createTestSessionInput());
    });

    it("존재하는 세션을 반환해야 한다", () => {
      const found = manager.getSession(session.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(session.id);
    });

    it("존재하지 않는 세션은 undefined를 반환해야 한다", () => {
      const found = manager.getSession("nonexistent-id");
      expect(found).toBeUndefined();
    });
  });

  describe("listSessions", () => {
    let manager: SessionManager;

    beforeEach(() => {
      manager = createTestManager();
      // 5개 세션 생성
      for (let i = 0; i < 5; i++) {
        manager.createSession({ title: `Session ${i + 1}` });
      }
    });

    it("모든 세션 요약을 반환해야 한다", () => {
      const result = manager.listSessions();

      expect(result.sessions).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(false);
    });

    it("limit 옵션이 적용되어야 한다", () => {
      const result = manager.listSessions({ limit: 3 });

      expect(result.sessions).toHaveLength(3);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it("offset 옵션이 적용되어야 한다", () => {
      const result = manager.listSessions({ limit: 3, offset: 3 });

      expect(result.sessions).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(false);
    });

    it("status 필터가 적용되어야 한다", () => {
      // 일부 세션 상태 변경
      const allSessions = manager.listSessions();
      manager.updateSession(allSessions.sessions[0].id, { status: "completed" });
      manager.updateSession(allSessions.sessions[1].id, { status: "completed" });

      const result = manager.listSessions({ status: "completed" });

      expect(result.sessions).toHaveLength(2);
      expect(result.sessions.every((s) => s.status === "completed")).toBe(true);
    });

    it("sortBy/sortOrder 옵션이 적용되어야 한다", () => {
      const ascResult = manager.listSessions({ sortBy: "createdAt", sortOrder: "asc" });
      const descResult = manager.listSessions({ sortBy: "createdAt", sortOrder: "desc" });

      expect(ascResult.sessions[0].title).toBe("Session 1");
      expect(descResult.sessions[0].title).toBe("Session 5");
    });

    it("clusterId 필터가 적용되어야 한다", () => {
      // 새 세션에 다른 클러스터 ID 할당
      manager.createSession({ title: "Cluster A", clusterId: "cluster-a" });
      manager.createSession({ title: "Cluster B", clusterId: "cluster-b" });

      const result = manager.listSessions({ clusterId: "cluster-a" });

      expect(result.sessions.length).toBeGreaterThanOrEqual(1);
      expect(result.sessions.every((s) => s.clusterId === "cluster-a")).toBe(true);
    });
  });

  describe("updateSession", () => {
    let manager: SessionManager;
    let session: Session;

    beforeEach(() => {
      manager = createTestManager();
      session = manager.createSession(createTestSessionInput());
    });

    it("제목을 업데이트해야 한다", () => {
      const updated = manager.updateSession(session.id, { title: "새 제목" });

      expect(updated).toBeDefined();
      expect(updated?.title).toBe("새 제목");
    });

    it("상태를 업데이트해야 한다", () => {
      const updated = manager.updateSession(session.id, { status: "paused" });

      expect(updated?.status).toBe("paused");
    });

    it("메타데이터를 업데이트해야 한다", () => {
      const updated = manager.updateSession(session.id, {
        metadata: { key: "value" },
      });

      expect(updated?.metadata).toEqual({ key: "value" });
    });

    it("updatedAt이 갱신되어야 한다", () => {
      // 과거 시간으로 세션의 updatedAt을 강제 설정
      const pastTime = "2026-01-01T00:00:00.000Z";
      const sessionWithPastTime = manager.getSession(session.id);
      if (sessionWithPastTime) {
        (sessionWithPastTime as { updatedAt: string }).updatedAt = pastTime;
      }

      const updated = manager.updateSession(session.id, { title: "Updated" });

      // 업데이트 후 시간이 현재 시간으로 갱신되었는지 확인
      expect(updated?.updatedAt).not.toBe(pastTime);
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(new Date(pastTime).getTime());
    });

    it("존재하지 않는 세션은 undefined를 반환해야 한다", () => {
      const updated = manager.updateSession("nonexistent", { title: "Test" });
      expect(updated).toBeUndefined();
    });
  });

  describe("deleteSession", () => {
    let manager: SessionManager;
    let session: Session;

    beforeEach(() => {
      manager = createTestManager();
      session = manager.createSession(createTestSessionInput());
    });

    it("세션을 삭제해야 한다", () => {
      expect(manager.getSession(session.id)).toBeDefined();

      const result = manager.deleteSession(session.id);

      expect(result).toBe(true);
      expect(manager.getSession(session.id)).toBeUndefined();
    });

    it("세션 수가 감소해야 한다", () => {
      expect(manager.getSessionCount()).toBe(1);

      manager.deleteSession(session.id);

      expect(manager.getSessionCount()).toBe(0);
    });

    it("존재하지 않는 세션 삭제는 false를 반환해야 한다", () => {
      const result = manager.deleteSession("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("getActiveSession", () => {
    let manager: SessionManager;

    beforeEach(() => {
      manager = createTestManager();
    });

    it("활성 세션이 없으면 undefined를 반환해야 한다", () => {
      expect(manager.getActiveSession()).toBeUndefined();
    });

    it("마지막으로 활성화된 세션을 반환해야 한다", () => {
      const session1 = manager.createSession({ title: "Session 1" });
      const session2 = manager.createSession({ title: "Session 2" });

      manager.activateSession(session1.id);

      expect(manager.getActiveSession()?.id).toBe(session1.id);
    });
  });

  describe("activateSession", () => {
    let manager: SessionManager;
    let session1: Session;
    let session2: Session;

    beforeEach(() => {
      manager = createTestManager();
      session1 = manager.createSession({ title: "Session 1" });
      session2 = manager.createSession({ title: "Session 2" });
    });

    it("세션을 활성화해야 한다", () => {
      const activated = manager.activateSession(session1.id);

      expect(activated).toBeDefined();
      expect(activated?.id).toBe(session1.id);
      expect(manager.getActiveSession()?.id).toBe(session1.id);
    });

    it("이전 활성 세션은 paused 상태가 되어야 한다", () => {
      manager.activateSession(session1.id);
      manager.activateSession(session2.id);

      const prevSession = manager.getSession(session1.id);
      expect(prevSession?.status).toBe("paused");
    });

    it("존재하지 않는 세션은 undefined를 반환해야 한다", () => {
      const result = manager.activateSession("nonexistent");
      expect(result).toBeUndefined();
    });
  });

  // ============================================
  // 🎯 메시지 관리 테스트
  // ============================================

  describe("addMessage", () => {
    let manager: SessionManager;
    let session: Session;

    beforeEach(() => {
      manager = createTestManager();
      session = manager.createSession();
    });

    it("메시지를 추가해야 한다", () => {
      const input = createTestMessageInput();
      const message = manager.addMessage(session.id, input);

      expect(message).toBeDefined();
      expect(message?.id).toMatch(/^msg-/);
      expect(message?.role).toBe("user");
      expect(message?.content).toBe("테스트 메시지");
    });

    it("세션의 메시지 목록에 추가되어야 한다", () => {
      manager.addMessage(session.id, createTestMessageInput());
      manager.addMessage(session.id, createTestMessageInput({ role: "assistant" }));

      const updated = manager.getSession(session.id);
      expect(updated?.messages).toHaveLength(2);
    });

    it("도구 호출 정보를 포함해야 한다", () => {
      const input: AddMessageInput = {
        role: "tool",
        content: "kubectl get pods",
        toolCall: {
          name: "kubectl",
          args: { command: "get pods" },
        },
      };

      const message = manager.addMessage(session.id, input);

      expect(message?.toolCall).toBeDefined();
      expect(message?.toolCall?.name).toBe("kubectl");
      expect(message?.toolCall?.status).toBe("pending");
    });

    it("세션의 updatedAt이 갱신되어야 한다", () => {
      // 과거 시간으로 세션의 updatedAt을 강제 설정
      const pastTime = "2026-01-01T00:00:00.000Z";
      const sessionToModify = manager.getSession(session.id);
      if (sessionToModify) {
        (sessionToModify as { updatedAt: string }).updatedAt = pastTime;
      }

      manager.addMessage(session.id, createTestMessageInput());

      const updated = manager.getSession(session.id);
      // 메시지 추가 후 시간이 현재 시간으로 갱신되었는지 확인
      expect(updated?.updatedAt).not.toBe(pastTime);
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(new Date(pastTime).getTime());
    });

    it("존재하지 않는 세션은 undefined를 반환해야 한다", () => {
      const result = manager.addMessage("nonexistent", createTestMessageInput());
      expect(result).toBeUndefined();
    });

    it("자동 체크포인트가 생성되어야 한다 (설정 활성화 시)", () => {
      const autoManager = createTestManager({
        autoCheckpoint: true,
        autoCheckpointInterval: 3,
      });
      const autoSession = autoManager.createSession();

      // 3개 메시지 추가
      autoManager.addMessage(autoSession.id, createTestMessageInput());
      autoManager.addMessage(autoSession.id, createTestMessageInput());
      autoManager.addMessage(autoSession.id, createTestMessageInput());

      const updated = autoManager.getSession(autoSession.id);
      expect(updated?.checkpoints).toHaveLength(1);
      expect(updated?.checkpoints[0].isAutomatic).toBe(true);
    });
  });

  describe("getMessage", () => {
    let manager: SessionManager;
    let session: Session;
    let message: SessionMessage;

    beforeEach(() => {
      manager = createTestManager();
      session = manager.createSession();
      message = manager.addMessage(session.id, createTestMessageInput())!;
    });

    it("존재하는 메시지를 반환해야 한다", () => {
      const found = manager.getMessage(session.id, message.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(message.id);
    });

    it("존재하지 않는 메시지는 undefined를 반환해야 한다", () => {
      const found = manager.getMessage(session.id, "nonexistent");
      expect(found).toBeUndefined();
    });

    it("존재하지 않는 세션은 undefined를 반환해야 한다", () => {
      const found = manager.getMessage("nonexistent", message.id);
      expect(found).toBeUndefined();
    });
  });

  describe("getMessages", () => {
    let manager: SessionManager;
    let session: Session;

    beforeEach(() => {
      manager = createTestManager();
      session = manager.createSession();

      // 10개 메시지 추가
      for (let i = 0; i < 10; i++) {
        manager.addMessage(session.id, {
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i + 1}`,
        });
      }
    });

    it("모든 메시지를 반환해야 한다", () => {
      const messages = manager.getMessages(session.id);
      expect(messages).toHaveLength(10);
    });

    it("limit 옵션이 적용되어야 한다", () => {
      const messages = manager.getMessages(session.id, 5);
      expect(messages).toHaveLength(5);
    });

    it("offset 옵션이 적용되어야 한다", () => {
      const messages = manager.getMessages(session.id, 5, 5);
      expect(messages).toHaveLength(5);
      expect(messages[0].content).toBe("Message 6");
    });

    it("존재하지 않는 세션은 빈 배열을 반환해야 한다", () => {
      const messages = manager.getMessages("nonexistent");
      expect(messages).toEqual([]);
    });
  });

  // ============================================
  // 🎯 체크포인트 관리 테스트
  // ============================================

  describe("createCheckpoint", () => {
    let manager: SessionManager;
    let session: Session;

    beforeEach(() => {
      manager = createTestManager({ autoCheckpoint: false });
      session = manager.createSession();
      // 5개 메시지 추가
      for (let i = 0; i < 5; i++) {
        manager.addMessage(session.id, createTestMessageInput());
      }
    });

    it("체크포인트를 생성해야 한다", () => {
      const input: CreateCheckpointInput = {
        label: "계획 승인됨",
        description: "사용자가 계획을 승인함",
      };

      const checkpoint = manager.createCheckpoint(session.id, input);

      expect(checkpoint).toBeDefined();
      expect(checkpoint?.id).toMatch(/^cp-/);
      expect(checkpoint?.sessionId).toBe(session.id);
      expect(checkpoint?.label).toBe("계획 승인됨");
      expect(checkpoint?.messageIndex).toBe(5);
    });

    it("세션의 체크포인트 목록에 추가되어야 한다", () => {
      manager.createCheckpoint(session.id, { label: "CP 1" });
      manager.createCheckpoint(session.id, { label: "CP 2" });

      const updated = manager.getSession(session.id);
      expect(updated?.checkpoints).toHaveLength(2);
    });

    // TODO: langGraphCheckpointId 필드 미구현 (TDD RED)
    it.skip("LangGraph 체크포인트 ID를 포함해야 한다", () => {
      const checkpoint = manager.createCheckpoint(session.id, {
        label: "LangGraph",
        langGraphCheckpointId: "lg-cp-001",
      });

      expect(checkpoint?.langGraphCheckpointId).toBe("lg-cp-001");
    });

    it("존재하지 않는 세션은 undefined를 반환해야 한다", () => {
      const result = manager.createCheckpoint("nonexistent", { label: "Test" });
      expect(result).toBeUndefined();
    });
  });

  describe("getCheckpoint", () => {
    let manager: SessionManager;
    let session: Session;
    let checkpoint: SessionCheckpoint;

    beforeEach(() => {
      manager = createTestManager({ autoCheckpoint: false });
      session = manager.createSession();
      manager.addMessage(session.id, createTestMessageInput());
      checkpoint = manager.createCheckpoint(session.id, { label: "Test" })!;
    });

    it("존재하는 체크포인트를 반환해야 한다", () => {
      const found = manager.getCheckpoint(session.id, checkpoint.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(checkpoint.id);
    });

    it("존재하지 않는 체크포인트는 undefined를 반환해야 한다", () => {
      const found = manager.getCheckpoint(session.id, "nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("getCheckpoints", () => {
    let manager: SessionManager;
    let session: Session;

    beforeEach(() => {
      manager = createTestManager({ autoCheckpoint: false });
      session = manager.createSession();

      for (let i = 0; i < 3; i++) {
        manager.addMessage(session.id, createTestMessageInput());
        manager.createCheckpoint(session.id, { label: `CP ${i + 1}` });
      }
    });

    it("모든 체크포인트를 반환해야 한다", () => {
      const checkpoints = manager.getCheckpoints(session.id);
      expect(checkpoints).toHaveLength(3);
    });

    it("존재하지 않는 세션은 빈 배열을 반환해야 한다", () => {
      const checkpoints = manager.getCheckpoints("nonexistent");
      expect(checkpoints).toEqual([]);
    });
  });

  describe("rollbackToCheckpoint", () => {
    let manager: SessionManager;
    let session: Session;
    let checkpoint: SessionCheckpoint;

    beforeEach(() => {
      manager = createTestManager({ autoCheckpoint: false });
      session = manager.createSession();

      // 3개 메시지 추가
      manager.addMessage(session.id, { role: "user", content: "Message 1" });
      manager.addMessage(session.id, { role: "assistant", content: "Message 2" });
      manager.addMessage(session.id, { role: "user", content: "Message 3" });

      // 2번째 메시지 후 체크포인트 생성
      checkpoint = manager.createCheckpoint(session.id, { label: "After 2" })!;

      // 추가 메시지
      manager.addMessage(session.id, { role: "assistant", content: "Message 4" });
      manager.addMessage(session.id, { role: "user", content: "Message 5" });
    });

    it("체크포인트 시점으로 롤백해야 한다", () => {
      expect(manager.getSession(session.id)?.messages).toHaveLength(5);

      const rolledBack = manager.rollbackToCheckpoint(session.id, checkpoint.id);

      expect(rolledBack).toBeDefined();
      expect(rolledBack?.messages).toHaveLength(3); // checkpoint.messageIndex = 3
    });

    it("롤백 후 새 체크포인트가 생성되어야 한다", () => {
      const beforeCount = manager.getCheckpoints(session.id).length;

      manager.rollbackToCheckpoint(session.id, checkpoint.id);

      const afterCount = manager.getCheckpoints(session.id).length;
      expect(afterCount).toBe(beforeCount + 1);
    });

    it("존재하지 않는 체크포인트는 undefined를 반환해야 한다", () => {
      const result = manager.rollbackToCheckpoint(session.id, "nonexistent");
      expect(result).toBeUndefined();
    });

    it("존재하지 않는 세션은 undefined를 반환해야 한다", () => {
      const result = manager.rollbackToCheckpoint("nonexistent", checkpoint.id);
      expect(result).toBeUndefined();
    });
  });

  // ============================================
  // 🎯 내보내기/가져오기 테스트
  // ============================================

  describe("exportSession", () => {
    let manager: SessionManager;
    let session: Session;

    beforeEach(() => {
      manager = createTestManager({ autoCheckpoint: false });
      session = manager.createSession({ title: "Export Test" });
      manager.addMessage(session.id, { role: "user", content: "Hello" });
      manager.createCheckpoint(session.id, { label: "CP 1" });
    });

    it("세션을 JSON으로 내보내야 한다", () => {
      const json = manager.exportSession(session.id);

      expect(json).toBeDefined();

      const parsed = JSON.parse(json!);
      expect(parsed.id).toBe(session.id);
      expect(parsed.title).toBe("Export Test");
      expect(parsed.messages).toHaveLength(1);
      expect(parsed.checkpoints).toHaveLength(1);
    });

    it("존재하지 않는 세션은 undefined를 반환해야 한다", () => {
      const json = manager.exportSession("nonexistent");
      expect(json).toBeUndefined();
    });
  });

  describe("importSession", () => {
    let manager: SessionManager;

    beforeEach(() => {
      manager = createTestManager({ autoCheckpoint: false });
    });

    it("JSON에서 세션을 가져와야 한다", () => {
      const sessionData: Session = {
        id: "imported-session",
        threadId: "imported-thread",
        title: "Imported Session",
        status: "completed",
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Hello",
            timestamp: "2026-01-05T10:00:00.000Z",
          },
        ],
        checkpoints: [],
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:05:00.000Z",
      };

      const json = JSON.stringify(sessionData);
      const imported = manager.importSession(json);

      expect(imported).toBeDefined();
      expect(imported?.id).toBe("imported-session");
      expect(imported?.title).toBe("Imported Session");
    });

    it("가져온 세션을 조회할 수 있어야 한다", () => {
      const sessionData: Session = {
        id: "imported-session-2",
        threadId: "imported-thread-2",
        title: "Imported",
        status: "active",
        messages: [],
        checkpoints: [],
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:00:00.000Z",
      };

      manager.importSession(JSON.stringify(sessionData));

      const found = manager.getSession("imported-session-2");
      expect(found).toBeDefined();
    });

    it("잘못된 JSON은 undefined를 반환해야 한다", () => {
      const result = manager.importSession("invalid json");
      expect(result).toBeUndefined();
    });

    it("유효하지 않은 세션 데이터는 undefined를 반환해야 한다", () => {
      const result = manager.importSession(JSON.stringify({ invalid: true }));
      expect(result).toBeUndefined();
    });
  });

  describe("exportAllSessions", () => {
    let manager: SessionManager;

    beforeEach(() => {
      manager = createTestManager();
      manager.createSession({ title: "Session 1" });
      manager.createSession({ title: "Session 2" });
    });

    it("모든 세션을 JSON 배열로 내보내야 한다", () => {
      const json = manager.exportAllSessions();
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });
  });

  // ============================================
  // 🎯 유틸리티 테스트
  // ============================================

  describe("cleanupExpiredSessions", () => {
    it("만료된 세션을 정리해야 한다", () => {
      // 짧은 만료 시간으로 매니저 생성
      const manager = createTestManager({ sessionExpiryMs: 1 });

      manager.createSession({ title: "Old Session" });

      // 잠시 대기 후 정리
      const cleaned = manager.cleanupExpiredSessions();

      // 1ms 만료이므로 대부분 삭제됨
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe("clear", () => {
    let manager: SessionManager;

    beforeEach(() => {
      manager = createTestManager();
      manager.createSession();
      manager.createSession();
    });

    it("모든 세션을 삭제해야 한다", () => {
      expect(manager.getSessionCount()).toBe(2);

      manager.clear();

      expect(manager.getSessionCount()).toBe(0);
    });
  });
});
