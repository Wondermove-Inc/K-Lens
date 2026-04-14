/**
 * 🎯 목적: MCP 서버 연결 관리자
 * 01: MCPAgentOrchestrator 연결 로직
 *
 * 📝 설명:
 * MCPConfigStore와 연동하여 MCP 서버 연결을 관리합니다.
 * - 서버 연결/해제
 * - 연결 상태 추적
 * - 도구 로딩 및 캐싱
 *
 * @packageDocumentation
 */

import { type Connection, MultiServerMCPClient } from "@langchain/mcp-adapters";
import {
  type MCPServerConfig,
  type MCPServerConfigHttp,
  type MCPServerConfigStdio,
  mcpConfigStore,
} from "../../common/mcp-config";

import type { Logger } from "@skuberplus/logger";

import type { StructuredToolInterface } from "@langchain/core/tools";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * MCPConnectionManager 의존성
 */
export interface MCPConnectionManagerDependencies {
  readonly logger: Logger;
}

/**
 * 연결된 서버 정보
 */
interface ConnectedServer {
  readonly client: MultiServerMCPClient;
  readonly tools: StructuredToolInterface[];
}

// ============================================
// 🎯 MCPConnectionManager 클래스
// ============================================

/**
 * MCP 서버 연결 관리자
 *
 * MCPConfigStore의 설정을 사용하여 MCP 서버들을 연결하고 관리합니다.
 */
export class MCPConnectionManager {
  /** 연결된 서버 맵 (serverId -> ConnectedServer) */
  private readonly connections = new Map<string, ConnectedServer>();

  constructor(private readonly dependencies: MCPConnectionManagerDependencies) {}

  // ============================================
  // 연결 관리
  // ============================================

  /**
   * 특정 서버에 연결
   *
   * @param serverId - 연결할 서버 ID
   * @throws 서버가 존재하지 않을 경우 에러
   */
  async connect(serverId: string): Promise<void> {
    const server = mcpConfigStore.getServer(serverId);

    if (!server) {
      throw new Error(`MCP 서버를 찾을 수 없습니다: ${serverId}`);
    }

    // 비활성화된 서버는 연결하지 않음
    if (!server.enabled) {
      this.dependencies.logger.debug("[MCP] 비활성화된 서버 연결 건너뜀", { name: server.name });
      return;
    }

    // 연결 시작
    mcpConfigStore.setServerStatus(serverId, "connecting");

    try {
      // MCP 클라이언트 생성
      const mcpServers = this.buildMcpServerConfig(server);
      const client = new MultiServerMCPClient({
        throwOnLoadError: true,
        prefixToolNameWithServerName: false,
        additionalToolNamePrefix: "",
        useStandardContentBlocks: true,
        mcpServers,
      });

      // 도구 로딩
      const tools = await client.getTools();

      this.dependencies.logger.info("[MCP] 서버 연결 성공", {
        name: server.name,
        toolCount: tools.length,
      });

      // 연결 저장
      this.connections.set(serverId, { client, tools });
      mcpConfigStore.setServerStatus(serverId, "connected");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.dependencies.logger.error("[MCP] 서버 연결 실패", {
        name: server.name,
        error: errorMessage,
      });

      mcpConfigStore.setServerStatus(serverId, "error", errorMessage);
    }
  }

  /**
   * 특정 서버 연결 해제
   *
   * @param serverId - 해제할 서버 ID
   */
  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);

    if (!connection) {
      // 연결되지 않은 서버는 조용히 무시
      return;
    }

    try {
      await connection.client.close();
      this.dependencies.logger.debug("[MCP] 서버 연결 해제", { serverId });
    } catch (error) {
      this.dependencies.logger.warn("[MCP] 서버 연결 해제 중 에러", { serverId, error });
    }

    this.connections.delete(serverId);
    mcpConfigStore.setServerStatus(serverId, "disconnected");
  }

  /**
   * 모든 서버 연결 해제
   */
  async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.connections.keys());

    await Promise.all(serverIds.map((id) => this.disconnect(id)));
  }

  /**
   * 모든 활성화된 서버에 연결
   */
  async connectAllEnabled(): Promise<void> {
    const enabledServers = mcpConfigStore.enabledServers;

    await Promise.all(enabledServers.map((server) => this.connect(server.id)));
  }

  /**
   * 서버 재연결
   *
   * @param serverId - 재연결할 서버 ID
   */
  async reconnect(serverId: string): Promise<void> {
    await this.disconnect(serverId);
    await this.connect(serverId);
  }

  // ============================================
  // 도구 관리
  // ============================================

  /**
   * 특정 서버의 도구 목록 반환
   *
   * @param serverId - 서버 ID
   * @returns 도구 배열 (연결되지 않은 경우 빈 배열)
   */
  getToolsForServer(serverId: string): StructuredToolInterface[] {
    const connection = this.connections.get(serverId);

    return connection?.tools ?? [];
  }

  /**
   * 모든 연결된 서버의 도구 목록 반환
   *
   * @returns 모든 도구 배열
   */
  getAllTools(): StructuredToolInterface[] {
    const allTools: StructuredToolInterface[] = [];

    for (const connection of this.connections.values()) {
      allTools.push(...connection.tools);
    }

    return allTools;
  }

  // ============================================
  // 상태 조회
  // ============================================

  /**
   * 서버 연결 여부 확인
   *
   * @param serverId - 서버 ID
   * @returns 연결 여부
   */
  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  /**
   * 연결된 서버 수
   */
  get connectedCount(): number {
    return this.connections.size;
  }

  /**
   * 연결된 서버 ID 목록
   *
   * @returns 서버 ID 배열
   */
  getConnectedServerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  // ============================================
  // 설정 생성
  // ============================================

  /**
   * 활성 서버 설정을 MCP JSON 형식으로 변환
   *
   * MCPAgentOrchestrator에서 사용할 수 있는 형식으로 변환합니다.
   *
   * @returns JSON 문자열
   */
  generateMcpConfiguration(): string {
    const enabledServers = mcpConfigStore.enabledServers;
    const mcpServers: Record<string, Connection> = {};

    for (const server of enabledServers) {
      mcpServers[server.name] = this.convertToConnection(server);
    }

    return JSON.stringify({ mcpServers });
  }

  // ============================================
  // 내부 헬퍼
  // ============================================

  /**
   * 서버 설정을 MCP 클라이언트용 객체로 변환
   */
  private buildMcpServerConfig(server: MCPServerConfig): Record<string, Connection> {
    return {
      [server.name]: this.convertToConnection(server),
    };
  }

  /**
   * MCPServerConfig를 Connection 타입으로 변환
   */
  private convertToConnection(server: MCPServerConfig): Connection {
    if (server.type === "stdio") {
      const stdioServer = server as MCPServerConfigStdio;

      return {
        type: "stdio",
        command: stdioServer.command,
        args: stdioServer.args,
        env: stdioServer.env,
      } as Connection;
    }

    // HTTP 서버
    const httpServer = server as MCPServerConfigHttp;

    return {
      type: "http",
      url: httpServer.url,
      headers: httpServer.headers,
    } as Connection;
  }
}
