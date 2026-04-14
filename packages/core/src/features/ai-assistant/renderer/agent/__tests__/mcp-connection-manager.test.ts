/**
 * 🎯 목적: MCP 연결 관리자 테스트
 * 01: MCPAgentOrchestrator 연결 로직 (TDD)
 *
 * 📝 테스트 범위:
 * - MCPConfigStore와 연결
 * - 서버 연결/해제
 * - 연결 상태 관리
 * - 도구 로딩
 *
 * @packageDocumentation
 */

import { mcpConfigStore } from "../../../common/mcp-config";
import { MCPConnectionManager } from "../mcp-connection-manager";

// ============================================
// 🎯 Mock 설정
// ============================================

// MCP Adapters 모킹
const mockGetTools = jest.fn().mockResolvedValue([{ name: "test-tool", description: "A test tool" }]);
const mockClose = jest.fn();

jest.mock("@langchain/mcp-adapters", () => ({
  MultiServerMCPClient: jest.fn().mockImplementation(() => ({
    getTools: mockGetTools,
    close: mockClose,
  })),
}));

// Logger 모킹
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
};

describe("MCPConnectionManager", () => {
  let manager: MCPConnectionManager;

  beforeEach(() => {
    // 스토어 초기화
    mcpConfigStore.reset();
    mockGetTools.mockClear();
    mockClose.mockClear();
    Object.values(mockLogger).forEach((fn) => fn.mockClear());

    manager = new MCPConnectionManager({ logger: mockLogger as any });
  });

  afterEach(async () => {
    // 연결 정리
    await manager.disconnectAll();
  });

  // ============================================
  // 서버 연결
  // ============================================

  describe("서버 연결", () => {
    it("활성화된 stdio 서버에 연결할 수 있어야 함", async () => {
      const serverId = mcpConfigStore.addServer({
        name: "Test Stdio Server",
        type: "stdio",
        command: "node",
        args: ["server.js"],
        enabled: true,
      });

      await manager.connect(serverId);

      const status = mcpConfigStore.getServerStatus(serverId);
      expect(status).toBe("connected");
    });

    it("활성화된 http 서버에 연결할 수 있어야 함", async () => {
      const serverId = mcpConfigStore.addServer({
        name: "Test HTTP Server",
        type: "http",
        url: "http://localhost:3000",
        enabled: true,
      });

      await manager.connect(serverId);

      const status = mcpConfigStore.getServerStatus(serverId);
      expect(status).toBe("connected");
    });

    it("비활성화된 서버는 연결하지 않아야 함", async () => {
      const serverId = mcpConfigStore.addServer({
        name: "Disabled Server",
        type: "stdio",
        command: "node",
        enabled: false,
      });

      await manager.connect(serverId);

      const status = mcpConfigStore.getServerStatus(serverId);
      expect(status).toBe("disconnected");
    });

    it("존재하지 않는 서버 연결 시 에러를 발생시켜야 함", async () => {
      await expect(manager.connect("non-existent-id")).rejects.toThrow();
    });

    it("연결 시 상태가 connecting -> connected 순으로 변경되어야 함", async () => {
      const statuses: string[] = [];
      const serverId = mcpConfigStore.addServer({
        name: "Status Track Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      // 상태 변경 추적
      const originalSetStatus = mcpConfigStore.setServerStatus.bind(mcpConfigStore);
      mcpConfigStore.setServerStatus = (id, status, error) => {
        statuses.push(status);
        originalSetStatus(id, status, error);
      };

      await manager.connect(serverId);

      expect(statuses).toContain("connecting");
      expect(statuses).toContain("connected");
    });

    it("연결 실패 시 error 상태와 에러 메시지를 설정해야 함", async () => {
      mockGetTools.mockRejectedValueOnce(new Error("Connection failed"));

      const serverId = mcpConfigStore.addServer({
        name: "Failing Server",
        type: "stdio",
        command: "invalid-command",
        enabled: true,
      });

      await manager.connect(serverId);

      const status = mcpConfigStore.getServerStatus(serverId);
      const error = mcpConfigStore.getServerError(serverId);

      expect(status).toBe("error");
      expect(error).toContain("Connection failed");
    });
  });

  // ============================================
  // 서버 해제
  // ============================================

  describe("서버 해제", () => {
    it("연결된 서버를 해제할 수 있어야 함", async () => {
      const serverId = mcpConfigStore.addServer({
        name: "Test Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      await manager.connect(serverId);
      await manager.disconnect(serverId);

      const status = mcpConfigStore.getServerStatus(serverId);
      expect(status).toBe("disconnected");
    });

    it("연결되지 않은 서버 해제 시 조용히 무시해야 함", async () => {
      const serverId = mcpConfigStore.addServer({
        name: "Not Connected Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      // 에러 없이 실행되어야 함
      await expect(manager.disconnect(serverId)).resolves.not.toThrow();
    });

    it("모든 서버를 한번에 해제할 수 있어야 함", async () => {
      const serverId1 = mcpConfigStore.addServer({
        name: "Server 1",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const serverId2 = mcpConfigStore.addServer({
        name: "Server 2",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      await manager.connect(serverId1);
      await manager.connect(serverId2);
      await manager.disconnectAll();

      expect(mcpConfigStore.getServerStatus(serverId1)).toBe("disconnected");
      expect(mcpConfigStore.getServerStatus(serverId2)).toBe("disconnected");
    });
  });

  // ============================================
  // 모든 활성 서버 연결
  // ============================================

  describe("모든 활성 서버 연결", () => {
    it("활성화된 모든 서버에 연결해야 함", async () => {
      const serverId1 = mcpConfigStore.addServer({
        name: "Enabled 1",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const serverId2 = mcpConfigStore.addServer({
        name: "Enabled 2",
        type: "http",
        url: "http://localhost:3000",
        enabled: true,
      });
      mcpConfigStore.addServer({
        name: "Disabled",
        type: "stdio",
        command: "node",
        enabled: false,
      });

      await manager.connectAllEnabled();

      expect(mcpConfigStore.getServerStatus(serverId1)).toBe("connected");
      expect(mcpConfigStore.getServerStatus(serverId2)).toBe("connected");
    });

    it("일부 서버 실패해도 다른 서버는 연결되어야 함", async () => {
      mockGetTools
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce([{ name: "tool", description: "desc" }]);

      const serverId1 = mcpConfigStore.addServer({
        name: "Failing",
        type: "stdio",
        command: "fail",
        enabled: true,
      });
      const serverId2 = mcpConfigStore.addServer({
        name: "Success",
        type: "stdio",
        command: "success",
        enabled: true,
      });

      await manager.connectAllEnabled();

      expect(mcpConfigStore.getServerStatus(serverId1)).toBe("error");
      expect(mcpConfigStore.getServerStatus(serverId2)).toBe("connected");
    });
  });

  // ============================================
  // 도구 로딩
  // ============================================

  describe("도구 로딩", () => {
    it("연결된 서버의 도구를 가져올 수 있어야 함", async () => {
      mockGetTools.mockResolvedValueOnce([
        { name: "tool1", description: "Tool 1" },
        { name: "tool2", description: "Tool 2" },
      ]);

      const serverId = mcpConfigStore.addServer({
        name: "Tool Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      await manager.connect(serverId);
      const tools = manager.getToolsForServer(serverId);

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe("tool1");
    });

    it("모든 연결된 서버의 도구를 병합하여 가져올 수 있어야 함", async () => {
      mockGetTools
        .mockResolvedValueOnce([{ name: "tool1", description: "Tool 1" }])
        .mockResolvedValueOnce([{ name: "tool2", description: "Tool 2" }]);

      const serverId1 = mcpConfigStore.addServer({
        name: "Server 1",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const serverId2 = mcpConfigStore.addServer({
        name: "Server 2",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      await manager.connect(serverId1);
      await manager.connect(serverId2);

      const allTools = manager.getAllTools();

      expect(allTools).toHaveLength(2);
    });

    it("연결되지 않은 서버의 도구는 빈 배열을 반환해야 함", async () => {
      const serverId = mcpConfigStore.addServer({
        name: "Not Connected",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      const tools = manager.getToolsForServer(serverId);

      expect(tools).toEqual([]);
    });
  });

  // ============================================
  // MCP 설정 생성
  // ============================================

  describe("MCP 설정 생성", () => {
    it("활성 서버 설정을 JSON으로 변환할 수 있어야 함", () => {
      mcpConfigStore.addServer({
        name: "Test Server",
        type: "stdio",
        command: "node",
        args: ["server.js"],
        enabled: true,
      });

      const config = manager.generateMcpConfiguration();
      const parsed = JSON.parse(config);

      expect(parsed.mcpServers).toBeDefined();
      expect(Object.keys(parsed.mcpServers)).toHaveLength(1);
    });

    it("비활성 서버는 설정에 포함되지 않아야 함", () => {
      mcpConfigStore.addServer({
        name: "Enabled",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      mcpConfigStore.addServer({
        name: "Disabled",
        type: "stdio",
        command: "node",
        enabled: false,
      });

      const config = manager.generateMcpConfiguration();
      const parsed = JSON.parse(config);

      expect(Object.keys(parsed.mcpServers)).toHaveLength(1);
    });

    it("stdio 서버 설정을 올바르게 변환해야 함", () => {
      mcpConfigStore.addServer({
        name: "Stdio Server",
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        env: { DEBUG: "true" },
        enabled: true,
      });

      const config = manager.generateMcpConfiguration();
      const parsed = JSON.parse(config);
      const serverConfig = parsed.mcpServers["Stdio Server"];

      expect(serverConfig.type).toBe("stdio");
      expect(serverConfig.command).toBe("npx");
      expect(serverConfig.args).toEqual(["-y", "@modelcontextprotocol/server-filesystem"]);
      expect(serverConfig.env).toEqual({ DEBUG: "true" });
    });

    it("http 서버 설정을 올바르게 변환해야 함", () => {
      mcpConfigStore.addServer({
        name: "HTTP Server",
        type: "http",
        url: "http://localhost:3000/mcp",
        headers: { Authorization: "Bearer token" },
        enabled: true,
      });

      const config = manager.generateMcpConfiguration();
      const parsed = JSON.parse(config);
      const serverConfig = parsed.mcpServers["HTTP Server"];

      expect(serverConfig.type).toBe("http");
      expect(serverConfig.url).toBe("http://localhost:3000/mcp");
      expect(serverConfig.headers).toEqual({ Authorization: "Bearer token" });
    });
  });

  // ============================================
  // 연결 상태 조회
  // ============================================

  describe("연결 상태 조회", () => {
    it("서버 연결 여부를 확인할 수 있어야 함", async () => {
      const serverId = mcpConfigStore.addServer({
        name: "Test",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      expect(manager.isConnected(serverId)).toBe(false);

      await manager.connect(serverId);

      expect(manager.isConnected(serverId)).toBe(true);
    });

    it("연결된 서버 수를 확인할 수 있어야 함", async () => {
      const serverId1 = mcpConfigStore.addServer({
        name: "Server 1",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const serverId2 = mcpConfigStore.addServer({
        name: "Server 2",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      expect(manager.connectedCount).toBe(0);

      await manager.connect(serverId1);
      expect(manager.connectedCount).toBe(1);

      await manager.connect(serverId2);
      expect(manager.connectedCount).toBe(2);
    });

    it("연결된 서버 ID 목록을 가져올 수 있어야 함", async () => {
      const serverId1 = mcpConfigStore.addServer({
        name: "Server 1",
        type: "stdio",
        command: "node",
        enabled: true,
      });
      const serverId2 = mcpConfigStore.addServer({
        name: "Server 2",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      await manager.connect(serverId1);
      await manager.connect(serverId2);

      const connectedIds = manager.getConnectedServerIds();

      expect(connectedIds).toContain(serverId1);
      expect(connectedIds).toContain(serverId2);
    });
  });

  // ============================================
  // 재연결
  // ============================================

  describe("재연결", () => {
    it("에러 상태의 서버를 재연결할 수 있어야 함", async () => {
      mockGetTools
        .mockRejectedValueOnce(new Error("First try failed"))
        .mockResolvedValueOnce([{ name: "tool", description: "Tool" }]);

      const serverId = mcpConfigStore.addServer({
        name: "Retry Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      // 첫 번째 시도 - 실패
      await manager.connect(serverId);
      expect(mcpConfigStore.getServerStatus(serverId)).toBe("error");

      // 재연결 시도 - 성공
      await manager.reconnect(serverId);
      expect(mcpConfigStore.getServerStatus(serverId)).toBe("connected");
    });

    it("이미 연결된 서버 재연결 시 연결을 끊고 다시 연결해야 함", async () => {
      const serverId = mcpConfigStore.addServer({
        name: "Connected Server",
        type: "stdio",
        command: "node",
        enabled: true,
      });

      await manager.connect(serverId);
      expect(manager.isConnected(serverId)).toBe(true);

      await manager.reconnect(serverId);
      expect(manager.isConnected(serverId)).toBe(true);

      // close가 호출되었는지 확인
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
