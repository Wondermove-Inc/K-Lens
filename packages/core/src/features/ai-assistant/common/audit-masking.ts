/**
 * 🎯 목적: AI Assistant 감사 로깅 - 민감 정보 마스킹 유틸리티
 * 01: AuditLogger 구현
 *
 * 📝 주의사항:
 * - 민감 정보를 자동으로 마스킹하는 유틸리티 함수 제공
 * - 문자열, 객체, 배열 재귀적 마스킹 지원
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (audit-logger.ts에서 분리)
 *
 * @packageDocumentation
 */

import type { SensitivePattern } from "./audit-sensitive-patterns";

// ============================================
// 🎯 마스킹 유틸리티 클래스
// ============================================

/**
 * 민감 정보 마스킹 유틸리티
 *
 * 🎯 목적: 민감 정보를 자동으로 마스킹
 *
 * 📝 주요 기능:
 * - 문자열 내 민감 패턴 검출 및 마스킹
 * - 객체, 배열 재귀적 마스킹
 * - 커스텀 패턴 지원
 *
 * @example
 * ```typescript
 * const masker = new SensitiveDataMasker(DEFAULT_SENSITIVE_PATTERNS);
 * const masked = masker.mask({ apiKey: 'secret123' });
 * ```
 */
export class SensitiveDataMasker {
  /** 민감 정보 패턴 목록 */
  private readonly patterns: SensitivePattern[];

  /**
   * SensitiveDataMasker 생성자
   *
   * @param patterns - 마스킹할 민감 정보 패턴 배열
   */
  constructor(patterns: SensitivePattern[]) {
    this.patterns = patterns;
  }

  /**
   * 데이터 마스킹 (진입점)
   *
   * 🎯 목적: 모든 타입의 데이터에서 민감 정보 마스킹
   *
   * @param data - 마스킹할 데이터
   * @returns 마스킹된 데이터
   */
  mask<T>(data: T): T {
    // null, undefined는 그대로 반환
    if (data === null || data === undefined) {
      return data;
    }

    // 숫자, boolean은 그대로 반환
    if (typeof data === "number" || typeof data === "boolean") {
      return data;
    }

    // 문자열 마스킹
    if (typeof data === "string") {
      return this.maskString(data) as T;
    }

    // 배열 마스킹
    if (Array.isArray(data)) {
      return this.maskArray(data) as T;
    }

    // 객체 마스킹
    if (typeof data === "object") {
      return this.maskObject(data as Record<string, unknown>) as T;
    }

    return data;
  }

  /**
   * 문자열 마스킹
   *
   * @param str - 마스킹할 문자열
   * @returns 마스킹된 문자열
   */
  maskString(str: string): string {
    let result = str;

    for (const pattern of this.patterns) {
      if (typeof pattern.replacement === "string") {
        result = result.replace(pattern.pattern, pattern.replacement);
      } else {
        result = result.replace(pattern.pattern, pattern.replacement);
      }
    }

    return result;
  }

  /**
   * 배열 마스킹
   *
   * @param arr - 마스킹할 배열
   * @returns 마스킹된 배열
   */
  private maskArray(arr: unknown[]): unknown[] {
    return arr.map((item) => this.mask(item));
  }

  /**
   * 객체 마스킹
   *
   * @param obj - 마스킹할 객체
   * @returns 마스킹된 객체
   */
  private maskObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(obj)) {
      result[key] = this.mask(obj[key]);
    }

    return result;
  }
}

// ============================================
// 🎯 독립 마스킹 함수 (편의 함수)
// ============================================

/**
 * 문자열에서 민감 정보 마스킹
 *
 * 🎯 목적: 단일 문자열에서 민감 정보 마스킹
 *
 * @param str - 마스킹할 문자열
 * @param patterns - 민감 정보 패턴 배열
 * @returns 마스킹된 문자열
 *
 * @example
 * ```typescript
 * const masked = maskStringWithPatterns(
 *   'api_key=secret123',
 *   DEFAULT_SENSITIVE_PATTERNS
 * );
 * // 'api_key=***MASKED***'
 * ```
 */
export function maskStringWithPatterns(str: string, patterns: SensitivePattern[]): string {
  let result = str;

  for (const pattern of patterns) {
    if (typeof pattern.replacement === "string") {
      result = result.replace(pattern.pattern, pattern.replacement);
    } else {
      result = result.replace(pattern.pattern, pattern.replacement);
    }
  }

  return result;
}

/**
 * 객체에서 민감 정보 마스킹
 *
 * 🎯 목적: 객체 내 모든 문자열 값에서 민감 정보 마스킹
 *
 * @param obj - 마스킹할 객체
 * @param patterns - 민감 정보 패턴 배열
 * @returns 마스킹된 객체
 *
 * @example
 * ```typescript
 * const masked = maskObjectWithPatterns(
 *   { command: 'password=secret' },
 *   DEFAULT_SENSITIVE_PATTERNS
 * );
 * // { command: 'password=***MASKED***' }
 * ```
 */
export function maskObjectWithPatterns<T extends Record<string, unknown>>(obj: T, patterns: SensitivePattern[]): T {
  const masker = new SensitiveDataMasker(patterns);
  return masker.mask(obj);
}
