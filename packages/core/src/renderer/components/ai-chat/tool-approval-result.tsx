/**
 * 🎯 목적: Tool 승인/거절 결과 표시 컴포넌트
 *
 * 📝 주의사항:
 * - 승인/거절 후 채팅 영역에 결과 표시
 * - 간단한 인라인 메시지 형태
 * - 승인 시 초록색, 거절 시 빨간색 배지
 * - Diff 통계(추가/삭제 라인 수) 표시 지원
 * - YAML 내용 미리보기 지원
 * - 명령어 실행 결과 접힌 상태로 표시 (2026-01-13)
 *
 * 🔄 변경이력:
 * - 2026-01-06: 초기 생성 (승인 결과 표시 기능)
 * - 2026-01-07: Diff 통계 표시 기능 추가 (SOLVE-UI-001)
 * - 2026-01-07: YAML 내용 미리보기 추가
 * - 2026-01-13: 명령어 실행 결과 접힌 상태로 표시 (output prop 추가)
 */

import { Check, ChevronDown, ChevronRight, Minus, Plus, X } from "lucide-react";
import React, { useState } from "react";

// ============================================
// 🎯 Props 인터페이스
// ============================================

/**
 * Diff 통계 정보
 */
interface DiffStats {
  /** 추가된 라인 수 */
  additions: number;
  /** 삭제된 라인 수 */
  deletions: number;
}

/**
 * ToolApprovalResult 컴포넌트 Props
 */
interface ToolApprovalResultProps {
  /** 승인 여부 */
  approved: boolean;

  /** 명령어 또는 액션 요약 */
  command: string;

  /** 타임스탬프 (선택적) */
  timestamp?: string;

  /** 🆕 Diff 통계 (선택적) */
  diffStats?: DiffStats;

  /** 🆕 파일 경로 (선택적) */
  filePath?: string;

  /** 🆕 YAML 내용 (선택적) - */
  yamlContent?: string;

  /** 🆕 명령어 실행 결과 (접힌 상태로 표시) - 2026-01-13 */
  output?: string;
}

/**
 * 🎯 목적: 승인/거절 결과를 간단한 인라인 메시지로 표시
 *
 * 📝 주의사항:
 * - 승인 시: 명령어 요약 + Diff 통계 + YAML/Output 미리보기 표시
 * - 거절 시: 명령어 요약만 표시
 *
 * 🔄 변경이력:
 * - 2026-01-07: Diff 통계 표시 기능 추가 (SOLVE-UI-001)
 * - 2026-01-07: YAML 미리보기 기능 추가
 * - 2026-01-13: 명령어 실행 결과 접힌 상태로 표시 (output prop)
 */
export const ToolApprovalResult: React.FC<ToolApprovalResultProps> = ({
  approved,
  command,
  timestamp,
  diffStats,
  filePath,
  yamlContent,
  output,
}) => {
  // 🆕 YAML 미리보기 펼침 상태
  const [isYamlExpanded, setIsYamlExpanded] = useState(false);
  // 🆕 Output 미리보기 펼침 상태 (2026-01-13)
  const [isOutputExpanded, setIsOutputExpanded] = useState(false);

  // 🎯 명령어 요약 (80자 초과 시 생략)
  const displayText = filePath ?? command;
  const textSummary = displayText.length > 80 ? `${displayText.slice(0, 77)}...` : displayText;

  // 🎯 YAML 내용 존재 여부 (승인 시에만 표시)
  const hasYamlContent = approved && yamlContent && yamlContent.trim().length > 0;
  // 🎯 Output 존재 여부 (승인 시에만 표시) - 2026-01-13
  const hasOutput = approved && output && output.trim().length > 0;

  return (
    <div className="flex flex-col gap-1">
      {/* 기본 결과 라인 */}
      <div className="flex items-center gap-2 py-1.5 flex-wrap">
        {/* 승인/거절 배지 - 🎯 THEME-024: CSS 변수 기반 유틸리티 */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            approved ? "bg-badge-success" : "bg-badge-error"
          }`}
        >
          {approved ? (
            <>
              <Check className="h-3 w-3" />
              Approved
            </>
          ) : (
            <>
              <X className="h-3 w-3" />
              Rejected
            </>
          )}
        </span>

        {/* 파일 경로 또는 명령어 요약 */}
        <code className="text-xs font-mono text-muted-foreground truncate max-w-[300px]">{textSummary}</code>

        {/* 🆕 Diff 통계 (승인 시에만 표시) */}
        {approved && diffStats && (diffStats.additions > 0 || diffStats.deletions > 0) && (
          <div className="flex items-center gap-1.5 text-xs">
            {/* 🎯 THEME-024: Semantic color for diff stats */}
            {/* 추가 라인 수 */}
            {diffStats.additions > 0 && (
              <span className="inline-flex items-center gap-0.5 text-status-success">
                <Plus className="h-3 w-3" />
                {diffStats.additions}
              </span>
            )}
            {/* 삭제 라인 수 */}
            {diffStats.deletions > 0 && (
              <span className="inline-flex items-center gap-0.5 text-status-error">
                <Minus className="h-3 w-3" />
                {diffStats.deletions}
              </span>
            )}
          </div>
        )}

        {/* 🆕 YAML 토글 버튼 (승인 + YAML 있을 때만) - */}
        {hasYamlContent && (
          <button
            onClick={() => setIsYamlExpanded(!isYamlExpanded)}
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title={isYamlExpanded ? "YAML 접기" : "YAML 보기"}
          >
            {isYamlExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            YAML
          </button>
        )}

        {/* 🆕 Output 토글 버튼 (승인 + Output 있을 때만) - 2026-01-13 */}
        {hasOutput && (
          <button
            onClick={() => setIsOutputExpanded(!isOutputExpanded)}
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title={isOutputExpanded ? "결과 접기" : "결과 보기"}
          >
            {isOutputExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Output
          </button>
        )}

        {/* 타임스탬프 (선택적) */}
        {timestamp && <span className="text-xs text-muted-foreground/50 shrink-0">{timestamp}</span>}
      </div>

      {/* 🆕 YAML 미리보기 영역 (펼쳤을 때만) - */}
      {/* 🎯 2026-01-07: 수정 - 다크 테마 가독성 대폭 개선 */}
      {/* 📝 THEME-020: CSS 변수 사용 */}
      {hasYamlContent && isYamlExpanded && (
        <div
          className="mt-1 rounded-md border border-border overflow-hidden"
          style={{ backgroundColor: "var(--code-bg)" }}
        >
          <pre className="p-2 text-xs font-mono overflow-x-auto max-h-48" style={{ color: "var(--code-text-green)" }}>
            {yamlContent}
          </pre>
        </div>
      )}

      {/* 🆕 Output 미리보기 영역 (펼쳤을 때만) - 2026-01-13 */}
      {/* 📝 THEME-020: CSS 변수 사용 */}
      {hasOutput && isOutputExpanded && (
        <div
          className="mt-1 rounded-md border border-border overflow-hidden"
          style={{ backgroundColor: "var(--code-bg)" }}
        >
          <pre className="p-2 text-xs font-mono overflow-x-auto max-h-64" style={{ color: "var(--code-text-blue)" }}>
            {output}
          </pre>
        </div>
      )}
    </div>
  );
};
