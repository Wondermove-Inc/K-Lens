/**
 * 🎯 목적: MCP Server Config Store 구현
 * 01: MCPServerConfig 타입 및 저장 로직
 *
 * 📝 주요 기능:
 * - MCP 서버 설정 CRUD
 * - 서버 연결 상태 관리
 * - localStorage 영속화
 * - MobX 반응형 상태
 *
 * @packageDocumentation
 */

import { makeAutoObservable, runInAction } from "mobx";
import {
  IMCPConfigStore,
  MCPServerConfig,
  MCPServerConfigInput,
  MCPServerStatus,
  MCPValidationResult,
} from "./mcp-config-types";

// 타입 재export
export type {
  MCPServerConfig,
  MCPServerConfigHttp,
  MCPServerConfigInput,
  MCPServerConfigStdio,
  MCPServerStatus,
  MCPValidationResult,
} from "./mcp-config-types";

// ============================================
// 🎯 상수
// ============================================

/** localStorage 저장 키 */
const STORAGE_KEY = "mcp-server-configs";

// ============================================
// 🎯 팩토리 함수
// ============================================

/**
 * 고유 ID 생성
 *
 * @returns mcp- 접두사가 붙은 고유 ID
 */
function generateId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * MCP 서버 설정 생성
 *
 * @param input - ID를 제외한 서버 설정
 * @returns 고유 ID가 포함된 완전한 서버 설정
 */
export function createMCPServerConfig(input: MCPServerConfigInput): MCPServerConfig {
  return {
    ...input,
    id: generateId(),
  } as MCPServerConfig;
}

// ============================================
// 🎯 검증 함수
// ============================================

/**
 * MCP 서버 설정 검증
 *
 * @param config - 검증할 서버 설정 (ID 제외 가능)
 * @returns 검증 결과 (valid, errors)
 */
