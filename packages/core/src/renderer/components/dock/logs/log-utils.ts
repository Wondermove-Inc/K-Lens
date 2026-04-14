/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { Moment } from "moment-timezone";

import type { TimestampFormat } from "./tab-store";

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace" | "unknown";

/**
 * 필터링 가능한 로그 레벨 목록 (unknown 제외)
 */
export const FILTERABLE_LOG_LEVELS: LogLevel[] = ["error", "warn", "info", "debug", "trace"];

/**
 * 로그 레벨의 표시 레이블
 */
export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  error: "ERROR",
  warn: "WARN",
  info: "INFO",
  debug: "DEBUG",
  trace: "TRACE",
  unknown: "OTHER",
};

/**
 * JSON 로그에서 로그 레벨 필드 값을 LogLevel로 매핑하는 상수
 */
const JSON_LEVEL_MAP: Record<string, LogLevel> = {
  error: "error",
  err: "error",
  fatal: "error",
  critical: "error",
  panic: "error",
  warn: "warn",
  warning: "warn",
  info: "info",
  information: "info",
  debug: "debug",
  dbg: "debug",
  trace: "trace",
  verbose: "trace",
};

/**
 * 로그 레벨 감지 패턴
 * - 대소문자 무관
 * - 대괄호, 공백 등 다양한 포맷 지원
 * - 예: [ERROR], ERROR:, level=error, "level":"error"
 * - Kubernetes klog 포맷 지원: I0127, W0127, E0127, F0127
 */
const LOG_LEVEL_PATTERNS: { level: LogLevel; pattern: RegExp }[] = [
  // Kubernetes klog format: E0127, F0127 (check before general patterns)
  // Using (?:^|\s) to match at start or after space (for timestamp prefix)
  { level: "error", pattern: /(?:^|\s)[EF]\d{4}\s/ },
  // Kubernetes klog format: W0127
  { level: "warn", pattern: /(?:^|\s)W\d{4}\s/ },
  // Kubernetes klog format: I0127
  { level: "info", pattern: /(?:^|\s)I\d{4}\s/ },
  // General patterns
  { level: "error", pattern: /\b(error|err|fatal|crit(?:ical)?|panic)\b/i },
  { level: "warn", pattern: /\b(warn(?:ing)?)\b/i },
  { level: "info", pattern: /\b(info)\b/i },
  { level: "debug", pattern: /\b(debug|dbg)\b/i },
  { level: "trace", pattern: /\b(trace|verbose)\b/i },
];

/**
 * JSON 포맷 로그에서 로그 레벨을 감지합니다.
 * severity, level, lvl 필드를 순서대로 확인합니다.
 *
 * @param logLine JSON 형식의 로그 라인 문자열
 * @returns 감지된 로그 레벨 또는 'unknown'
 */
function detectLogLevelFromJson(logLine: string): LogLevel {
  try {
    const parsed = JSON.parse(logLine);
    const value = parsed.severity ?? parsed.level ?? parsed.lvl;

    if (typeof value === "string") {
      return JSON_LEVEL_MAP[value.toLowerCase()] ?? "unknown";
    }
  } catch {
    // JSON 파싱 실패 → fallback to regex
  }

  return "unknown";
}

/**
 * 로그 라인에서 로그 레벨을 감지합니다.
 * JSON 로그는 파싱을 통해 정확한 레벨을 감지하고,
 * 일반 텍스트 로그는 앞부분(처음 100자)에서 정규식으로 검색합니다.
 *
 * @param logLine 로그 라인 문자열
 * @returns 감지된 로그 레벨 또는 'unknown'
 */
export function detectLogLevel(logLine: string): LogLevel {
  // JSON 로그 감지: { 로 시작하는 경우 JSON 파싱 시도
  if (logLine.charCodeAt(0) === 123) {
    // '{'
    const level = detectLogLevelFromJson(logLine);

    if (level !== "unknown") {
      return level;
    }
  }

  // 기존 정규식 매칭 (일반 텍스트 로그 또는 JSON 파싱 실패 시 fallback)
  const searchPortion = logLine.slice(0, 100);

  for (const { level, pattern } of LOG_LEVEL_PATTERNS) {
    if (pattern.test(searchPortion)) {
      return level;
    }
  }

  return "unknown";
}

/**
 * 로그 레벨에 해당하는 CSS 클래스 이름을 반환합니다.
 *
 * @param level 로그 레벨
 * @returns CSS 클래스 이름 (unknown인 경우 빈 문자열)
 */
export function getLogLevelClassName(level: LogLevel): string {
  if (level === "unknown") {
    return "";
  }

  return `log-${level}`;
}

/**
 * 타임스탬프를 지정된 포맷으로 변환합니다.
 *
 * @param momentInstance moment 인스턴스 (타임존 적용됨)
 * @param format 타임스탬프 포맷
 * @returns 포맷된 타임스탬프 문자열
 */
export function formatTimestamp(momentInstance: Moment, format: TimestampFormat = "iso"): string {
  switch (format) {
    case "short":
      return momentInstance.format("HH:mm:ss.SSS");
    case "relative":
      return momentInstance.fromNow();
    case "iso":
    default:
      return momentInstance.format();
  }
}
