/**
 * 🎯 목적: 빠른 파일 검색 컴포넌트 (Ctrl+P)
 * 📝 기능:
 *   - Ctrl+P 단축키로 열기
 *   - 파일 이름 fuzzy 검색
 *   - 키보드 네비게이션 (위/아래/Enter)
 *   - 선택 시 파일 열기
 *   - ESC로 닫기
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module quick-search/quick-file-search
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Loader2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useState } from "react";
import fileExplorerStoreInjectable from "../layout/file-explorer/file-explorer-store.injectable";
import { getFileIcon, getFileIconColorClass } from "../layout/file-explorer/file-icons";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../shadcn-ui/command";
import { type SearchResultItem, useFileSearch } from "./use-file-search";

import type { FileExplorerStore } from "../layout/file-explorer/file-explorer-store";

/**
 * QuickFileSearch Props
 */
export interface QuickFileSearchProps {
  /** 파일 선택 시 콜백 */
  onFileSelect?: (filePath: string) => void;
}

interface Dependencies {
  fileExplorerStore: FileExplorerStore;
}

/**
 * 빠른 파일 검색 컴포넌트 (비주입)
 */
const NonInjectedQuickFileSearch = observer(function QuickFileSearch({
  fileExplorerStore,
  onFileSelect,
}: QuickFileSearchProps & Dependencies) {
  const [isOpen, setIsOpen] = useState(false);
  const { query, results, isSearching, search, reset } = useFileSearch(fileExplorerStore.rootEntries, 50);

  /**
   * Ctrl+P 단축키 핸들러
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+P (Windows/Linux) 또는 Cmd+P (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === "p") {
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
   * 파일 선택
   */
  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      if (!item.isDirectory) {
        onFileSelect?.(item.path);
        handleClose();
      }
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
      title="Quick File Search"
      description="Search for files in the current folder"
      showCloseButton={false}
    >
      <CommandInput placeholder="Search files by name..." value={query} onValueChange={handleSearchChange} />
      <CommandList>
        {/* 검색 중 표시 */}
        {isSearching && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Searching...</span>
          </div>
        )}

        {/* 결과 없음 */}
        {!isSearching && query && results.length === 0 && <CommandEmpty>No files found.</CommandEmpty>}

        {/* 검색어 없음 */}
        {!isSearching && !query && (
          <div className="py-6 text-center text-sm text-muted-foreground">Start typing to search files...</div>
        )}

        {/* 검색 결과 */}
        {!isSearching && results.length > 0 && (
          <CommandGroup heading={`Files (${results.length})`}>
            {results.map((item) => {
              const Icon = getFileIcon(item.path);
              const colorClass = getFileIconColorClass(item.path);

              return (
                <CommandItem
                  key={item.path}
                  value={item.path}
                  onSelect={() => handleSelect(item)}
                  className="flex items-center gap-2"
                >
                  <span className={colorClass}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground text-xs ml-2 truncate">
                      {item.path.replace(fileExplorerStore.rootPath || "", "")}
                    </span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>

      {/* 하단 힌트 */}
      <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">↑↓</kbd> Navigate{" "}
          <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">Enter</kbd> Select{" "}
          <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">Esc</kbd> Close
        </span>
        <span className="text-muted-foreground/60">{fileExplorerStore.rootPath?.split("/").pop()}</span>
      </div>
    </CommandDialog>
  );
});

/**
 * 빠른 파일 검색 컴포넌트 (DI 주입)
 */
export const QuickFileSearch = withInjectables<Dependencies, QuickFileSearchProps>(NonInjectedQuickFileSearch, {
  getProps: (di, props) => ({
    ...props,
    fileExplorerStore: di.inject(fileExplorerStoreInjectable),
  }),
});
