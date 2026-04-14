/**
 * 🎯 목적: 기존 기능 회귀 테스트 - 세션/MCP 기능
 * 01: 기존 기능 회귀 테스트
 *
 * 📝 테스트 범위:
 * - SessionManager: 세션 CRUD 및 메시지/체크포인트 관리
 * - MCPConfigStore: MCP 서버 설정 관리
 * - 설정 검증 함수
 *
 * @packageDocumentation
 */

import { autorun, runInAction } from "mobx";
import {
  createMCPServerConfig,
  MCPConfigStore,
  mcpConfigStore,
  validateMCPServerConfig,
} from "../../common/mcp-config";
import { SessionManager } from "../../common/session-manager";

import type { MCPServerConfigHttp, MCPServerConfigInput, MCPServerConfigStdio } from "../../common/mcp-config";

// ============================================
// 🔹 SessionManager 회귀 테스트
// ============================================

describe("SessionManager 회귀 테스트", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    SessionManager.resetInstance();
    mcpConfigStore.reset();
    sessionManager = SessionManager.getInstance();
  });

  afterEach(() => {
    SessionManager.resetInstance();
  });

  describe("AC36: 싱글톤 패턴 검증", () => {
    it("getInstance가 동일한 인스턴스를 반환해야 함", () => {
      const instance1 = SessionManager.getInstance();
      const instance2 = SessionManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("resetInstance 후 새 인스턴스가 생성되어야 함", () => {
      const instance1 = SessionManager.getInstance();
      SessionManager.resetInstance();
      const instance2 = SessionManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("AC37: 세션 CRUD 검증", () => {
    it("createSession으로 새 세션이 생성되어야 함", () => {
      const session = sessionManager.createSession({ title: "Test Session" });

      expect(session).toBeDefined();
      expect(session.id).toBeTruthy();
      expect(session.title).toBe("Test Session");
      expect(session.status).toBe("active");
      expect(session.messages).toEqual([]);
      expect(session.checkpoints).toEqual([]);
    });

    it("getSession으로 세션을 조회할 수 있어야 함", () => {
      const created = sessionManager.createSession({ title: "Test" });
      const retrieved = sessionManager.getSession(created.id);

      expect(retrieved).toEqual(created);
    });

    it("listSessions로 세션 목록을 조회할 수 있어야 함", () => {
      sessionManager.createSession({ title: "Session 1" });
      sessionManager.createSession({ title: "Session 2" });
      sessionManager.createSession({ title: "Session 3" });

      const result = sessionManager.listSessions();

      expect(result.sessions).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("updateSession으로 세션을 업데이트할 수 있어야 함", () => {
      const session = sessionManager.createSession({ title: "Original" });

      const updated = sessionManager.updateSession(session.id, {
        title: "Updated",
        status: "paused",
      });

      expect(updated?.title).toBe("Updated");
      expect(updated?.status).toBe("paused");
    });

    it("deleteSession으로 세션을 삭제할 수 있어야 함", () => {
      const session = sessionManager.createSession();
      expect(sessionManager.getSessionCount()).toBe(1);

      const result = sessionManager.deleteSession(session.id);

      expect(result).toBe(true);
      expect(sessionManager.getSessionCount()).toBe(0);
    });

    it("존재하지 않는 세션 삭제 시 false를 반환해야 함", () => {
      const result = sessionManager.deleteSession("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("AC38: 활성 세션 관리 검증", () => {
    it("activateSession으로 세션을 활성화할 수 있어야 함", () => {
      const session = sessionManager.createSession();

      const activated = sessionManager.activateSession(session.id);

      expect(activated?.status).toBe("active");
      expect(sessionManager.getActiveSession()?.id).toBe(session.id);
    });

    it("새 세션 활성화 시 이전 활성 세션이 paused 상태가 되어야 함", () => {
      const session1 = sessionManager.createSession();
      const session2 = sessionManager.createSession();

      sessionManager.activateSession(session1.id);
      sessionManager.activateSession(session2.id);

      expect(sessionManager.getSession(session1.id)?.status).toBe("paused");
      expect(sessionManager.getSession(session2.id)?.status).toBe("active");
    });
  });

  describe("AC39: 메시지 관리 검증", () => {
    it("addMessage로 메시지를 추가할 수 있어야 함", () => {
      const session = sessionManager.createSession();

      const message = sessionManager.addMessage(session.id, {
        role: "user",
        content: "Hello!",
      });

      expect(message).toBeDefined();
      expect(message?.role).toBe("user");
      expect(message?.content).toBe("Hello!");
    });

    it("getMessage로 메시지를 조회할 수 있어야 함", () => {
      const session = sessionManager.createSession();
      const added = sessionManager.addMessage(session.id, {
        role: "user",
        content: "Test message",
      });

      const retrieved = sessionManager.getMessage(session.id, added!.id);

      expect(retrieved).toEqual(added);
    });

    it("getMessages로 메시지 목록을 조회할 수 있어야 함", () => {
      const session = sessionManager.createSession();
      sessionManager.addMessage(session.id, { role: "user", content: "1" });
      sessionManager.addMessage(session.id, { role: "assistant", content: "2" });
      sessionManager.addMessage(session.id, { role: "user", content: "3" });

      const messages = sessionManager.getMessages(session.id);

      expect(messages).toHaveLength(3);
    });

    it("getMessages에 limit과 offset이 적용되어야 함", () => {
      const session = sessionManager.createSession();
      for (let i = 0; i < 10; i++) {
        sessionManager.addMessage(session.id, { role: "user", content: `Message ${i}` });
      }

      const limited = sessionManager.getMessages(session.id, 3);
      const offsetted = sessionManager.getMessages(session.id, 3, 5);

      expect(limited).toHaveLength(3);
      expect(limited[0].content).toBe("Message 0");

      expect(offsetted).toHaveLength(3);
      expect(offsetted[0].content).toBe("Message 5");
    });
  });

  describe("AC40: 체크포인트 관리 검증", () => {
    it("createCheckpoint로 체크포인트를 생성할 수 있어야 함", () => {
      const session = sessionManager.createSession();
      sessionManager.addMessage(session.id, { role: "user", content: "msg1" });
      sessionManager.addMessage(session.id, { role: "user", content: "msg2" });

      const checkpoint = sessionManager.createCheckpoint(session.id, {
        label: "Test Checkpoint",
        description: "Test description",
      });

      expect(checkpoint).toBeDefined();
      expect(checkpoint?.label).toBe("Test Checkpoint");
      expect(checkpoint?.messageIndex).toBe(2);
    });

    it("getCheckpoint으로 체크포인트를 조회할 수 있어야 함", () => {
      const session = sessionManager.createSession();
      const created = sessionManager.createCheckpoint(session.id, { label: "CP1" });

      const retrieved = sessionManager.getCheckpoint(session.id, created!.id);

      expect(retrieved).toEqual(created);
    });

    it("getCheckpoints로 체크포인트 목록을 조회할 수 있어야 함", () => {
      const session = sessionManager.createSession();
      sessionManager.createCheckpoint(session.id, { label: "CP1" });
      sessionManager.createCheckpoint(session.id, { label: "CP2" });

      const checkpoints = sessionManager.getCheckpoints(session.id);

      expect(checkpoints).toHaveLength(2);
    });

    it("rollbackToCheckpoint로 체크포인트로 롤백할 수 있어야 함", () => {
      const session = sessionManager.createSession();
      sessionManager.addMessage(session.id, { role: "user", content: "msg1" });
      sessionManager.addMessage(session.id, { role: "user", content: "msg2" });
      const checkpoint = sessionManager.createCheckpoint(session.id, { label: "CP" });
      sessionManager.addMessage(session.id, { role: "user", content: "msg3" });
      sessionManager.addMessage(session.id, { role: "user", content: "msg4" });

      const rolledBack = sessionManager.rollbackToCheckpoint(session.id, checkpoint!.id);

      expect(rolledBack?.messages).toHaveLength(2);
      expect(sessionManager.getCheckpoints(session.id).length).toBeGreaterThan(1);
    });
  });

  describe("AC41: 세션 내보내기/가져오기 검증", () => {
    it("exportSession으로 세션을 JSON으로 내보낼 수 있어야 함", () => {
      const session = sessionManager.createSession({ title: "Export Test" });
      sessionManager.addMessage(session.id, { role: "user", content: "Hello" });

      const exported = sessionManager.exportSession(session.id);

      expect(exported).toBeTruthy();
      const parsed = JSON.parse(exported!);
      expect(parsed.title).toBe("Export Test");
      expect(parsed.messages).toHaveLength(1);
    });

    it("importSession으로 JSON에서 세션을 가져올 수 있어야 함", () => {
      const session = sessionManager.createSession({ title: "Import Test" });
      sessionManager.addMessage(session.id, { role: "user", content: "Imported" });
      const exported = sessionManager.exportSession(session.id);

      sessionManager.clear();
      const imported = sessionManager.importSession(exported!);

      expect(imported).toBeDefined();
      expect(imported?.title).toBe("Import Test");
      expect(sessionManager.getSession(imported!.id)).toBeDefined();
    });

    it("잘못된 JSON으로 importSession 시 undefined를 반환해야 함", () => {
      const result = sessionManager.importSession("invalid json");
      expect(result).toBeUndefined();
    });

    it("exportAllSessions로 모든 세션을 내보낼 수 있어야 함", () => {
      sessionManager.createSession({ title: "Session 1" });
      sessionManager.createSession({ title: "Session 2" });

      const exported = sessionManager.exportAllSessions();

      const parsed = JSON.parse(exported);
      expect(parsed).toHaveLength(2);
    });
  });

  describe("AC42: 세션 정리 검증", () => {
    it("cleanupExpiredSessions로 만료된 세션을 정리할 수 있어야 함", () => {
      // 이 테스트는 실제 시간 경과가 필요하므로 구조만 검증
      const session = sessionManager.createSession();
      const count = sessionManager.cleanupExpiredSessions();

      // 방금 생성된 세션은 만료되지 않음
      expect(count).toBe(0);
      expect(sessionManager.getSession(session.id)).toBeDefined();
    });

    it("clear로 모든 세션을 초기화할 수 있어야 함", () => {
      sessionManager.createSession();
      sessionManager.createSession();

      sessionManager.clear();

      expect(sessionManager.getSessionCount()).toBe(0);
    });
  });

  describe("AC43: 자동 체크포인트 검증", () => {
    it("autoCheckpointInterval 간격으로 자동 체크포인트가 생성되어야 함", () => {
      SessionManager.resetInstance();
      const manager = new SessionManager({
        autoCheckpoint: true,
        autoCheckpointInterval: 3,
      });

      const session = manager.createSession();
      manager.addMessage(session.id, { role: "user", content: "msg1" });
      manager.addMessage(session.id, { role: "user", content: "msg2" });
      manager.addMessage(session.id, { role: "user", content: "msg3" });

      const checkpoints = manager.getCheckpoints(session.id);
      expect(checkpoints.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("AC44: 최대 세션 수 제한 검증", () => {
    it("maxSessions 초과 시 가장 오래된 세션이 삭제되어야 함", () => {
      SessionManager.resetInstance();
      const manager = new SessionManager({ maxSessions: 3 });

      manager.createSession({ title: "Session 1" });
      manager.createSession({ title: "Session 2" });
      manager.createSession({ title: "Session 3" });
      manager.createSession({ title: "Session 4" });

      expect(manager.getSessionCount()).toBe(3);
      const result = manager.listSessions();
      expect(result.sessions.every((s) => s.title !== "Session 1")).toBe(true);
    });
  });
});

// ============================================
// 🔹 MCPConfigStore 회귀 테스트
// ============================================

describe("MCPConfigStore 회귀 테스트", () => {
  let store: MCPConfigStore;

  beforeEach(() => {
    localStorage.clear();
    store = new MCPConfigStore();
  });

  describe("AC45: 초기 상태 검증", () => {
    it("모든 초기값이 올바르게 설정되어야 함", () => {
      expect(store.servers).toEqual([]);
      expect(store.enabledServers).toEqual([]);
      expect(store.connectedServers).toEqual([]);
      expect(store.hasConnectedServers).toBe(false);
    });
  });

  describe("AC46: 서버 CRUD 검증", () => {
    it("addServer로 stdio 서버를 추가할 수 있어야 함", () => {
      const config: MCPServerConfigInput = {
        type: "stdio",
        name: "Test Server",
        enabled: true,
        command: "npx",
        args: ["@modelcontextprotocol/server-test"],
      };

      const id = store.addServer(config);

      expect(id).toBeTruthy();
      expect(store.servers).toHaveLength(1);
      expect(store.servers[0].name).toBe("Test Server");
      expect(store.getServerStatus(id)).toBe("disconnected");
    });

    it("addServer로 http 서버를 추가할 수 있어야 함", () => {
      const config: MCPServerConfigInput = {
        type: "http",
        name: "HTTP Server",
        enabled: true,
        url: "http://localhost:3000",
      };

      const id = store.addServer(config);

      expect(id).toBeTruthy();
      const server = store.getServer(id) as MCPServerConfigHttp;
      expect(server.type).toBe("http");
      expect(server.url).toBe("http://localhost:3000");
    });

    it("updateServer로 서버를 업데이트할 수 있어야 함", () => {
      const id = store.addServer({
        type: "stdio",
        name: "Original",
        enabled: true,
        command: "cmd1",
      });

      store.updateServer(id, { name: "Updated", enabled: false });

      const server = store.getServer(id);
      expect(server?.name).toBe("Updated");
      expect(server?.enabled).toBe(false);
    });

    it("존재하지 않는 서버 업데이트 시 에러가 발생해야 함", () => {
      expect(() => store.updateServer("non-existent", { name: "Test" })).toThrow();
    });

    it("removeServer로 서버를 삭제할 수 있어야 함", () => {
      const id = store.addServer({
        type: "stdio",
        name: "To Remove",
        enabled: true,
        command: "cmd",
      });

      store.removeServer(id);

      expect(store.servers).toHaveLength(0);
      expect(store.getServer(id)).toBeUndefined();
    });
  });

  describe("AC47: 서버 상태 관리 검증", () => {
    it("setServerStatus로 상태를 설정할 수 있어야 함", () => {
      const id = store.addServer({
        type: "stdio",
        name: "Test",
        enabled: true,
        command: "cmd",
      });

      store.setServerStatus(id, "connecting");
      expect(store.getServerStatus(id)).toBe("connecting");

      store.setServerStatus(id, "connected");
      expect(store.getServerStatus(id)).toBe("connected");
    });

    it("error 상태 시 에러 메시지가 저장되어야 함", () => {
      const id = store.addServer({
        type: "stdio",
        name: "Test",
        enabled: true,
        command: "cmd",
      });

      store.setServerStatus(id, "error", "Connection failed");

      expect(store.getServerStatus(id)).toBe("error");
      expect(store.getServerError(id)).toBe("Connection failed");
    });

    it("error가 아닌 상태로 변경 시 에러 메시지가 삭제되어야 함", () => {
      const id = store.addServer({
        type: "stdio",
        name: "Test",
        enabled: true,
        command: "cmd",
      });

      store.setServerStatus(id, "error", "Error message");
      store.setServerStatus(id, "connected");

      expect(store.getServerError(id)).toBeUndefined();
    });
  });

  describe("AC48: computed 속성 검증", () => {
    it("enabledServers가 활성화된 서버만 반환해야 함", () => {
      store.addServer({
        type: "stdio",
        name: "Enabled 1",
        enabled: true,
        command: "cmd",
      });
      store.addServer({
        type: "stdio",
        name: "Disabled",
        enabled: false,
        command: "cmd",
      });
      store.addServer({
        type: "stdio",
        name: "Enabled 2",
        enabled: true,
        command: "cmd",
      });

      expect(store.enabledServers).toHaveLength(2);
      expect(store.enabledServers.every((s) => s.enabled)).toBe(true);
    });

    it("connectedServers가 연결된 서버만 반환해야 함", () => {
      const id1 = store.addServer({
        type: "stdio",
        name: "Server 1",
        enabled: true,
        command: "cmd",
      });
      const id2 = store.addServer({
        type: "stdio",
        name: "Server 2",
        enabled: true,
        command: "cmd",
      });
      const id3 = store.addServer({
        type: "stdio",
        name: "Server 3",
        enabled: true,
        command: "cmd",
      });

      store.setServerStatus(id1, "connected");
      store.setServerStatus(id2, "disconnected");
      store.setServerStatus(id3, "connected");

      expect(store.connectedServers).toHaveLength(2);
      expect(store.hasConnectedServers).toBe(true);
    });
  });

  describe("AC49: reset 검증", () => {
    it("reset으로 모든 상태가 초기화되어야 함", () => {
      const id = store.addServer({
        type: "stdio",
        name: "Test",
        enabled: true,
        command: "cmd",
      });
      store.setServerStatus(id, "error", "Error");

      store.reset();

      expect(store.servers).toEqual([]);
      expect(store.serverStatuses.size).toBe(0);
    });
  });
});

// ============================================
// 🔹 MCP 검증 함수 회귀 테스트
// ============================================

describe("MCP 검증 함수 회귀 테스트", () => {
  describe("AC50: createMCPServerConfig 검증", () => {
    it("stdio 서버 설정을 생성할 수 있어야 함", () => {
      const input: MCPServerConfigInput = {
        type: "stdio",
        name: "Test Server",
        enabled: true,
        command: "npx",
        args: ["test"],
      };

      const config = createMCPServerConfig(input);

      expect(config.id).toBeTruthy();
      expect(config.id).toMatch(/^mcp-/);
      expect(config.name).toBe("Test Server");
      expect(config.type).toBe("stdio");
    });

    it("http 서버 설정을 생성할 수 있어야 함", () => {
      const input: MCPServerConfigInput = {
        type: "http",
        name: "HTTP Server",
        enabled: true,
        url: "http://localhost:3000",
      };

      const config = createMCPServerConfig(input);

      expect(config.id).toBeTruthy();
      expect((config as MCPServerConfigHttp).url).toBe("http://localhost:3000");
    });
  });

  describe("AC51: validateMCPServerConfig 검증", () => {
    it("유효한 stdio 설정은 valid=true를 반환해야 함", () => {
      const result = validateMCPServerConfig({
        type: "stdio",
        name: "Valid Server",
        command: "npx test",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("유효한 http 설정은 valid=true를 반환해야 함", () => {
      const result = validateMCPServerConfig({
        type: "http",
        name: "Valid HTTP",
        url: "http://localhost:3000",
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("이름이 없으면 에러를 반환해야 함", () => {
      const result = validateMCPServerConfig({
        type: "stdio",
        command: "test",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("서버 이름은 필수입니다");
    });

    it("빈 이름이면 에러를 반환해야 함", () => {
      const result = validateMCPServerConfig({
        type: "stdio",
        name: "   ",
        command: "test",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("서버 이름은 필수입니다");
    });

    it("잘못된 타입이면 에러를 반환해야 함", () => {
      const result = validateMCPServerConfig({
        type: "invalid" as never,
        name: "Test",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("서버 타입은 'stdio' 또는 'http'여야 합니다");
    });

    it("stdio 타입에 command가 없으면 에러를 반환해야 함", () => {
      const result = validateMCPServerConfig({
        type: "stdio",
        name: "Test",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("stdio 서버는 command가 필수입니다");
    });

    it("http 타입에 url이 없으면 에러를 반환해야 함", () => {
      const result = validateMCPServerConfig({
        type: "http",
        name: "Test",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("http 서버는 url이 필수입니다");
    });

    it("잘못된 URL 형식이면 에러를 반환해야 함", () => {
      const result = validateMCPServerConfig({
        type: "http",
        name: "Test",
        url: "not-a-valid-url",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("유효한 URL 형식이 아닙니다");
    });

    it("여러 에러가 동시에 반환될 수 있어야 함", () => {
      const result = validateMCPServerConfig({
        type: "invalid" as never,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});

// ============================================
// 🔹 MobX 반응성 통합 검증
// ============================================

describe("MobX 반응성 통합 검증", () => {
  describe("AC52: MCPConfigStore MobX 반응성", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("서버 추가 시 autorun이 트리거되어야 함", () => {
      const store = new MCPConfigStore();
      const serverCounts: number[] = [];
      const dispose = autorun(() => {
        serverCounts.push(store.servers.length);
      });

      store.addServer({
        type: "stdio",
        name: "Server 1",
        enabled: true,
        command: "cmd",
      });
      store.addServer({
        type: "stdio",
        name: "Server 2",
        enabled: true,
        command: "cmd",
      });

      expect(serverCounts).toEqual([0, 1, 2]);

      dispose();
    });

    it("상태 변경 시 computed 속성이 재계산되어야 함", () => {
      const store = new MCPConfigStore();
      const id = store.addServer({
        type: "stdio",
        name: "Test",
        enabled: true,
        command: "cmd",
      });

      const connectedCounts: number[] = [];
      const dispose = autorun(() => {
        connectedCounts.push(store.connectedServers.length);
      });

      store.setServerStatus(id, "connected");
      store.setServerStatus(id, "disconnected");
      store.setServerStatus(id, "connected");

      expect(connectedCounts).toEqual([0, 1, 0, 1]);

      dispose();
    });
  });
});
