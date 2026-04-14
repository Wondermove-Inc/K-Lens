/**
 * 🎯 목적: MCP Server Config 테스트
 * 01: MCPServerConfig 타입 및 저장 로직 (TDD)
 *
 * 📝 테스트 범위:
 * - MCPServerConfig 타입 정의
 * - MCPConfigStore CRUD 작업
 * - 서버 상태 관리
 * - 영속화 (localStorage)
 *
 * @packageDocumentation
 */

import {
  createMCPServerConfig,
  MCPConfigStore,
  MCPServerConfig,
  MCPServerStatus,
  mcpConfigStore,
  validateMCPServerConfig,
} from "../mcp-config";

// ============================================
// 🎯 테스트 유틸리티
// ============================================

/** 테스트용 stdio 서버 설정 생성 */
function createStdioServer(overrides: Partial<MCPServerConfig> = {}): Omit<MCPServerConfig, "id"> {
  return {
    name: "Test Server",
    type: "stdio",
    command: "node",
    args: ["server.js"],
    enabled: true,
    ...overrides,
  };
}

/** 테스트용 HTTP 서버 설정 생성 */
function createHttpServer(overrides: Partial<MCPServerConfig> = {}): Omit<MCPServerConfig, "id"> {
  return {
    name: "HTTP Server",
    type: "http",
    url: "http://localhost:3000",
    enabled: true,
    ...overrides,
  };
}

// ============================================
// 🎯 타입 정의 테스트
// ============================================

describe("MCPServerConfig 타입", () => {
  describe("stdio 타입 서버", () => {
    it("command와 args를 포함해야 함", () => {
      const config: MCPServerConfig = {
        id: "server-1",
        name: "Stdio Server",
        type: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        enabled: true,
      };

      expect(config.type).toBe("stdio");
      expect(config.command).toBe("npx");
      expect(config.args).toEqual(["-y", "@modelcontextprotocol/server-filesystem"]);
    });

    it("env 환경변수를 선택적으로 포함할 수 있음", () => {
      const config: MCPServerConfig = {
        id: "server-2",
        name: "Server with Env",
        type: "stdio",
        command: "node",
        args: ["server.js"],
        env: { API_KEY: "test-key" },
        enabled: true,
      };

      expect(config.env).toEqual({ API_KEY: "test-key" });
    });
  });

  describe("http 타입 서버", () => {
    it("url을 포함해야 함", () => {
      const config: MCPServerConfig = {
        id: "server-3",
        name: "HTTP Server",
        type: "http",
        url: "http://localhost:8080/mcp",
        enabled: true,
      };

      expect(config.type).toBe("http");
      expect(config.url).toBe("http://localhost:8080/mcp");
    });

    it("headers를 선택적으로 포함할 수 있음", () => {
      const config: MCPServerConfig = {
        id: "server-4",
        name: "HTTP with Headers",
        type: "http",
        url: "https://api.example.com/mcp",
        headers: { Authorization: "Bearer token" },
        enabled: true,
      };

      expect(config.headers).toEqual({ Authorization: "Bearer token" });
    });
  });
});

describe("MCPServerStatus 타입", () => {
  it("연결 상태를 표현해야 함", () => {
    const statuses: MCPServerStatus[] = ["disconnected", "connecting", "connected", "error"];
    expect(statuses).toHaveLength(4);
  });
});

// ============================================
// 🎯 팩토리 함수 테스트
// ============================================

describe("createMCPServerConfig", () => {
  it("stdio 서버 설정을 생성해야 함", () => {
    const config = createMCPServerConfig({
      name: "Filesystem Server",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      enabled: true,
    });

    expect(config.id).toBeDefined();
    expect(config.id).toMatch(/^mcp-/);
    expect(config.name).toBe("Filesystem Server");
    expect(config.type).toBe("stdio");
  });

  it("http 서버 설정을 생성해야 함", () => {
    const config = createMCPServerConfig({
      name: "Remote Server",
      type: "http",
      url: "https://mcp.example.com",
      enabled: true,
    });

    expect(config.id).toBeDefined();
    expect(config.type).toBe("http");
    expect(config.url).toBe("https://mcp.example.com");
  });

  it("고유한 ID를 생성해야 함", () => {
    const config1 = createMCPServerConfig(createStdioServer());
    const config2 = createMCPServerConfig(createStdioServer());

    expect(config1.id).not.toBe(config2.id);
  });
});

// ============================================
// 🎯 검증 함수 테스트
// ============================================

