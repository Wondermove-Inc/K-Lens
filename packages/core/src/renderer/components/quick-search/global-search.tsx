/**
 * 🎯 목적: 전역 파일 내용 검색 컴포넌트 (Ctrl+Shift+F)
 * 📝 기능:
 *   - Ctrl+Shift+F 단축키로 열기
 *   - 파일 내용 검색
 *   - 대소문자 구분, 정규식 옵션
 *   - 키보드 네비게이션
 *   - 선택 시 파일 열기 (해당 라인으로)
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module quick-search/global-search
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { AlertCircle, CaseSensitive, Loader2, Regex, Search } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import fileExplorerStoreInjectable from "../layout/file-explorer/file-explorer-store.injectable";
import { getFileIcon, getFileIconColorClass } from "../layout/file-explorer/file-icons";
import { Button } from "../shadcn-ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandItem, CommandList } from "../shadcn-ui/command";
import { useGlobalSearch } from "./use-global-search";

import type { SearchMatch } from "../../../common/ipc/filesystem";
import type { FileExplorerStore } from "../layout/file-explorer/file-explorer-store";

/**
 * GlobalSearch Props
 */
export interface GlobalSearchProps {
  /** 파일 선택 시 콜백 (파일 경로, 라인 번호) */
  onFileSelect?: (filePath: string, lineNumber?: number) => void;
}

interface Dependencies {
  fileExplorerStore: FileExplorerStore;
}

/**
 * 검색 결과를 파일별로 그룹화
 */
function groupMatchesByFile(matches: SearchMatch[]): Map<string, SearchMatch[]> {
  const grouped = new Map<string, SearchMatch[]>();

  for (const match of matches) {
    const existing = grouped.get(match.filePath) || [];
    existing.push(match);
    grouped.set(match.filePath, existing);
  }

  return grouped;
}

/**
 * 전역 검색 컴포넌트 (비주입)
 */