export function validateMCPServerConfig(config: Partial<MCPServerConfigInput>): MCPValidationResult {
  const errors: string[] = [];

  // 공통 검증
  if (!config.name || config.name.trim() === "") {
    errors.push("서버 이름은 필수입니다");
  }

  if (config.type !== "stdio" && config.type !== "http") {
    errors.push("서버 타입은 'stdio' 또는 'http'여야 합니다");
  }

  // stdio 타입 검증
  if (config.type === "stdio") {
    // 타입 가드: stdio 타입일 때 command 속성 접근
    const stdioConfig = config as Partial<{ type: "stdio"; command: string }>;
    if (!stdioConfig.command || stdioConfig.command.trim() === "") {
      errors.push("stdio 서버는 command가 필수입니다");
    }
  }

  // http 타입 검증
  if (config.type === "http") {
    // 타입 가드: http 타입일 때 url 속성 접근
    const httpConfig = config as Partial<{ type: "http"; url: string }>;
    if (!httpConfig.url || httpConfig.url.trim() === "") {
      errors.push("http 서버는 url이 필수입니다");
    } else if (httpConfig.url) {
      try {
        new URL(httpConfig.url);
      } catch {
        errors.push("유효한 URL 형식이 아닙니다");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// 🎯 MCPConfigStore 구현
// ============================================

/**
 * MCP 서버 설정 스토어
 *
 * MobX를 사용한 반응형 상태 관리
 * localStorage를 통한 영속화 지원
 */
class MCPConfigStore implements IMCPConfigStore {
  /** 서버 설정 목록 */
  private _servers: MCPServerConfig[] = [];

  /** 서버별 연결 상태 */
  private _serverStatuses: Map<string, MCPServerStatus> = new Map();

  /** 서버별 에러 메시지 */
  private _serverErrors: Map<string, string> = new Map();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
    // 🆕 스토어 생성 시 자동으로 localStorage에서 설정 로드
    this.loadFromStorage();
  }

  // ============================================
  // Getters (computed)
  // ============================================

  /** 모든 서버 목록 */
  get servers(): MCPServerConfig[] {
    return this._servers;
  }

  /** 서버별 상태 맵 */
  get serverStatuses(): Map<string, MCPServerStatus> {
    return this._serverStatuses;
  }

  /** 활성화된 서버 목록 */
  get enabledServers(): MCPServerConfig[] {
    return this._servers.filter((s) => s.enabled);
  }

  /** 연결된 서버 목록 */
  get connectedServers(): MCPServerConfig[] {
    return this._servers.filter((s) => this._serverStatuses.get(s.id) === "connected");
  }

  /** 연결된 서버 존재 여부 */
  get hasConnectedServers(): boolean {
    return this.connectedServers.length > 0;
  }

  // ============================================
  // Actions
  // ============================================

  /**
   * 새 서버 추가
   *
   * @param config - 서버 설정 (ID 제외)
   * @returns 생성된 서버 ID
   */
  addServer(config: MCPServerConfigInput): string {
    const newServer = createMCPServerConfig(config);
    runInAction(() => {
      this._servers.push(newServer);
      this._serverStatuses.set(newServer.id, "disconnected");
    });
    this.saveToStorage();
    return newServer.id;
  }

  /**
   * 서버 설정 업데이트
   *
   * @param id - 서버 ID
   * @param updates - 업데이트할 필드
   * @throws 서버를 찾을 수 없는 경우
   */
  updateServer(id: string, updates: Partial<MCPServerConfigInput>): void {
    const index = this._servers.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`서버를 찾을 수 없습니다: ${id}`);
    }

    runInAction(() => {
      this._servers[index] = {
        ...this._servers[index],
        ...updates,
      } as MCPServerConfig;
    });
    this.saveToStorage();
  }

  /**
   * 서버 삭제
   *
   * @param id - 삭제할 서버 ID
   */
  removeServer(id: string): void {
    runInAction(() => {
      this._servers = this._servers.filter((s) => s.id !== id);
      this._serverStatuses.delete(id);
      this._serverErrors.delete(id);
    });
    this.saveToStorage();
  }

  /**
   * ID로 서버 조회
   *
   * @param id - 서버 ID
   * @returns 서버 설정 또는 undefined
   */
  getServer(id: string): MCPServerConfig | undefined {
    return this._servers.find((s) => s.id === id);
  }

  /**
   * 서버 상태 조회
   *
   * @param id - 서버 ID
   * @returns 연결 상태 (기본값: disconnected)
   */
  getServerStatus(id: string): MCPServerStatus {
    return this._serverStatuses.get(id) ?? "disconnected";
  }

  /**
   * 서버 상태 설정
   *
   * @param id - 서버 ID
   * @param status - 새 상태
   * @param errorMessage - 에러 상태 시 메시지
   */
  setServerStatus(id: string, status: MCPServerStatus, errorMessage?: string): void {
    runInAction(() => {
      this._serverStatuses.set(id, status);
      if (status === "error" && errorMessage) {
        this._serverErrors.set(id, errorMessage);
      } else if (status !== "error") {
        this._serverErrors.delete(id);
      }
    });
  }

  /**
   * 서버 에러 메시지 조회
   *
   * @param id - 서버 ID
   * @returns 에러 메시지 또는 undefined
   */
  getServerError(id: string): string | undefined {
    return this._serverErrors.get(id);
  }

  /**
   * 스토어 초기화
   */
  reset(): void {
    runInAction(() => {
      this._servers = [];
      this._serverStatuses.clear();
      this._serverErrors.clear();
    });
  }

  // ============================================
  // 영속화
  // ============================================

  /**
   * localStorage에 저장
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._servers));
    } catch (error) {
      console.error("MCP 설정 저장 실패:", error);
    }
  }

  /**
   * localStorage에서 로드
   */
  loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          runInAction(() => {
            this._servers = parsed;
            // 로드된 서버들의 상태를 disconnected로 초기화
            for (const server of parsed) {
              this._serverStatuses.set(server.id, "disconnected");
            }
          });
        }
      }
    } catch (error) {
      console.error("MCP 설정 로드 실패:", error);
      runInAction(() => {
        this._servers = [];
      });
    }
  }
}

// ============================================
// 🎯 싱글톤 인스턴스
// ============================================

/** MCP 설정 스토어 싱글톤 */
export const mcpConfigStore = new MCPConfigStore();

// 기본 export
export { MCPConfigStore };
