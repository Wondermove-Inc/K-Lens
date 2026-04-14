/**
 * 🎯 목적: MCP Server Config 타입 정의
 * 01: MCPServerConfig 타입 정의
 *
 * 📝 주요 타입:
 * - MCPServerConfig: MCP 서버 설정
 * - MCPServerStatus: 서버 연결 상태
 * - MCPValidationResult: 검증 결과
 *
 * @packageDocumentation
 */

// ============================================
// 🎯 서버 상태 타입
// ============================================

/**
 * MCP 서버 연결 상태
 */
export type MCPServerStatus = "disconnected" | "connecting" | "connected" | "error";

// ============================================
// 🎯 서버 설정 타입
// ============================================

/**
 * MCP 서버 기본 설정
 */
interface MCPServerConfigBase {
  /** 고유 식별자 */
  id: string;
  /** 서버 표시 이름 */
  name: string;
  /** 서버 활성화 여부 */
  enabled: boolean;
}

/**
 * stdio 타입 MCP 서버 설정
 */
export interface MCPServerConfigStdio extends MCPServerConfigBase {
  type: "stdio";
  /** 실행할 명령어 */
  command: string;
  /** 명령어 인자 */
  args?: string[];
  /** 환경변수 */
  env?: Record<string, string>;
}

/**
 * HTTP 타입 MCP 서버 설정
 */
export interface MCPServerConfigHttp extends MCPServerConfigBase {
  type: "http";
  /** 서버 URL */
  url: string;
  /** HTTP 헤더 */
  headers?: Record<string, string>;
}

/**
 * MCP 서버 설정 (stdio 또는 http)
 */
export type MCPServerConfig = MCPServerConfigStdio | MCPServerConfigHttp;

/**
 * 서버 생성 시 ID 제외한 설정
 */
export type MCPServerConfigInput = Omit<MCPServerConfig, "id">;

// ============================================
// 🎯 검증 결과 타입
// ============================================

/**
 * 설정 검증 결과
 */
export interface MCPValidationResult {
  /** 유효성 여부 */
  valid: boolean;
  /** 에러 메시지 목록 */
  errors: string[];
}

// ============================================
// 🎯 스토어 인터페이스
// ============================================

/**
 * MCP Config Store 인터페이스
 */
export interface IMCPConfigStore {
  /** 모든 서버 목록 */
  readonly servers: MCPServerConfig[];
  /** 서버별 상태 맵 */
  readonly serverStatuses: Map<string, MCPServerStatus>;
  /** 활성화된 서버 목록 */
  readonly enabledServers: MCPServerConfig[];
  /** 연결된 서버 목록 */
  readonly connectedServers: MCPServerConfig[];
  /** 연결된 서버 존재 여부 */
  readonly hasConnectedServers: boolean;

  /** 서버 추가 */
  addServer(config: MCPServerConfigInput): string;
  /** 서버 업데이트 */
  updateServer(id: string, updates: Partial<MCPServerConfigInput>): void;
  /** 서버 삭제 */
  removeServer(id: string): void;
  /** ID로 서버 조회 */
  getServer(id: string): MCPServerConfig | undefined;
  /** 서버 상태 조회 */
  getServerStatus(id: string): MCPServerStatus;
  /** 서버 상태 설정 */
  setServerStatus(id: string, status: MCPServerStatus, errorMessage?: string): void;
  /** 서버 에러 메시지 조회 */
  getServerError(id: string): string | undefined;
  /** 스토어 초기화 */
  reset(): void;
  /** localStorage에서 로드 */
  loadFromStorage(): void;
}
