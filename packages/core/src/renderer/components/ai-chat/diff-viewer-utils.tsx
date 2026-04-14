/**
 * 🎯 목적: DiffViewer 유틸리티 및 서브 컴포넌트
 * 01: DiffViewer UI 구현
 *
 * 📝 주요 기능:
 * - DiffLineRenderer: 개별 라인 렌더링
 * - DiffHunkRenderer: Hunk(변경 블록) 렌더링
 * - 유틸리티 함수
 *
 * @packageDocumentation
 */

import React from "react";
import {
  type DiffHunkRendererProps,
  type DiffLineRendererProps,
  DiffLineType,
} from "../../../features/ai-assistant/common/diff-types";
import { cn } from "../../lib/utils";

// ============================================
// 🎯 라인 타입별 스타일
// ============================================

/**
 * 라인 타입에 따른 CSS 클래스 반환
 *
 * @param type - Diff 라인 타입
 * @returns CSS 클래스 문자열
 *
 * 📝 2026-01-07: 해결 - 다크 테마에서 Diff 가독성 대폭 향상
 * 🔄 2026-01-07: 재수정 - Tailwind JIT 문제로 인라인 스타일 사용
 */
export function getLineTypeClass(type: DiffLineType): string {
  // 🎯 Tailwind JIT가 동적 클래스를 제거하는 문제로
  // CSS 클래스만 반환하고 실제 색상은 getLineTypeStyle에서 인라인으로 적용
  switch (type) {
    case DiffLineType.ADDED:
      return "diff-line-added";
    case DiffLineType.REMOVED:
      return "diff-line-removed";
    case DiffLineType.HUNK_HEADER:
      return "diff-line-header font-medium";
    case DiffLineType.UNCHANGED:
    default:
      return "diff-line-unchanged";
  }
}

/**
 * 🎯 목적: 라인 타입에 따른 인라인 스타일 반환
 * 📝 2026-01-07: 추가 - Tailwind JIT 우회를 위한 인라인 스타일
 *
 * @param type - Diff 라인 타입
 * @returns React.CSSProperties 인라인 스타일
 */
export function getLineTypeStyle(type: DiffLineType): React.CSSProperties {
  switch (type) {
    case DiffLineType.ADDED:
      // 추가 라인: 어두운 초록 배경 + 밝은 연두색 텍스트 (최고 대비)
      return { backgroundColor: "var(--diff-added-bg)", color: "var(--diff-added-fg)" };
    case DiffLineType.REMOVED:
      // 삭제 라인: 어두운 빨강 배경 + 밝은 분홍색 텍스트 (최고 대비)
      return { backgroundColor: "var(--diff-removed-bg)", color: "var(--diff-removed-fg)" };
    case DiffLineType.HUNK_HEADER:
      // 헤더 라인: 어두운 파랑 배경 + 밝은 하늘색 텍스트
      return { backgroundColor: "var(--diff-header-bg)", color: "var(--diff-header-fg)" };
    case DiffLineType.UNCHANGED:
    default:
      // 변경 없음: 매우 어두운 회색 배경 + 밝은 회색 텍스트
      return { backgroundColor: "var(--diff-unchanged-bg)", color: "var(--diff-unchanged-fg)" };
  }
}

/**
 * 라인 타입에 따른 접두사 반환
 *
 * @param type - Diff 라인 타입
 * @returns 접두사 문자
 */
export function getLinePrefix(type: DiffLineType): string {
  switch (type) {
    case DiffLineType.ADDED:
      return "+";
    case DiffLineType.REMOVED:
      return "-";
    case DiffLineType.HUNK_HEADER:
      return "";
    case DiffLineType.UNCHANGED:
    default:
      return " ";
  }
}

/**
 * 라인 타입에 따른 테스트 ID 반환
 *
 * @param type - Diff 라인 타입
 * @returns 테스트 ID
 */
export function getLineTestId(type: DiffLineType): string {
  switch (type) {
    case DiffLineType.ADDED:
      return "diff-line-added";
    case DiffLineType.REMOVED:
      return "diff-line-removed";
    case DiffLineType.HUNK_HEADER:
      return "diff-line-hunk-header";
    case DiffLineType.UNCHANGED:
    default:
      return "diff-line-unchanged";
  }
}

// ============================================
// 🎯 DiffLineRenderer 컴포넌트
// ============================================

/**
 * 개별 Diff 라인 렌더러
 *
 * 📝 라인 타입에 따라 스타일 및 접두사 적용
 * 🔄 2026-01-07: 수정 - 인라인 스타일로 색상 적용 (Tailwind JIT 우회)
 *
 * @param props - DiffLineRendererProps
 */
