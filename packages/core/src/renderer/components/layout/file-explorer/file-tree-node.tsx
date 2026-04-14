/**
 * 🎯 목적: 파일 트리 노드 컴포넌트
 * 📝 기능:
 *   - 파일/폴더 아이콘 표시
 *   - 클릭 시 폴더 펼침/접힘
 *   - 더블클릭 시 파일 열기 이벤트
 *   - 선택 상태 표시
 *   - 재귀적 자식 노드 렌더링
 *   - 인라인 파일/폴더 생성 (VSCode 스타일)
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 *   - 2026-01-25: FIX-003 - MobX observer 추가 (폴더 펼침 반응성 해결)
 *   - 2026-01-25: FIX-016 - expandedPaths/loadingPaths Set 직접 참조로 변경
 *   - 2026-01-25: FIX-027 - VSCode 스타일 인라인 생성 UI 추가
 * @module file-explorer/file-tree-node
 */

import { ChevronRight, File, Folder, Loader2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { getFileIcon, getFileIconColorClass, getFolderIcon } from "./file-icons";

import type { FileTreeNodeProps } from "./file-explorer.types";

/** 들여쓰기 단위 (픽셀) */
const INDENT_SIZE = 16;

/**
 * 🆕 FIX-027: 인라인 생성 입력 컴포넌트
 * 📝 VSCode 스타일로 트리 내에서 직접 이름 입력
 */
interface InlineCreateInputProps {
  type: "file" | "folder";
  depth: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

const InlineCreateInput = ({ type, depth, onConfirm, onCancel }: InlineCreateInputProps) => {
  const [value, setValue] = useState(type === "file" ? "untitled.txt" : "New Folder");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 마운트 시 input에 포커스하고 전체 선택
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) {
        onConfirm(value.trim());
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // blur 시 값이 있으면 생성, 없으면 취소
    if (value.trim()) {
      onConfirm(value.trim());
    } else {
      onCancel();
    }
  };

  return (
    <div
      className="flex items-center gap-1.5 w-full px-2 py-0.5"
      style={{ paddingLeft: `${depth * INDENT_SIZE + 4}px` }}
    >
      {/* 공간 유지용 빈 chevron */}
      <span className="w-4 shrink-0" />
      {/* 🎯 THEME-024: Semantic color for folder/file icons */}
      {/* 타입에 따른 아이콘 */}
      {type === "folder" ? (
        <Folder className="h-4 w-4 text-status-warning shrink-0" />
      ) : (
        <File className="h-4 w-4 text-status-info shrink-0" />
      )}
      {/* 인라인 입력 필드 */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          "flex-1 min-w-0 px-1 py-0 text-sm bg-background border border-primary rounded-sm",
          "focus:outline-none focus:ring-1 focus:ring-primary",
        )}
        data-testid={`inline-create-input-${type}`}
      />
    </div>
  );
};

/**
 * 인라인 리네임 입력 컴포넌트
 * 📝 VSCode 스타일로 트리 내에서 직접 이름 변경
 */
interface InlineRenameInputProps {
  currentName: string;
  isDirectory: boolean;
  depth: number;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

const InlineRenameInput = ({ currentName, isDirectory, depth, onConfirm, onCancel }: InlineRenameInputProps) => {
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // 확장자 앞까지만 select (파일인 경우)
      if (!isDirectory && currentName.includes(".")) {
        const extIndex = currentName.lastIndexOf(".");
        inputRef.current.setSelectionRange(0, extIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [currentName, isDirectory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed && trimmed !== currentName) {
        onConfirm(trimmed);
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== currentName) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn(
        "flex-1 min-w-0 px-1 py-0 text-sm bg-background border border-primary rounded-sm",
        "focus:outline-none focus:ring-1 focus:ring-primary",
      )}
      data-testid="inline-rename-input"
    />
  );
};

/**
 * 🎯 FileTreeNode 컴포넌트
 * 📝 개별 파일/폴더 노드를 렌더링
 * 📝 FIX-003: observer로 래핑하여 MobX Observable 변경 감지
 * 📝 FIX-016: expandedPaths/loadingPaths Set 직접 참조로 MobX 반응성 보장
 * 📝 FIX-027: 인라인 생성 지원
 */
export const FileTreeNode = observer(function FileTreeNode({
  entry,
  depth,
  selectedPath,
  expandedPaths,
  loadingPaths,
  onSelect,
  onDoubleClick,
  onToggle,
  onContextMenu,
  inlineCreateParentPath,
  inlineCreateType,
  onInlineCreateConfirm,
  onInlineCreateCancel,
  renamingPath,
  onRenameConfirm,
  onRenameCancel,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  dragSourcePath,
  dragOverPath,
}: FileTreeNodeProps) {
  const isSelected = selectedPath === entry.path;
  // 🆕 FIX-016: Observable Set에서 직접 확인 → MobX가 변경 추적
  const isExpanded = expandedPaths.has(entry.path);
  const isLoading = loadingPaths.has(entry.path);

  // 인라인 리네임 상태
  const isRenaming = renamingPath === entry.path;

  // 🆕 DnD 시각적 피드백 상태
  const isDragSource = dragSourcePath === entry.path;
  const isDragOver = dragOverPath === entry.path && entry.isDirectory;

  // 🆕 FIX-027: 이 노드의 디렉토리가 인라인 생성 대상인지 확인
  const shouldShowInlineCreate =
    entry.isDirectory && isExpanded && inlineCreateParentPath === entry.path && inlineCreateType !== null;

  /**
   * 클릭 핸들러
   * - 폴더: 펼침/접힘 토글
   * - 파일: 선택
   * - FIX-033: 우클릭은 무시 (컨텍스트 메뉴용)
   */
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // FIX-033: Ignore right-click (button 2) - context menu handles it
      if (e.button !== 0) return;

      e.stopPropagation();
      onSelect(entry);

      if (entry.isDirectory) {
        onToggle(entry);
      }
    },
    [entry, onSelect, onToggle],
  );

