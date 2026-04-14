/**
 * 🎯 목적: ToolCallDisplay 컴포넌트
 * 02: 도구 호출 표시 UI
 *
 * 📝 주요 기능:
 * - 도구 호출 목록 표시
 * - 진행 중/완료 상태 표시
 * - 결과 미리보기
 * - 에러 표시
 * - 접기/펼치기 기능
 * - compact 모드
 *
 * @packageDocumentation
 */

import React, { useCallback, useMemo, useState } from "react";

import type { ToolCallRecord } from "../../../features/ai-assistant/common/thinking-state";

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 타임스탬프 포맷팅
 *
 * @param date - Date 객체
 * @returns HH:MM:SS 형식 문자열
 */
function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * 인자를 간략하게 표시 (50자 제한)
 *
 * @param args - 도구 호출 인자
 * @returns 간략화된 문자열
 */
function formatArgs(args: Record<string, unknown>): string {
  const str = JSON.stringify(args);
  if (str.length > 50) {
    return str.substring(0, 47) + "...";
  }
  return str;
}

/**
 * 결과를 간략하게 표시 (30자 제한)
 *
 * @param result - 도구 호출 결과
 * @returns 간략화된 문자열
 */
function formatResult(result: unknown): string {
  const str = JSON.stringify(result);
  if (str.length > 30) {
    return str.substring(0, 27) + "...";
  }
  return str;
}

/**
 * 에러 결과인지 확인
 *
 * @param result - 도구 호출 결과
 * @returns 에러 여부
 */
function isErrorResult(result: unknown): boolean {
  if (typeof result === "object" && result !== null) {
    return (result as { error?: boolean }).error === true;
  }
  return false;
}

// ============================================
// 🎯 ToolCallItem 컴포넌트
// ============================================

/**
 * ToolCallItem Props
 */
export interface ToolCallItemProps {
  /** 도구 호출 레코드 */
  toolCall: ToolCallRecord;
  /** 인덱스 (테스트용 ID 생성) */
  index: number;
  /** 에러 표시 여부 */
  showError?: boolean;
}

/**
 * 개별 도구 호출 표시 컴포넌트
 *
 * 📝 도구 이름, 인자, 결과, 타임스탬프 표시
 */
export const ToolCallItem: React.FC<ToolCallItemProps> = React.memo(({ toolCall, index, showError = false }) => {
  const hasResult = toolCall.result !== undefined;
  const hasError = showError && hasResult && isErrorResult(toolCall.result);

  // 에러 메시지 추출
  const errorMessage = useMemo(() => {
    if (!hasError || !toolCall.result) return null;
    const res = toolCall.result as { message?: string };
    return res.message || "Unknown error";
  }, [hasError, toolCall.result]);

  // 스타일 클래스 계산 - 🎯 THEME-024: CSS 변수 기반 유틸리티
  const itemClassName = useMemo(() => {
    const classes = [
      "flex items-start gap-2 p-2 rounded-md text-sm",
      hasError ? "bg-status-error-muted error" : "bg-[var(--tw-gray-50)]",
    ];
    return classes.filter(Boolean).join(" ");
  }, [hasError]);

  return (
    <div className={itemClassName} data-testid={`tool-call-${index}`} aria-label={`도구 호출: ${toolCall.name}`}>
      <span className="text-muted-foreground">🔧</span>
      <div className="flex-1 min-w-0">
        {/* 🎯 THEME-024: Semantic color for tool call status */}
        {/* 도구 이름 + 타임스탬프 */}
        <div className="flex items-center gap-2">
          <span className={`font-medium ${hasError ? "text-status-error" : "text-status-info"}`}>{toolCall.name}</span>
          <span className="text-xs text-muted-foreground/70" data-testid={`timestamp-tool-${index}`}>
            {formatTimestamp(toolCall.timestamp)}
          </span>
        </div>

        {/* 인자 */}
        <div className="text-xs text-muted-foreground truncate">{formatArgs(toolCall.args)}</div>

        {/* 결과 또는 로딩 */}
        {hasResult ? (
          hasError ? (
            <div className="text-xs text-status-error mt-1">❌ {errorMessage}</div>
          ) : (
            <div className="text-xs text-status-success mt-1">→ {formatResult(toolCall.result)}</div>
          )
        ) : (
          <div className="flex items-center gap-1 mt-1" data-testid={`tool-loading-${index}`}>
            <span className="animate-spin text-xs">⏳</span>
            <span className="text-xs text-muted-foreground/70">실행 중...</span>
          </div>
        )}
      </div>
    </div>
  );
});

ToolCallItem.displayName = "ToolCallItem";

// ============================================
// 🎯 ToolCallDisplay 컴포넌트
// ============================================

/**
 * ToolCallDisplay Props
 */
export interface ToolCallDisplayProps {
  /** 도구 호출 목록 */
  toolCalls: ToolCallRecord[];
  /** 기본 펼침 상태 */
  defaultExpanded?: boolean;
  /** 진행 중 개수 표시 */
  showPendingCount?: boolean;
  /** compact 모드 */
  compact?: boolean;
}

/**
 * 도구 호출 목록 표시 컴포넌트
 *
 * 📝 접기/펼치기, 요약, compact 모드 지원
 */
export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = React.memo(
  ({ toolCalls, defaultExpanded = true, showPendingCount = false, compact = false }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // 빈 목록이면 렌더링 안함
    if (toolCalls.length === 0) {
      return null;
    }

    // 진행 중인 호출 개수
    const pendingCount = useMemo(() => {
      return toolCalls.filter((call) => call.result === undefined).length;
    }, [toolCalls]);

    // 토글 핸들러
    const handleToggle = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    // Compact 모드
    if (compact) {
      return (
        <div className="text-xs text-muted-foreground flex items-center gap-2" data-testid="tool-calls-compact">
          <span>🔧</span>
          <span>{toolCalls.length}개 도구 호출</span>
          {pendingCount > 0 && <span className="text-status-warning">({pendingCount}개 진행 중)</span>}
        </div>
      );
    }

    return (
      <div className="mt-2">
        {/* 헤더: 도구 호출 개수 + 토글 */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">도구 호출 ({toolCalls.length})</span>
            {showPendingCount && pendingCount > 0 && (
              <span className="text-xs text-status-warning">{pendingCount}개 진행 중</span>
            )}
          </div>
          <button
            onClick={handleToggle}
            className="p-1 text-xs hover:bg-muted rounded"
            data-testid="toggle-tools"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "도구 호출 접기" : "도구 호출 펼치기"}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        </div>

        {/* 접힌 상태: 요약 */}
        {!isExpanded && (
          <div className="text-xs text-muted-foreground">
            {toolCalls.length}개 도구 호출
            {pendingCount > 0 && ` (${pendingCount}개 진행 중)`}
          </div>
        )}

        {/* 펼친 상태: 상세 목록 */}
        {isExpanded && (
          <div className="space-y-2">
            {toolCalls.map((toolCall, index) => (
              <ToolCallItem key={index} toolCall={toolCall} index={index} showError />
            ))}
          </div>
        )}
      </div>
    );
  },
);

ToolCallDisplay.displayName = "ToolCallDisplay";

export default ToolCallDisplay;