export const DiffLineRenderer: React.FC<DiffLineRendererProps> = React.memo(({ line, showLineNumbers = true }) => {
  const typeClass = getLineTypeClass(line.type);
  const typeStyle = getLineTypeStyle(line.type);
  const prefix = getLinePrefix(line.type);
  const testId = getLineTestId(line.type);

  // 🎯 접두사 색상 (인라인) - THEME-020: CSS 변수 사용
  const getPrefixStyle = (): React.CSSProperties => {
    switch (line.type) {
      case DiffLineType.ADDED:
        return { color: "var(--diff-added-symbol)" }; // 밝은 초록
      case DiffLineType.REMOVED:
        return { color: "var(--diff-removed-symbol)" }; // 밝은 빨강
      default:
        return {};
    }
  };

  // Hunk 헤더는 특별 처리
  if (line.type === DiffLineType.HUNK_HEADER) {
    return (
      <div
        className={cn("flex items-center py-1 px-2 text-xs font-mono border-y border-border/50", typeClass)}
        style={typeStyle}
        role="row"
        data-testid="hunk-header"
      >
        <span className="select-all">{line.content}</span>
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-stretch text-xs font-mono group", typeClass)}
      style={typeStyle}
      role="row"
      data-testid={testId}
    >
      {/* 라인 번호 */}
      {showLineNumbers && (
        <>
          {/* Old 라인 번호 */}
          <span
            className="w-10 flex-shrink-0 text-right pr-2 select-none border-r border-border/30"
            style={{ color: "var(--diff-line-number)" }}
            data-testid="line-number-old"
          >
            {line.lineNumber.old ?? ""}
          </span>

          {/* New 라인 번호 */}
          <span
            className="w-10 flex-shrink-0 text-right pr-2 select-none border-r border-border/30"
            style={{ color: "var(--diff-line-number)" }}
            data-testid="line-number-new"
          >
            {line.lineNumber.new ?? ""}
          </span>
        </>
      )}

      {/* 접두사 (+, -, 공백) */}
      <span className="w-4 flex-shrink-0 text-center select-none" style={getPrefixStyle()}>
        {prefix}
      </span>

      {/* 라인 내용 */}
      <span className="flex-1 whitespace-pre px-1 overflow-x-auto">{line.content}</span>
    </div>
  );
});

DiffLineRenderer.displayName = "DiffLineRenderer";

// ============================================
// 🎯 DiffHunkRenderer 컴포넌트
// ============================================

/**
 * Hunk(변경 블록) 렌더러
 *
 * 📝 Hunk 헤더와 라인들을 렌더링
 *
 * @param props - DiffHunkRendererProps
 */
export const DiffHunkRenderer: React.FC<DiffHunkRendererProps> = React.memo(
  ({ hunk, showLineNumbers = true, hunkIndex }) => {
    return (
      <div className="border-t border-border/30 first:border-t-0" data-testid={`hunk-${hunkIndex}`}>
        {/* Hunk 헤더 */}
        <DiffLineRenderer
          line={{
            type: DiffLineType.HUNK_HEADER,
            content: hunk.header,
            lineNumber: { old: null, new: null },
          }}
          showLineNumbers={false}
        />

        {/* Hunk 라인들 */}
        {hunk.lines.map((line, lineIndex) => (
          <DiffLineRenderer key={`${hunkIndex}-${lineIndex}`} line={line} showLineNumbers={showLineNumbers} />
        ))}
      </div>
    );
  },
);

DiffHunkRenderer.displayName = "DiffHunkRenderer";

// ============================================
// 🎯 DiffStatistics 컴포넌트
// ============================================

/**
 * Diff 통계 표시 Props
 */
export interface DiffStatisticsDisplayProps {
  /** 추가된 라인 수 */
  additions: number;
  /** 삭제된 라인 수 */
  deletions: number;
}

/**
 * Diff 통계 표시 컴포넌트
 *
 * 📝 추가/삭제된 라인 수를 컬러풀하게 표시
 */
export const DiffStatisticsDisplay: React.FC<DiffStatisticsDisplayProps> = React.memo(({ additions, deletions }) => {
  return (
    <div className="flex items-center gap-2 text-xs" data-testid="diff-statistics">
      {/* 🎯 THEME-024: Semantic color for diff statistics */}
      {/* 추가 */}
      <span className="text-status-success font-medium">+{additions}</span>

      {/* 삭제 */}
      <span className="text-status-error font-medium">-{deletions}</span>
    </div>
  );
});

DiffStatisticsDisplay.displayName = "DiffStatisticsDisplay";

// ============================================
// 🎯 파일 상태 배지 컴포넌트
// ============================================

/**
 * 파일 상태 배지 Props
 */
export interface FileStatusBadgeProps {
  /** 새 파일 여부 */
  isNewFile?: boolean;
  /** 삭제된 파일 여부 */
  isDeleted?: boolean;
  /** 이름 변경 여부 */
  isRenamed?: boolean;
}

/**
 * 파일 상태 배지 컴포넌트
 * 🎯 THEME-024: CSS 변수 기반 유틸리티 클래스
 *
 * 📝 새 파일, 삭제, 이름 변경 등 상태 표시
 */
export const FileStatusBadge: React.FC<FileStatusBadgeProps> = React.memo(({ isNewFile, isDeleted, isRenamed }) => {
  if (isNewFile) {
    return (
      <span className="px-1.5 py-0.5 text-xs rounded bg-badge-success whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]">
        New File
      </span>
    );
  }

  if (isDeleted) {
    return (
      <span className="px-1.5 py-0.5 text-xs rounded bg-badge-error whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]">
        Deleted
      </span>
    );
  }

  if (isRenamed) {
    return (
      <span className="px-1.5 py-0.5 text-xs rounded bg-badge-warning whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]">
        Renamed
      </span>
    );
  }

  return null;
});

FileStatusBadge.displayName = "FileStatusBadge";

// ============================================
// 🎯 빈 Diff 표시 컴포넌트
// ============================================

/**
 * 빈 Diff 표시 컴포넌트
 *
 * 📝 변경 사항이 없을 때 표시
 */
export const EmptyDiffDisplay: React.FC = React.memo(() => {
  return <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">No changes</div>;
});

EmptyDiffDisplay.displayName = "EmptyDiffDisplay";
