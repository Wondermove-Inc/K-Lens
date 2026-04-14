/**
 * 🎯 목적: AI Assistant 감사 로깅 - 타입 가드 함수
 * 01: AuditLogger 구현
 *
 * 📝 주의사항:
 * - AuditAction, AuditResult, AuditSeverity, AuditLogEntry 타입 가드
 * - 런타임 타입 검증을 위한 함수 제공
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (audit-types.ts에서 분리)
 *
 * @packageDocumentation
 */

import type { AuditAction, AuditLogEntry, AuditResult, AuditSeverity } from "./audit-types";

// ============================================
// 🎯 AuditAction 타입 가드
// ============================================

/**
 * 유효한 AuditAction 값 목록
 */
export const VALID_AUDIT_ACTIONS: readonly AuditAction[] = [
  "tool_call",
  "hitl_approve",
  "hitl_reject",
  "mcp_call",
  "session_start",
  "session_end",
  "error",
] as const;

/**
 * 타입 가드: AuditAction인지 확인
 *
 * 🎯 목적: 문자열이 유효한 AuditAction인지 런타임에 검증
 *
 * @param action - 확인할 문자열
 * @returns AuditAction 여부
 *
 * @example
 * ```typescript
 * if (isAuditAction(action)) {
 *   // action은 AuditAction 타입으로 좁혀짐
 * }
 * ```
 */
export function isAuditAction(action: string): action is AuditAction {
  return VALID_AUDIT_ACTIONS.includes(action as AuditAction);
}

// ============================================
// 🎯 AuditResult 타입 가드
// ============================================

/**
 * 유효한 AuditResult 값 목록
 */
export const VALID_AUDIT_RESULTS: readonly AuditResult[] = ["success", "error", "pending", "cancelled"] as const;

/**
 * 타입 가드: AuditResult인지 확인
 *
 * 🎯 목적: 문자열이 유효한 AuditResult인지 런타임에 검증
 *
 * @param result - 확인할 문자열
 * @returns AuditResult 여부
 *
 * @example
 * ```typescript
 * if (isAuditResult(result)) {
 *   // result는 AuditResult 타입으로 좁혀짐
 * }
 * ```
 */
export function isAuditResult(result: string): result is AuditResult {
  return VALID_AUDIT_RESULTS.includes(result as AuditResult);
}

// ============================================
// 🎯 AuditSeverity 타입 가드
// ============================================

/**
 * 유효한 AuditSeverity 값 목록
 */
export const VALID_AUDIT_SEVERITIES: readonly AuditSeverity[] = ["info", "warn", "error", "critical"] as const;

/**
 * 타입 가드: AuditSeverity인지 확인
 *
 * 🎯 목적: 문자열이 유효한 AuditSeverity인지 런타임에 검증
 *
 * @param severity - 확인할 문자열
 * @returns AuditSeverity 여부
 *
 * @example
 * ```typescript
 * if (isAuditSeverity(severity)) {
 *   // severity는 AuditSeverity 타입으로 좁혀짐
 * }
 * ```
 */
export function isAuditSeverity(severity: string): severity is AuditSeverity {
  return VALID_AUDIT_SEVERITIES.includes(severity as AuditSeverity);
}

// ============================================
// 🎯 AuditLogEntry 타입 가드
// ============================================

/**
 * 타입 가드: AuditLogEntry인지 확인
 *
 * 🎯 목적: 알 수 없는 객체가 유효한 AuditLogEntry인지 런타임에 검증
 *
 * 📝 주의사항:
 * - 필수 필드(id, timestamp, action, result, severity)만 검증
 * - 선택 필드는 검증하지 않음
 *
 * @param obj - 확인할 객체
 * @returns AuditLogEntry 여부
 *
 * @example
 * ```typescript
 * const data = JSON.parse(jsonString);
 * if (isAuditLogEntry(data)) {
 *   // data는 AuditLogEntry 타입으로 좁혀짐
 *   console.log(data.id, data.action);
 * }
 * ```
 */
export function isAuditLogEntry(obj: unknown): obj is AuditLogEntry {
  // null 또는 객체가 아닌 경우
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  // 배열인 경우
  if (Array.isArray(obj)) {
    return false;
  }

  const entry = obj as Record<string, unknown>;

  // 필수 필드 타입 검증
  return (
    typeof entry.id === "string" &&
    typeof entry.timestamp === "string" &&
    typeof entry.action === "string" &&
    typeof entry.result === "string" &&
    typeof entry.severity === "string"
  );
}

// ============================================
// 🎯 로그 ID 생성
// ============================================

/**
 * 로그 ID 생성기 타입
 */
export type LogIdGenerator = () => string;

/**
 * 기본 로그 ID 생성 함수
 *
 * 🎯 목적: 고유한 감사 로그 ID 생성
 *
 * 📝 주의사항:
 * - 형식: audit-{timestamp}-{random}
 * - timestamp: 밀리초 단위 Unix 타임스탬프
 * - random: 6자리 base36 랜덤 문자열
 *
 * @returns 고유 로그 ID
 *
 * @example
 * ```typescript
 * const id = generateLogId();
 * // "audit-1704432000000-a1b2c3"
 * ```
 */
export function generateLogId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `audit-${timestamp}-${random}`;
}
