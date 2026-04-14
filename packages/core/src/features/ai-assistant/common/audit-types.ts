/**
 * 🎯 목적: AI Assistant 감사 로깅 시스템 타입 정의
 * 01: AuditLogger 구현
 *
 * 📝 주의사항:
 * - 모든 AI 작업에 대한 감사 로그를 기록하기 위한 타입 정의
 * - 민감 정보 마스킹을 위한 유틸리티 타입 포함
 * - FIFO 방식으로 최대 1000개 로그 유지
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (01)
 * - 2026-01-05: 파일 분할 (SensitivePattern → audit-sensitive-patterns.ts)
 * - 2026-01-05: 파일 분할 (타입 가드 → audit-type-guards.ts)
 *
 * @packageDocumentation
 */

// ============================================
// 🎯 재내보내기 - 민감 정보 패턴
// ============================================

export {
  CLOUD_SERVICE_PATTERNS,
  DATABASE_CONNECTION_PATTERNS,
  DEFAULT_SENSITIVE_PATTERNS,
  getAllSensitivePatterns,
  KUBERNETES_SECRET_PATTERNS,
  mergePatterns,
  type SensitivePattern,
} from "./audit-sensitive-patterns";

// ============================================
// 🎯 재내보내기 - 타입 가드
// ============================================

export {
  generateLogId,
  isAuditAction,
  isAuditLogEntry,
  isAuditResult,
  isAuditSeverity,
  type LogIdGenerator,
  VALID_AUDIT_ACTIONS,
  VALID_AUDIT_RESULTS,
  VALID_AUDIT_SEVERITIES,
} from "./audit-type-guards";

// ============================================
// 🎯 감사 로그 액션 타입
// ============================================

/**
 * 감사 로그 액션 타입
 *
 * 📝 주의사항:
 * - tool_call: 도구 실행 (kubectl, helm 등)
 * - hitl_approve: Human-in-the-Loop 승인
 * - hitl_reject: Human-in-the-Loop 거부
 * - mcp_call: MCP 서버 호출
 * - session_start: 세션 시작
 * - session_end: 세션 종료
 * - error: 에러 발생
 */
export type AuditAction =
  | "tool_call"
  | "hitl_approve"
  | "hitl_reject"
  | "mcp_call"
  | "session_start"
  | "session_end"
  | "error";

/**
 * 감사 로그 결과 타입
 */
export type AuditResult = "success" | "error" | "pending" | "cancelled";

/**
 * 감사 로그 심각도 레벨
 *
 * 📝 주의사항:
 * - info: 일반 정보 (도구 실행, 세션 시작 등)
 * - warn: 경고 (거부, 취소 등)
 * - error: 에러 (실패한 작업)
 * - critical: 치명적 (보안 관련)
 */
export type AuditSeverity = "info" | "warn" | "error" | "critical";

// ============================================
// 🎯 감사 로그 엔트리 인터페이스
// ============================================

/**
 * 감사 로그 엔트리 인터페이스
 *
 * 🎯 목적: 개별 감사 로그 항목을 나타내는 인터페이스
 *
 * 📝 주의사항:
 * - timestamp: 로그 생성 시간 (ISO 8601 형식)
 * - action: 수행된 액션 타입
 * - toolName: 도구 이름 (optional, tool_call 시 필수)
 * - args: 도구 인자 (민감 정보 마스킹 필요)
 * - result: 실행 결과
 *
 * @example
 * ```typescript
 * const logEntry: AuditLogEntry = {
 *   id: 'log-001',
 *   timestamp: new Date().toISOString(),
 *   action: 'tool_call',
 *   toolName: 'kubectl',
 *   args: { command: 'get pods' },
 *   result: 'success',
 *   severity: 'info',
 * };
 * ```
 */
export interface AuditLogEntry {
  /** 로그 고유 ID */
  id: string;

  /** 로그 생성 시간 (ISO 8601 형식) */
  timestamp: string;

  /** 수행된 액션 타입 */
  action: AuditAction;

  /** 도구 이름 (tool_call, mcp_call 시 필수) */
  toolName?: string;