const NonInjectedGlobalSearch = observer(function GlobalSearch({
  fileExplorerStore,
  onFileSelect,
}: GlobalSearchProps & Dependencies) {
  const [isOpen, setIsOpen] = useState(false);

  const { query, result, isSearching, error, options, search, reset, toggleCaseSensitive, toggleRegex } =
    useGlobalSearch(fileExplorerStore.rootPath);

  /**
   * Ctrl+Shift+F 단축키 핸들러
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+F (Windows/Linux) 또는 Cmd+Shift+F (Mac)
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "f") {
        event.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /**
   * 다이얼로그 닫기
   */
  const handleClose = useCallback(() => {
    setIsOpen(false);
    reset();
  }, [reset]);

  /**
   * 검색 결과 선택
   */
  const handleSelect = useCallback(
    (match: SearchMatch) => {
      onFileSelect?.(match.filePath, match.lineNumber);
      handleClose();
    },
    [onFileSelect, handleClose],
  );

  /**
   * 검색어 변경
   */
  const handleSearchChange = useCallback(
    (value: string) => {
      search(value);
    },
    [search],
  );

  /**
   * 파일별 그룹화된 결과
   */
  const groupedMatches = useMemo(() => {
    if (!result?.matches) return new Map();
    return groupMatchesByFile(result.matches);
  }, [result?.matches]);

  /**
   * 상대 경로 계산
   */
  const getRelativePath = useCallback(
    (filePath: string) => {
      if (!fileExplorerStore.rootPath) return filePath;
      return filePath.replace(fileExplorerStore.rootPath, "").replace(/^\//, "");
    },
    [fileExplorerStore.rootPath],
  );

  // 폴더가 열려있지 않으면 아무것도 표시하지 않음
  if (!fileExplorerStore.rootPath) {
    return null;
  }

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
        else setIsOpen(true);
      }}
      title="Search in Files"
      description="Search for text in all files"
      showCloseButton={false}
    >
      {/* 검색 입력 영역 */}
      <div className="flex items-center border-b px-3">
        <Search className="h-4 w-4 text-muted-foreground mr-2" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search in files..."
          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          autoFocus
        />

        {/* 검색 옵션 버튼 */}
        <div className="flex items-center gap-1 ml-2">
          <Button
            variant={options.caseSensitive ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={toggleCaseSensitive}
            title="Match Case (Alt+C)"
          >
            <CaseSensitive className="h-4 w-4" />
          </Button>
          <Button
            variant={options.useRegex ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={toggleRegex}
            title="Use Regular Expression (Alt+R)"
          >
            <Regex className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CommandList className="max-h-[400px]">
        {/* 검색 중 표시 */}
        {isSearching && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Searching...</span>
          </div>
        )}

        {/* 에러 표시 */}
        {error && !isSearching && (
          <div className="flex items-center justify-center py-6 text-destructive">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* 검색어 없음 */}
        {!isSearching && !query && !error && (
          <div className="py-6 text-center text-sm text-muted-foreground">Type to search in files...</div>
        )}

        {/* 결과 없음 */}
        {!isSearching && query && !error && result?.matches.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {/* 검색 결과 */}
        {!isSearching && result && result.matches.length > 0 && (
          <>
            {Array.from(groupedMatches.entries()).map(([filePath, matches]: [string, SearchMatch[]]) => {
              const Icon = getFileIcon(filePath);
              const colorClass = getFileIconColorClass(filePath);
              const relativePath = getRelativePath(filePath);
              const fileName = filePath.split("/").pop() || filePath;

              return (
                <CommandGroup
                  key={filePath}
                  heading={
                    <div className="flex items-center gap-2">
                      <span className={colorClass}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="font-medium">{fileName}</span>
                      <span className="text-muted-foreground text-xs">{relativePath}</span>
                      <span className="text-muted-foreground text-xs ml-auto">
                        {matches.length} match{matches.length > 1 ? "es" : ""}
                      </span>
                    </div>
                  }
                >
                  {matches.map((match: SearchMatch, index: number) => (
                    <CommandItem
                      key={`${match.filePath}:${match.lineNumber}:${index}`}
                      value={`${match.filePath}:${match.lineNumber}`}
                      onSelect={() => handleSelect(match)}
                      className="flex items-start gap-2 py-1.5"
                    >
                      <span className="text-muted-foreground text-xs w-8 text-right shrink-0">{match.lineNumber}</span>
                      <span className="text-sm font-mono truncate">
                        <HighlightedLine
                          content={match.lineContent}
                          matchStart={match.matchStart}
                          matchEnd={match.matchEnd}
                        />
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </>
        )}
      </CommandList>

      {/* 하단 상태 표시 */}
      <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> Navigate{" "}
          <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">Enter</kbd> Open{" "}
          <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> Close
        </span>
        {result && (
          <span className="text-muted-foreground/60">
            {result.totalMatches} result{result.totalMatches !== 1 ? "s" : ""} in {result.filesSearched} file
            {result.filesSearched !== 1 ? "s" : ""}
            {result.elapsedMs !== undefined && ` (${result.elapsedMs}ms)`}
          </span>
        )}
      </div>
    </CommandDialog>
  );
});

/**
 * 하이라이트된 라인 표시
 */
function HighlightedLine({ content, matchStart, matchEnd }: { content: string; matchStart: number; matchEnd: number }) {
  const before = content.substring(0, matchStart);
  const match = content.substring(matchStart, matchEnd);
  const after = content.substring(matchEnd);

  // 🎯 THEME-024: CSS 변수 기반 하이라이트 색상 적용
  return (
    <>
      <span className="text-muted-foreground">{before}</span>
      <span className="bg-highlight text-foreground font-semibold px-0.5 rounded">{match}</span>
      <span className="text-muted-foreground">{after}</span>
    </>
  );
}

/**
 * 전역 검색 컴포넌트 (DI 주입)
 */
export const GlobalSearch = withInjectables<Dependencies, GlobalSearchProps>(NonInjectedGlobalSearch, {
  getProps: (di, props) => ({
    ...props,
    fileExplorerStore: di.inject(fileExplorerStoreInjectable),
  }),
});