describe("validateMCPServerConfig", () => {
  describe("공통 검증", () => {
    it("name이 비어있으면 실패해야 함", () => {
      const result = validateMCPServerConfig({
        ...createStdioServer(),
        name: "",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("서버 이름은 필수입니다");
    });

    it("유효하지 않은 type이면 실패해야 함", () => {
      const result = validateMCPServerConfig({
        ...createStdioServer(),
        type: "invalid" as "stdio",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("서버 타입은 'stdio' 또는 'http'여야 합니다");
    });
  });

  describe("stdio 서버 검증", () => {
    it("command가 없으면 실패해야 함", () => {
      const result = validateMCPServerConfig({
        name: "Test",
        type: "stdio",
        enabled: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("stdio 서버는 command가 필수입니다");
    });

    it("유효한 stdio 설정이면 성공해야 함", () => {
      const result = validateMCPServerConfig(createStdioServer());

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("http 서버 검증", () => {
    it("url이 없으면 실패해야 함", () => {
      const result = validateMCPServerConfig({
        name: "Test",
        type: "http",
        enabled: true,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("http 서버는 url이 필수입니다");
    });

    it("유효하지 않은 URL 형식이면 실패해야 함", () => {
      const result = validateMCPServerConfig({
        ...createHttpServer(),
        url: "not-a-url",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("유효한 URL 형식이 아닙니다");
    });

    it("유효한 http 설정이면 성공해야 함", () => {
      const result = validateMCPServerConfig(createHttpServer());

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

// ============================================
// 🎯 MCPConfigStore 테스트
// ============================================

describe("MCPConfigStore", () => {
  beforeEach(() => {
    // 각 테스트 전에 스토어 초기화
    mcpConfigStore.reset();
    localStorage.clear();
  });

  describe("초기 상태", () => {
    it("빈 서버 목록으로 시작해야 함", () => {
      expect(mcpConfigStore.servers).toHaveLength(0);
    });

    it("서버 상태 맵이 비어있어야 함", () => {
      expect(mcpConfigStore.serverStatuses.size).toBe(0);
    });
  });

  describe("addServer", () => {
    it("새 서버를 추가하고 ID를 반환해야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer());

      expect(id).toBeDefined();
      expect(mcpConfigStore.servers).toHaveLength(1);
      expect(mcpConfigStore.servers[0].id).toBe(id);
    });

    it("추가된 서버는 disconnected 상태여야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer());

      expect(mcpConfigStore.getServerStatus(id)).toBe("disconnected");
    });

    it("여러 서버를 추가할 수 있어야 함", () => {
      mcpConfigStore.addServer(createStdioServer({ name: "Server 1" }));
      mcpConfigStore.addServer(createStdioServer({ name: "Server 2" }));
      mcpConfigStore.addServer(createHttpServer({ name: "Server 3" }));

      expect(mcpConfigStore.servers).toHaveLength(3);
    });
  });

  describe("updateServer", () => {
    it("기존 서버 설정을 업데이트해야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer({ name: "Original" }));

      mcpConfigStore.updateServer(id, { name: "Updated" });

      expect(mcpConfigStore.getServer(id)?.name).toBe("Updated");
    });

    it("부분 업데이트가 가능해야 함", () => {
      const id = mcpConfigStore.addServer(
        createStdioServer({
          name: "Server",
          command: "node",
          args: ["old.js"],
        }),
      );

      mcpConfigStore.updateServer(id, { args: ["new.js"] });

      const server = mcpConfigStore.getServer(id);
      expect(server?.name).toBe("Server");
      expect(server?.command).toBe("node");
      expect(server?.args).toEqual(["new.js"]);
    });

    it("존재하지 않는 서버 업데이트 시 에러를 던져야 함", () => {
      expect(() => {
        mcpConfigStore.updateServer("non-existent", { name: "Test" });
      }).toThrow("서버를 찾을 수 없습니다: non-existent");
    });
  });

  describe("removeServer", () => {
    it("서버를 삭제해야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer());

      mcpConfigStore.removeServer(id);

      expect(mcpConfigStore.servers).toHaveLength(0);
      expect(mcpConfigStore.getServer(id)).toBeUndefined();
    });

    it("삭제된 서버의 상태도 제거해야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer());
      mcpConfigStore.setServerStatus(id, "connected");

      mcpConfigStore.removeServer(id);

      expect(mcpConfigStore.serverStatuses.has(id)).toBe(false);
    });
  });

  describe("getServer", () => {
    it("ID로 서버를 조회해야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer({ name: "FindMe" }));

      const server = mcpConfigStore.getServer(id);

      expect(server?.name).toBe("FindMe");
    });

    it("존재하지 않는 ID는 undefined를 반환해야 함", () => {
      const server = mcpConfigStore.getServer("non-existent");

      expect(server).toBeUndefined();
    });
  });

  describe("서버 상태 관리", () => {
    it("setServerStatus로 상태를 변경해야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer());

      mcpConfigStore.setServerStatus(id, "connecting");
      expect(mcpConfigStore.getServerStatus(id)).toBe("connecting");

      mcpConfigStore.setServerStatus(id, "connected");
      expect(mcpConfigStore.getServerStatus(id)).toBe("connected");
    });

    it("에러 상태에 메시지를 포함할 수 있어야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer());

      mcpConfigStore.setServerStatus(id, "error", "Connection timeout");

      expect(mcpConfigStore.getServerStatus(id)).toBe("error");
      expect(mcpConfigStore.getServerError(id)).toBe("Connection timeout");
    });
  });

  describe("enabledServers computed", () => {
    it("enabled가 true인 서버만 반환해야 함", () => {
      mcpConfigStore.addServer(createStdioServer({ name: "Enabled", enabled: true }));
      mcpConfigStore.addServer(createStdioServer({ name: "Disabled", enabled: false }));

      expect(mcpConfigStore.enabledServers).toHaveLength(1);
      expect(mcpConfigStore.enabledServers[0].name).toBe("Enabled");
    });
  });

  describe("connectedServers computed", () => {
    it("connected 상태인 서버만 반환해야 함", () => {
      const id1 = mcpConfigStore.addServer(createStdioServer({ name: "Connected" }));
      const id2 = mcpConfigStore.addServer(createStdioServer({ name: "Disconnected" }));

      mcpConfigStore.setServerStatus(id1, "connected");
      mcpConfigStore.setServerStatus(id2, "disconnected");

      expect(mcpConfigStore.connectedServers).toHaveLength(1);
      expect(mcpConfigStore.connectedServers[0].name).toBe("Connected");
    });
  });

  describe("hasConnectedServers computed", () => {
    it("연결된 서버가 없으면 false를 반환해야 함", () => {
      mcpConfigStore.addServer(createStdioServer());

      expect(mcpConfigStore.hasConnectedServers).toBe(false);
    });

    it("연결된 서버가 있으면 true를 반환해야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer());
      mcpConfigStore.setServerStatus(id, "connected");

      expect(mcpConfigStore.hasConnectedServers).toBe(true);
    });
  });
});

// ============================================
// 🎯 영속화 테스트
// ============================================

describe("MCPConfigStore 영속화", () => {
  const STORAGE_KEY = "mcp-server-configs";

  beforeEach(() => {
    mcpConfigStore.reset();
    localStorage.clear();
  });

  describe("저장", () => {
    it("서버 추가 시 localStorage에 저장해야 함", () => {
      mcpConfigStore.addServer(createStdioServer({ name: "Saved Server" }));

      const saved = localStorage.getItem(STORAGE_KEY);
      expect(saved).not.toBeNull();

      const parsed = JSON.parse(saved!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("Saved Server");
    });

    it("서버 업데이트 시 localStorage에 반영해야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer({ name: "Original" }));
      mcpConfigStore.updateServer(id, { name: "Updated" });

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(saved[0].name).toBe("Updated");
    });

    it("서버 삭제 시 localStorage에서 제거해야 함", () => {
      const id = mcpConfigStore.addServer(createStdioServer());
      mcpConfigStore.removeServer(id);

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(saved).toHaveLength(0);
    });
  });

  describe("로드", () => {
    it("loadFromStorage로 저장된 설정을 복원해야 함", () => {
      const configs: MCPServerConfig[] = [
        { id: "mcp-1", name: "Server 1", type: "stdio", command: "node", args: [], enabled: true },
        { id: "mcp-2", name: "Server 2", type: "http", url: "http://localhost", enabled: false },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));

      mcpConfigStore.loadFromStorage();

      expect(mcpConfigStore.servers).toHaveLength(2);
      expect(mcpConfigStore.servers[0].name).toBe("Server 1");
      expect(mcpConfigStore.servers[1].name).toBe("Server 2");
    });

    it("잘못된 JSON은 무시하고 빈 배열로 시작해야 함", () => {
      localStorage.setItem(STORAGE_KEY, "invalid json");

      mcpConfigStore.loadFromStorage();

      expect(mcpConfigStore.servers).toHaveLength(0);
    });

    it("localStorage가 비어있으면 빈 배열로 시작해야 함", () => {
      mcpConfigStore.loadFromStorage();

      expect(mcpConfigStore.servers).toHaveLength(0);
    });
  });
});

// ============================================
// 🎯 MobX 반응성 테스트
// ============================================

describe("MCPConfigStore MobX 반응성", () => {
  beforeEach(() => {
    mcpConfigStore.reset();
  });

  it("서버 추가 시 servers 배열이 업데이트되어야 함", () => {
    const initialLength = mcpConfigStore.servers.length;

    mcpConfigStore.addServer(createStdioServer());

    expect(mcpConfigStore.servers.length).toBe(initialLength + 1);
  });

  it("computed 속성이 자동으로 업데이트되어야 함", () => {
    const id = mcpConfigStore.addServer(createStdioServer({ enabled: true }));

    expect(mcpConfigStore.enabledServers).toHaveLength(1);

    mcpConfigStore.updateServer(id, { enabled: false });

    expect(mcpConfigStore.enabledServers).toHaveLength(0);
  });
});
