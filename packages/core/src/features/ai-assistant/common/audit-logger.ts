/**
 * 🎯 목적: AI Assistant 감사 로깅 시스템 구현
 * 01: AuditLogger 구현
 *
 * 📝 주의사항:
 * - 모든 AI 작업에 대한 감사 로그를 기록
 * - FIFO 방식으로 최대 1000개 로그 유지
 * - 민감 정보 자동 마스킹, 싱글톤 패턴 지원
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성, 마스킹 유틸리티 분리
 *
 * @packageDocumentation
 */

import { SensitiveDataMasker } from "./audit-masking";
import {
  AUDIT_LOGGER_DEFAULTS,
  type AuditAction,
  type AuditLogEntry,
  type AuditLoggerConfig,
  type AuditLogInput,
  type AuditResult,
  type AuditSeverity,
  DEFAULT_SENSITIVE_PATTERNS,
  generateLogId,
  type IAuditLogger,
  isAuditLogEntry,
  type SensitivePattern,
} from "./audit-types";

// ============================================
// 🎯 AuditLogger 클래스
// ============================================

/**
 * AI Assistant 감사 로거 클래스
 * @example
 * ```typescript
 * const logger = new AuditLogger({ maxEntries: 500 });
 * logger.logToolCall('kubectl', { command: 'get pods' }, 'success');
 * ```
 */
export class AuditLogger implements IAuditLogger {
  private static instance: AuditLogger | null = null;
  private logs: AuditLogEntry[] = [];
  private readonly config: Required<AuditLoggerConfig>;
  private readonly masker: SensitiveDataMasker;

  constructor(config: AuditLoggerConfig = {}) {
    this.config = { ...AUDIT_LOGGER_DEFAULTS, ...config };
    const patterns: SensitivePattern[] = [...DEFAULT_SENSITIVE_PATTERNS, ...this.config.sensitivePatterns];
    this.masker = new SensitiveDataMasker(patterns);
  }

  // ============================================
  // 🎯 싱글톤 메서드
  // ============================================

  /** 싱글톤 인스턴스 반환 (최초 호출 시 config 적용) */
  static getInstance(config?: AuditLoggerConfig): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger(config);
    }
    return AuditLogger.instance;
  }

  /** 싱글톤 인스턴스 리셋 (테스트용) */
  static resetInstance(): void {
    AuditLogger.instance = null;
  }

  // ============================================
  // 🎯 핵심 로깅 메서드
  // ============================================

  /** 새 감사 로그 기록 */
  log(input: AuditLogInput): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: generateLogId(),
      timestamp: new Date().toISOString(),
      ...input,
    };

    if (this.config.autoMasking && entry.args) {
      entry.args = this.masker.mask(entry.args) as Record<string, unknown>;
    }

    this.logs.push(entry);
    this.enforceMaxEntries();
    return entry;
  }

  /** 도구 호출 로그 기록 */
  logToolCall(
    toolName: string,
    args: Record<string, unknown>,
    result: AuditResult,
    durationMs?: number,
  ): AuditLogEntry {
    const severity: AuditSeverity = result === "error" ? "error" : "info";
    return this.log({ action: "tool_call", toolName, args, result, severity, durationMs });
  }

  /** HITL 승인 로그 기록 */
  logHitlApprove(toolName: string, args: Record<string, unknown>): AuditLogEntry {
    return this.log({
      action: "hitl_approve",
      toolName,
      args,
      result: "success",
      severity: "info",
    });
  }

  /** HITL 거부 로그 기록 */
  logHitlReject(toolName: string, args: Record<string, unknown>, reason?: string): AuditLogEntry {
    return this.log({
      action: "hitl_reject",
      toolName,
      args,
      result: "cancelled",
      severity: "warn",
      metadata: reason ? { reason } : undefined,
    });
  }

  /** 에러 로그 기록 */
  logError(error: Error | string, context?: Record<string, unknown>): AuditLogEntry {
    const errorMessage = error instanceof Error ? error.message : error;
    return this.log({
      action: "error",
      result: "error",
      severity: "error",
      errorMessage,
      metadata: context,
    });
  }

  // ============================================
  // 🎯 로그 조회 메서드
  // ============================================

  /** 최근 N개 로그 조회 (최신순) */
  getRecentLogs(count: number): AuditLogEntry[] {
    if (count <= 0) return [];
    return [...this.logs].reverse().slice(0, Math.min(count, this.logs.length));
  }

  /** 액션별 로그 필터링 */
  getLogsByAction(action: AuditAction, count?: number): AuditLogEntry[] {
    const filtered = this.logs.filter((log) => log.action === action);
    const reversed = [...filtered].reverse();
    if (count !== undefined && count > 0) {
      return reversed.slice(0, count);
    }
    return reversed;
  }

  /** 세션별 로그 필터링 */
  getLogsBySession(sessionId: string): AuditLogEntry[] {
    return this.logs.filter((log) => log.sessionId === sessionId);
  }

  /** 현재 로그 개수 조회 */
  getLogCount(): number {
    return this.logs.length;
  }

  // ============================================
  // 🎯 민감 정보 마스킹
  // ============================================

  /** 민감 정보 마스킹 */
  maskSensitiveData<T>(data: T): T {
    return this.masker.mask(data);
  }

  // ============================================
  // 🎯 관리 메서드
  // ============================================

  /** 모든 로그 삭제 */
  clear(): void {
    this.logs = [];
  }

  /** 로그 내보내기 (JSON 형식) */
  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /** 로그 가져오기 */
  import(jsonData: string): void {
    const parsed = JSON.parse(jsonData);
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid audit log data: expected array");
    }
    const validEntries = parsed.filter((item) => isAuditLogEntry(item));
    this.logs = validEntries;
    this.enforceMaxEntries();
  }

  // ============================================
  // 🎯 내부 유틸리티
  // ============================================

  /** 최대 로그 개수 강제 (FIFO) */
  private enforceMaxEntries(): void {
    if (this.logs.length > this.config.maxEntries) {
      const excess = this.logs.length - this.config.maxEntries;
      this.logs = this.logs.slice(excess);
    }
  }
}

// ============================================
// 🎯 기본 인스턴스 내보내기
// ============================================

/**
 * 기본 AuditLogger 인스턴스
 * @example
 * ```typescript
 * import { auditLogger } from './audit-logger';
 * auditLogger.logToolCall('kubectl', { command: 'get pods' }, 'success');
 * ```
 */
export const auditLogger = AuditLogger.getInstance();
