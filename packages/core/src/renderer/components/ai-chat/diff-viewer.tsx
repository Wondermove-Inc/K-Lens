/**
 * 🎯 목적: DiffViewer UI 컴포넌트
 * 01: DiffViewer UI 구현
 *
 * 📝 주요 기능:
 * - Unified Diff 시각화
 * - 추가/삭제 라인 하이라이팅
 * - 라인 번호 표시
 * - 통계 표시 (추가/삭제 카운트)
 * - 접기/펼치기 기능
 * - 복사 버튼 (Diff 내용 클립보드 복사)
 *
 * 🔄 변경이력:
 * - 2026-01-05: 초기 생성 (01)
 * - 2026-01-06: 복사 버튼 추가 (USER-GUIDE.md 기능 구현)
 *
 * @packageDocumentation
 */

import { clipboard } from "electron";
import { Check, ChevronDown, ChevronRight, Copy, FileCode } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { type DiffViewerProps } from "../../../features/ai-assistant/common/diff-types";
import { useDiffParser } from "../../../features/ai-assistant/renderer/hooks/use-diff-parser";
import { cn } from "../../lib/utils";
import { Button } from "../shadcn-ui/button";
import { Collapsible, CollapsibleContent } from "../shadcn-ui/collapsible";
import { DiffHunkRenderer, DiffStatisticsDisplay, EmptyDiffDisplay, FileStatusBadge } from "./diff-viewer-utils";

// ============================================
// 🎯 DiffViewer 컴포넌트
// ============================================

/**
 * DiffViewer 컴포넌트
 *
 * 📝 Unified Diff 문자열을 시각적으로 표시하는 컴포넌트
 *
 * @param props - DiffViewerProps
 *
 * @example
 * ```tsx
 * <DiffViewer
 *   diff={unifiedDiffString}
 *   fileName="src/index.ts"
 *   showLineNumbers
 *   showStatistics
 * />
 * ```
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  fileName,
  showLineNumbers = true,
  showStatistics = true,
  maxHeight = "400px",
  className,
  defaultExpanded = true,
  onExpandChange,
}) => {
  // 펼침 상태 관리
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // 🎯 2026-01-06: 복사 상태 관리 (USER-GUIDE.md 기능 구현)
  const [isCopied, setIsCopied] = useState(false);

  // Diff 파싱
  const { parsedDiff, statistics } = useDiffParser(diff);

  // 펼침 상태 변경 핸들러
  const handleExpandChange = useCallback(
    (expanded: boolean) => {
      setIsExpanded(expanded);
      onExpandChange?.(expanded);
    },
    [onExpandChange],
  );

  // 펼침 토글 핸들러
  const handleToggle = useCallback(() => {
    handleExpandChange(!isExpanded);
  }, [isExpanded, handleExpandChange]);

  /**
   * 🎯 목적: Diff 내용 클립보드 복사
   * 📝 주의사항: 복사 후 2초간 체크 아이콘 표시
   * 🔄 변경이력: 2026-01-06 - 초기 추가 (USER-GUIDE.md 기능 구현)
   */
  const handleCopy = useCallback(() => {
    if (!diff) return;
    clipboard.writeText(diff);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [diff]);

  // 빈 Diff 여부
  const isEmpty = useMemo(() => {
    return !parsedDiff || parsedDiff.hunks.length === 0;
  }, [parsedDiff]);

  return (
    <div
      className={cn("border rounded-lg bg-background overflow-hidden", className)}
      role="region"
      aria-label={`Diff: ${fileName}`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 border-b">
        {/* 왼쪽: 파일 정보 */}
        <div className="flex items-center gap-2 min-w-0">
          {/* 파일 아이콘 */}
          <FileCode className="h-4 w-4 flex-shrink-0 text-muted-foreground" />

          {/* 파일 이름 */}
          <span className="text-sm font-medium truncate">{fileName}</span>

          {/* 파일 상태 배지 */}
          {parsedDiff && (
            <FileStatusBadge
              isNewFile={parsedDiff.isNewFile}
              isDeleted={parsedDiff.isDeleted}
              isRenamed={parsedDiff.isRenamed}
            />
          )}
        </div>

        {/* 오른쪽: 통계, 복사, 토글 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* 통계 */}
          {showStatistics && statistics && (
            <DiffStatisticsDisplay additions={statistics.additions} deletions={statistics.deletions} />
          )}

          {/* 🎯 2026-01-06: 복사 버튼 추가 (USER-GUIDE.md 기능 구현) */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleCopy}
            aria-label={isCopied ? "복사됨" : "Diff 복사"}
            title={isCopied ? "복사됨!" : "Diff 복사"}
          >
            {/* 🎯 THEME-024: Semantic color for copy success indicator */}
            {isCopied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>

          {/* 접기/펼치기 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleToggle}
            aria-label={isExpanded ? "접기" : "펼치기"}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* 내용 (Collapsible) */}
      <Collapsible open={isExpanded} onOpenChange={handleExpandChange}>
        <CollapsibleContent>
          {isEmpty ? (
            // 빈 Diff
            <EmptyDiffDisplay />
          ) : (
            // Diff 내용
            <div className="overflow-auto" style={{ maxHeight }} data-testid="diff-scroll-area">
              <div data-testid="diff-content">
                {parsedDiff?.hunks.map((hunk, hunkIndex) => (
                  <DiffHunkRenderer
                    key={hunkIndex}
                    hunk={hunk}
                    hunkIndex={hunkIndex}
                    showLineNumbers={showLineNumbers}
                  />
                ))}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

DiffViewer.displayName = "DiffViewer";

export default DiffViewer;