  /**
   * 더블클릭 핸들러
   * - 파일만 이벤트 전달
   * - FIX-033: 우클릭은 무시 (컨텍스트 메뉴용)
   */
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // FIX-033: Ignore right-click (button 2) to prevent file opening on right-click
      if (e.button !== 0) return;

      e.stopPropagation();
      if (!entry.isDirectory) {
        onDoubleClick(entry);
      }
    },
    [entry, onDoubleClick],
  );

  /**
   * 우클릭 핸들러
   * - 컨텍스트 메뉴 열기
   */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(entry); // 선택 상태 변경
      onContextMenu?.(entry, e);
    },
    [entry, onSelect, onContextMenu],
  );

  /**
   * 🆕 드래그 시작 핸들러
   */
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      onDragStart?.(entry, e);
    },
    [entry, onDragStart],
  );

  /**
   * 🆕 드래그 오버 핸들러
   * 📝 FIX: e.preventDefault()를 직접 호출하여 drop 이벤트 활성화 보장
   */
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDragOver?.(entry, e);
    },
    [entry, onDragOver],
  );

  /**
   * 🆕 드래그 리브 핸들러
   */
  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      onDragLeave?.(entry, e);
    },
    [entry, onDragLeave],
  );

  /**
   * 🆕 드롭 핸들러
   * 📝 FIX: e.preventDefault()를 직접 호출하여 기본 동작 방지
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDrop?.(entry, e);
    },
    [entry, onDrop],
  );

  /**
   * 🆕 드래그 종료 핸들러
   */
  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      onDragEnd?.(e);
    },
    [onDragEnd],
  );

  /**
   * 아이콘 렌더링
   */
  const renderIcon = () => {
    // 🎯 THEME-024: Semantic color for folder/file icons
    if (entry.isDirectory) {
      const FolderIcon = getFolderIcon(isExpanded);
      return <FolderIcon className="h-4 w-4 text-status-warning shrink-0" />;
    }

    const FileIcon = getFileIcon(entry.name);
    const colorClass = getFileIconColorClass(entry.name);
    return <FileIcon className={cn("h-4 w-4 shrink-0", colorClass)} />;
  };

  /**
   * 화살표 렌더링 (디렉토리만)
   */
  const renderChevron = () => {
    if (!entry.isDirectory) {
      // 파일은 공간 유지
      return <span className="w-4 shrink-0" />;
    }

    if (isLoading) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />;
    }

    return (
      <ChevronRight
        className={cn(
          "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
          isExpanded && "rotate-90",
        )}
      />
    );
  };

  return (
    <div data-testid={`file-tree-node-${entry.name}`}>
      {/* 노드 버튼 */}
      <button
        type="button"
        draggable
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        className={cn(
          "flex items-center gap-1.5 w-full px-2 py-1 text-sm text-left rounded-sm",
          "hover:bg-accent/50 transition-colors",
          isSelected && "bg-accent text-accent-foreground",
          isDragSource && "opacity-50",
          isDragOver && "bg-primary/20 ring-1 ring-primary ring-inset",
        )}
        style={{ paddingLeft: `${depth * INDENT_SIZE + 4}px` }}
        title={entry.path}
      >
        {renderChevron()}
        {renderIcon()}
        {isRenaming && onRenameConfirm && onRenameCancel ? (
          <InlineRenameInput
            currentName={entry.name}
            isDirectory={entry.isDirectory}
            depth={depth}
            onConfirm={(newName) => onRenameConfirm(entry.path, newName)}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="truncate">{entry.name}</span>
        )}
      </button>

      {/* 하위 노드 (펼쳐진 디렉토리만) */}
      {/* 📝 FIX-016: expandedPaths/loadingPaths 전달 */}
      {/* 📝 FIX-027: 인라인 생성 입력 추가 */}
      {entry.isDirectory && isExpanded && (
        <div className="flex flex-col">
          {/* 🆕 FIX-027: 인라인 생성 입력 (children 위에 표시) */}
          {shouldShowInlineCreate && inlineCreateType && onInlineCreateConfirm && onInlineCreateCancel && (
            <InlineCreateInput
              type={inlineCreateType}
              depth={depth + 1}
              onConfirm={onInlineCreateConfirm}
              onCancel={onInlineCreateCancel}
            />
          )}
          {entry.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              loadingPaths={loadingPaths}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              inlineCreateParentPath={inlineCreateParentPath}
              inlineCreateType={inlineCreateType}
              onInlineCreateConfirm={onInlineCreateConfirm}
              onInlineCreateCancel={onInlineCreateCancel}
              renamingPath={renamingPath}
              onRenameConfirm={onRenameConfirm}
              onRenameCancel={onRenameCancel}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              dragSourcePath={dragSourcePath}
              dragOverPath={dragOverPath}
            />
          ))}
        </div>
      )}
    </div>
  );
});
