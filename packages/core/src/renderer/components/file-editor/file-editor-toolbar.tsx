/**
 * 🎯 목적: 파일 에디터 상단 도구모음 컴포넌트
 * 📝 기능:
 *   - 저장 버튼 (Ctrl+S 힌트)
 *   - 새로고침 버튼 (디스크에서 파일 다시 읽기)
 *   - isDirty 표시 (수정됨 뱃지)
 *   - 파일명 표시
 *   - 읽기 전용 표시
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 *   - 2026-01-30: Revert → Refresh 버튼으로 변경
 * @module file-editor/file-editor-toolbar
 */

import { Edit, Eye, Loader2, Lock, Play, RotateCcw, Save, SplitSquareHorizontal } from "lucide-react";
import React from "react";
import { cn } from "../../utils/cn";
import { Badge } from "../shadcn-ui/badge";
import { Button } from "../shadcn-ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../shadcn-ui/tooltip";

import type { MarkdownViewMode } from "../main-tabs/main-tab.model";

// Re-export for backward compatibility
export type { MarkdownViewMode } from "../main-tabs/main-tab.model";

/**
 * FileEditorToolbar Props
 */
export interface FileEditorToolbarProps {
  /** 파일명 */
  fileName: string;
  /** 파일 전체 경로 */
  filePath: string;
  /** 파일 언어 */
  language?: string;
  /** 변경 여부 */
  isDirty: boolean;
  /** 읽기 전용 여부 */
  readOnly?: boolean;
  /** 저장 중 여부 */
  isSaving?: boolean;
  /** Apply 중 여부 */
  isApplying?: boolean;
  /** 마크다운 파일 여부 */
  isMarkdown?: boolean;
  /** 마크다운 표시 모드 */
  markdownViewMode?: MarkdownViewMode;
  /** 저장 버튼 클릭 */
  onSave?: () => void;
  /** 새로고침 버튼 클릭 (디스크에서 파일 다시 읽기) */
  onRefresh?: () => void;
  /** Apply 버튼 클릭 */
  onApply?: () => void;
  /** 마크다운 모드 변경 */
  onViewModeChange?: (mode: MarkdownViewMode) => void;
}

/**
 * 파일 에디터 상단 도구모음 컴포넌트
 */
/**
 * Kubernetes 리소스 파일인지 확인 (YAML/JSON)
 */
function isKubernetesFile(language?: string): boolean {
  return language === "yaml" || language === "json";
}

export function FileEditorToolbar({
  fileName,
  filePath,
  language,
  isDirty,
  readOnly = false,
  isSaving = false,
  isApplying = false,
  isMarkdown = false,
  markdownViewMode = "edit",
  onSave,
  onRefresh,
  onApply,
  onViewModeChange,
}: FileEditorToolbarProps) {
  // YAML/JSON 파일일 때만 Apply 버튼 표시
  const showApplyButton = isKubernetesFile(language) && !readOnly && onApply;
  return (
    <TooltipProvider>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30 min-h-[40px]">
        {/* 좌측: 파일 정보 */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* 파일명 + isDirty 표시 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm font-medium truncate max-w-[200px]">
                {fileName}
                {/* 🎯 THEME-024: Semantic color for unsaved file indicator */}
                {isDirty && <span className="text-status-warning ml-1">*</span>}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[400px]">
              <p className="break-all">{filePath}</p>
            </TooltipContent>
          </Tooltip>

          {/* 언어 뱃지 */}
          {language && (
            <Badge variant="secondary" className="text-xs">
              {language}
            </Badge>
          )}

          {/* 읽기 전용 뱃지 */}
          {readOnly && (
            <Badge variant="outline" className="text-xs gap-1">
              <Lock className="h-3 w-3" />
              Read-only
            </Badge>
          )}

          {/* 수정됨 뱃지 - 🎯 THEME-024: CSS 변수 기반 색상 */}
          {isDirty && !isSaving && (
            <Badge variant="secondary" className="text-xs bg-modified">
              Modified
            </Badge>
          )}

          {/* 저장 중 뱃지 */}
          {isSaving && (
            <Badge variant="secondary" className="text-xs">
              Saving...
            </Badge>
          )}
        </div>

        {/* 우측: 액션 버튼들 */}
        <div className="flex items-center gap-1">
          {/* 마크다운 모드 버튼들 */}
          {isMarkdown && onViewModeChange && (
            <div className="flex items-center border border-border rounded-md mr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 px-2 rounded-r-none", markdownViewMode === "edit" && "bg-muted")}
                    onClick={() => onViewModeChange("edit")}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit Mode</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 px-2 rounded-none border-x border-border",
                      markdownViewMode === "split" && "bg-muted",
                    )}
                    onClick={() => onViewModeChange("split")}
                  >
                    <SplitSquareHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Split Mode</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 px-2 rounded-l-none", markdownViewMode === "preview" && "bg-muted")}
                    onClick={() => onViewModeChange("preview")}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Preview Mode</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* 새로고침 버튼 (디스크에서 파일 다시 읽기) */}
          {onRefresh && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onRefresh} disabled={isSaving}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh from Disk</TooltipContent>
            </Tooltip>
          )}

          {/* 저장 버튼 */}
          {!readOnly && onSave && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1"
                  onClick={onSave}
                  disabled={!isDirty || isSaving || isApplying}
                >
                  <Save className="h-3.5 w-3.5" />
                  <span className="text-xs text-muted-foreground hidden sm:inline">Ctrl+S</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save File (Ctrl+S)</TooltipContent>
            </Tooltip>
          )}

          {/* kubectl apply 버튼 */}
          {showApplyButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-3 gap-1.5 ml-2"
                  onClick={onApply}
                  disabled={isSaving || isApplying}
                >
                  {isApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  <span className="text-xs">{isApplying ? "Applying..." : "Apply"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isDirty ? "Save and apply to Kubernetes cluster" : "Apply to Kubernetes cluster"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
