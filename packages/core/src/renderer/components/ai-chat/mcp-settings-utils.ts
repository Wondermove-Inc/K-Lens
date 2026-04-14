/**
 * 🎯 목적: MCP Settings 유틸리티 함수 및 타입
 * 01: MCPSettings 유틸리티
 *
 * 🔄 변경이력:
 * - 2026-01-07: 수정 - JSON 입력 모드, env 필드 지원 추가
 *
 * @packageDocumentation
 */

import { MCPServerStatus } from "../../../features/ai-assistant/common/mcp-config";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 서버 폼 데이터
 *
 * 📝 2026-01-07: 수정 - env 필드 추가
 */
export interface MCPServerFormData {
  name: string;
  type: "stdio" | "http";
  command: string;
  args: string;
  url: string;
  enabled: boolean;
  /** 🆕 환경 변수 (key=value 형태, 줄바꿈 구분) */
  env: string;
}

/**
 * 🆕 JSON 입력 파싱 결과
 */
export interface MCPJsonParseResult {
  success: boolean;
  servers: ParsedMCPServer[];
  error?: string;
}

/**
 * 🆕 파싱된 MCP 서버 정보
 */
export interface ParsedMCPServer {
  name: string;
  type: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

/**
 * 폼 에러
 */
export interface MCPFormErrors {
  name?: string;
  command?: string;
  url?: string;
}

// ============================================
// 🎯 상태 표시 함수
// ============================================

/**
 * 연결 상태 텍스트
 *
 * 📝 2026-01-07 수정:
 * - 한글 → 영어로 변경 (국제화 일관성)
 *
 * @param status - 서버 상태
 * @returns 영어 상태 텍스트
 */
export function getStatusText(status: MCPServerStatus): string {
  const texts: Record<MCPServerStatus, string> = {
    disconnected: "Disconnected",
    connecting: "Connecting...",
    connected: "Connected",
    error: "Error",
  };
  return texts[status];
}

/**
 * 연결 상태 색상 클래스
 * 🎯 THEME-024: CSS 변수 기반 색상으로 마이그레이션
 *
 * 📝 2026-01-07 수정:
 * - ShadCN 테마 변수 사용으로 다크 테마 호환성 개선
 * 📝 2026-01-31 THEME-024:
 * - Tailwind 하드코딩 → CSS 변수로 완전 마이그레이션
 *
 * @param status - 서버 상태
 * @returns CSS 클래스
 */
export function getStatusColorClass(status: MCPServerStatus): string {
  const colors: Record<MCPServerStatus, string> = {
    disconnected: "bg-muted text-muted-foreground",
    connecting: "bg-status-warning-muted text-status-warning",
    connected: "bg-status-success-muted text-status-success",
    error: "bg-destructive/20 text-destructive",
  };
  return colors[status];
}

/**
 * 연결 상태 아이콘
 *
 * @param status - 서버 상태
 * @returns 이모지 아이콘
 */
export function getStatusIcon(status: MCPServerStatus): string {
  const icons: Record<MCPServerStatus, string> = {
    disconnected: "⚪",
    connecting: "🟡",
    connected: "🟢",
    error: "🔴",
  };
  return icons[status];
}

// ============================================
// 🎯 폼 검증 함수
// ============================================

/**
 * 폼 데이터 검증
 *
 * @param data - 폼 데이터
 * @returns 에러 객체 (비어있으면 유효)
 */
export function validateFormData(data: MCPServerFormData): MCPFormErrors {
  const errors: MCPFormErrors = {};

  if (!data.name.trim()) {
    errors.name = "서버 이름은 필수입니다";
  }

  if (data.type === "stdio" && !data.command.trim()) {
    errors.command = "명령어는 필수입니다";
  }

  if (data.type === "http") {
    if (!data.url.trim()) {
      errors.url = "URL은 필수입니다";
    } else {
      try {
        new URL(data.url);
      } catch {
        errors.url = "유효한 URL 형식이 아닙니다";
      }
    }
  }

  return errors;
}

/**
 * 폼 에러가 있는지 확인
 *
 * @param errors - 에러 객체
 * @returns 에러 존재 여부
 */
export function hasErrors(errors: MCPFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ============================================
// 🎯 폼 초기값
// ============================================

/**
 * 빈 폼 데이터 생성
 *
 * @returns 초기 폼 데이터
 */
export function createEmptyFormData(): MCPServerFormData {
  return {
    name: "",
    type: "stdio",
    command: "",
    args: "",
    url: "",
    enabled: true,
    env: "",
  };
}

// ============================================
// 🎯 JSON 파싱 함수
// ============================================

/**
 * 🆕 MCP 서버 JSON 파싱
 *
 * Claude Desktop 형식의 JSON을 파싱하여 서버 목록 반환
 * 지원 형식:
 * - { "mcpServers": { "server-name": { command, args, env } } }
 * - { "server-name": { command, args, env } }
 *
 * @param jsonString - JSON 문자열
 * @returns 파싱 결과
 */
export function parseMCPServerJson(jsonString: string): MCPJsonParseResult {
  try {
    const parsed = JSON.parse(jsonString);
    const servers: ParsedMCPServer[] = [];

    // mcpServers 키가 있는 경우 (Claude Desktop 형식)
    const serversObj = parsed.mcpServers ?? parsed;

    if (typeof serversObj !== "object" || serversObj === null) {
      return { success: false, servers: [], error: "Invalid JSON structure" };
    }

    for (const [name, config] of Object.entries(serversObj)) {
      if (typeof config !== "object" || config === null) continue;

      const serverConfig = config as Record<string, unknown>;

      // stdio 타입 (command 필드 존재)
      if (serverConfig.command && typeof serverConfig.command === "string") {
        servers.push({
          name,
          type: "stdio",
          command: serverConfig.command,
          args: Array.isArray(serverConfig.args) ? serverConfig.args : undefined,
          env:
            typeof serverConfig.env === "object" && serverConfig.env !== null
              ? (serverConfig.env as Record<string, string>)
              : undefined,
        });
      }
      // http 타입 (url 필드 존재)
      else if (serverConfig.url && typeof serverConfig.url === "string") {
        servers.push({
          name,
          type: "http",
          url: serverConfig.url,
        });
      }
    }

    if (servers.length === 0) {
      return { success: false, servers: [], error: "No valid MCP servers found in JSON" };
    }

    return { success: true, servers };
  } catch (e) {
    return {
      success: false,
      servers: [],
      error: e instanceof Error ? e.message : "JSON parse error",
    };
  }
}

/**
 * 🆕 환경 변수 문자열 → Record 변환
 *
 * @param envString - "KEY=VALUE" 형태의 줄바꿈 구분 문자열
 * @returns 환경 변수 객체
 */
export function parseEnvString(envString: string): Record<string, string> | undefined {
  if (!envString.trim()) return undefined;

  const env: Record<string, string> = {};
  const lines = envString.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const eqIndex = line.indexOf("=");
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();
      if (key) env[key] = value;
    }
  }

  return Object.keys(env).length > 0 ? env : undefined;
}

/**
 * 🆕 환경 변수 Record → 문자열 변환
 *
 * @param env - 환경 변수 객체
 * @returns "KEY=VALUE" 형태의 줄바꿈 구분 문자열
 */
export function envToString(env?: Record<string, string>): string {
  if (!env) return "";
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}