  /** 도구 인자 (민감 정보 마스킹 적용) */
  args?: Record<string, unknown>;

  /** 실행 결과 */
  result: AuditResult;

  /** 심각도 레벨 */
  severity: AuditSeverity;

  /** 에러 메시지 (에러 발생 시) */
  errorMessage?: string;

  /** 사용자 식별자 */
  user?: string;

  /** 세션 ID */
  sessionId?: string;

  /** 실행 시간 (밀리초) */
  durationMs?: number;

  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>;
}

/**
 * 새 감사 로그 생성을 위한 입력 타입
 *
 * 📝 주의사항:
 * - id, timestamp는 자동 생성되므로 제외
 * - result 기본값은 'pending'
 */
export type AuditLogInput = Omit<AuditLogEntry, "id" | "timestamp">;

// ============================================
// 🎯 AuditLogger 설정 인터페이스
// ============================================

// SensitivePattern은 재내보내기로 제공됨

/**
 * AuditLogger 설정 인터페이스
 *
 * 📝 주의사항:
 * - maxEntries: 최대 로그 개수 (기본값: 1000, FIFO)
 * - enablePersistence: IndexedDB 저장 활성화 여부
 * - sensitivePatterns: 커스텀 민감 정보 패턴
 */
export interface AuditLoggerConfig {
  /** 최대 로그 개수 (기본값: 1000) */
  maxEntries?: number;

  /** IndexedDB 저장 활성화 (기본값: false) */
  enablePersistence?: boolean;

  /** 데이터베이스 이름 (IndexedDB 사용 시) */
  dbName?: string;

  /** 커스텀 민감 정보 패턴 (기본 패턴에 추가) */
  sensitivePatterns?: import("./audit-sensitive-patterns").SensitivePattern[];

  /** 자동 마스킹 활성화 (기본값: true) */
  autoMasking?: boolean;
}

// ============================================
// 🎯 AuditLogger 인터페이스
// ============================================

/**
 * AuditLogger 인터페이스
 *
 * 🎯 목적: 감사 로거의 공개 API 정의
 *
 * 📝 주의사항:
 * - log: 새 로그 엔트리 기록
 * - getRecentLogs: 최근 N개 로그 조회
 * - maskSensitiveData: 민감 정보 마스킹
 * - clear: 모든 로그 삭제
 * - export: 로그 내보내기
 */
export interface IAuditLogger {
  /** 새 감사 로그 기록 */
  log(entry: AuditLogInput): AuditLogEntry;

  /** 도구 호출 로그 기록 (헬퍼 메서드) */
  logToolCall(toolName: string, args: Record<string, unknown>, result: AuditResult, durationMs?: number): AuditLogEntry;

  /** HITL 승인 로그 기록 */
  logHitlApprove(toolName: string, args: Record<string, unknown>): AuditLogEntry;

  /** HITL 거부 로그 기록 */
  logHitlReject(toolName: string, args: Record<string, unknown>, reason?: string): AuditLogEntry;

  /** 에러 로그 기록 */
  logError(error: Error | string, context?: Record<string, unknown>): AuditLogEntry;

  /** 최근 N개 로그 조회 */
  getRecentLogs(count: number): AuditLogEntry[];

  /** 액션별 로그 필터링 */
  getLogsByAction(action: AuditAction, count?: number): AuditLogEntry[];

  /** 세션별 로그 필터링 */
  getLogsBySession(sessionId: string): AuditLogEntry[];

  /** 민감 정보 마스킹 */
  maskSensitiveData<T>(data: T): T;

  /** 모든 로그 삭제 */
  clear(): void;

  /** 현재 로그 개수 조회 */
  getLogCount(): number;

  /** 로그 내보내기 (JSON 형식) */
  export(): string;

  /** 로그 가져오기 */
  import(jsonData: string): void;
}

// ============================================
// 🎯 기본 설정
// ============================================

/**
 * 감사 로그 기본 설정
 */
export const AUDIT_LOGGER_DEFAULTS: Required<AuditLoggerConfig> = {
  maxEntries: 1000,
  enablePersistence: false,
  dbName: "daive-audit-logs",
  sensitivePatterns: [],
  autoMasking: true,
};
