/**
 * 🎯 목적: SlashCommandPalette 컴포넌트
 * 01: SlashCommandPalette UI 구현
 *
 * 📝 주요 기능:
 * - 슬래시 명령어 목록 표시 (카테고리별 그룹화)
 * - 검색 필터링
 * - 키보드 네비게이션 (화살표, Enter, Escape)
 *
 * @packageDocumentation
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAllSlashCommands,
  getSlashCommandByName,
  type SlashCommand,
  SlashCommandCategory,
  type SlashCommandCategoryType,
  searchSlashCommands,
  syncSlashCommandEnabled,
} from "../../../features/ai-assistant/common/slash-commands";
import { cn } from "../../lib/utils";
import { Input } from "../shadcn-ui/input";
import { ScrollArea } from "../shadcn-ui/scroll-area";

/**
 * SlashCommandPalette 컴포넌트 props
 */
export interface SlashCommandPaletteProps {
  /** 팔레트 표시 여부 */
  isOpen: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 명령어 선택 콜백 (Enter/클릭 - 명령어 실행) */
  onSelect: (command: SlashCommand) => void;
  /**
   * 🎯 Tab 자동완성 콜백 (Tab - 입력창에만 채우기)
   * 📝 2026-01-28: Tab과 Enter 동작 분리
   * - Tab: 입력창에 명령어만 채우고 실행하지 않음 (onAutoComplete)
   * - Enter: 명령어 실행 (onSelect)
   * - 미제공 시 onSelect로 fallback
   */
  onAutoComplete?: (command: SlashCommand) => void;
  /** 검색어 */
  searchQuery?: string;
  /** 검색어 변경 콜백 */
  onSearchChange?: (query: string) => void;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 카테고리 라벨 (영문)
 */
const CATEGORY_LABELS: Record<SlashCommandCategoryType, string> = {
  [SlashCommandCategory.GENERAL]: "General",
  [SlashCommandCategory.KUBERNETES]: "Kubernetes",
  [SlashCommandCategory.DIAGNOSTICS]: "Diagnostics",
  [SlashCommandCategory.NAVIGATION]: "Navigation",
  [SlashCommandCategory.PROBLEM_SOLVING]: "Problem Solving",
  [SlashCommandCategory.INFRASTRUCTURE]: "Infrastructure",
  [SlashCommandCategory.RESEARCH]: "Research",
};

/**
 * 카테고리 순서
 */
const CATEGORY_ORDER: SlashCommandCategoryType[] = [
  SlashCommandCategory.GENERAL,
  SlashCommandCategory.KUBERNETES,
  SlashCommandCategory.DIAGNOSTICS,
  SlashCommandCategory.NAVIGATION,
  SlashCommandCategory.PROBLEM_SOLVING,
  SlashCommandCategory.INFRASTRUCTURE,
  SlashCommandCategory.RESEARCH,
];

/**
 * 슬래시 명령어 팔레트 컴포넌트
 *
 * 📝 기능:
 * - 명령어 목록을 카테고리별로 그룹화하여 표시
 * - 검색어로 필터링
 * - 키보드 네비게이션 지원
 */
export function SlashCommandPalette({
  isOpen,
  onClose,
  onSelect,
  onAutoComplete,
  searchQuery = "",
  onSearchChange,
  className,
}: SlashCommandPaletteProps) {
  // 하이라이트된 인덱스
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Force re-filter when skill enabled state changes
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handler = (e: Event) => {
      // Sync disabled IDs from cross-frame event (iframe → root frame)
      const detail = (e as CustomEvent).detail;

      if (detail?.disabledIds) {
        syncSlashCommandEnabled(new Set(detail.disabledIds));
      }
      setRefreshKey((k) => k + 1);
    };

    window.addEventListener("daive:skills-changed", handler);

    return () => window.removeEventListener("daive:skills-changed", handler);
  }, []);

  // 명령어 목록 (검색 필터링)
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) {
      return getAllSlashCommands({ enabledOnly: true });
    }

    return searchSlashCommands(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, isOpen, refreshKey]);

  // 카테고리별 그룹화
  const groupedCommands = useMemo(() => {
    const groups = new Map<SlashCommandCategoryType, SlashCommand[]>();

    for (const category of CATEGORY_ORDER) {
      groups.set(category, []);
    }

    for (const cmd of filteredCommands) {
      const list = groups.get(cmd.category);

      if (list) {
        list.push(cmd);
      }
    }

    return groups;
  }, [filteredCommands]);

  // 검색 결과 변경 시 인덱스 리셋
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // 선택된 항목으로 스크롤
  useEffect(() => {
    const itemEl = itemRefs.current.get(highlightedIndex);

    // jsdom에서는 scrollIntoView가 없으므로 optional chaining 사용
    if (itemEl && typeof itemEl.scrollIntoView === "function") {
      itemEl.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  /**
   * 🎯 목적: 키보드 이벤트 핸들러
   *
   * 📝 2026-01-06 UX 개선:
   * - Tab: 현재 하이라이트된 명령어 자동완성 (선택)
   * - Enter: 명령어 선택
   * - Escape: 팔레트 닫기
   *
   * 🔄 변경이력:
   * - 2026-01-06 - Tab 자동완성 추가
   * - 2026-01-28 - Tab과 Enter 동작 분리 (Tab은 자동완성만, Enter는 실행)
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : prev));
          break;

        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;

        case "Tab":
          // 🎯 2026-01-28: Tab 자동완성 - 입력창에만 채우기 (실행 안함)
          // onAutoComplete가 있으면 자동완성 전용 콜백 호출
          // 없으면 onSelect로 fallback (기존 동작 유지)
          e.preventDefault();

          if (filteredCommands[highlightedIndex]) {
            const handler = onAutoComplete ?? onSelect;
            handler(filteredCommands[highlightedIndex]);
          }
          break;

        case "Enter":
          // 🎯 Enter: 명령어 실행 (특수 명령어는 즉시 실행)
          e.preventDefault();

          if (filteredCommands[highlightedIndex]) {
            onSelect(filteredCommands[highlightedIndex]);
          }
          break;

        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, highlightedIndex, onClose, onSelect, onAutoComplete],
  );

  // 아이템 클릭 핸들러
  const handleItemClick = useCallback(
    (cmd: SlashCommand) => {
      onSelect(cmd);
    },
    [onSelect],
  );

  /**
   * 🎯 목적: 검색어 변경 핸들러
   *
   * 📝 2026-01-06 UX 개선:
   * - 공백 입력 시 유효한 명령어면 명령어 선택하여 팔레트 닫기
   * - 그렇지 않으면 검색어만 업데이트
   *
   * 🔄 변경이력: 2026-01-06 - 공백 입력 시 자동 선택 로직 추가
   */
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // 🎯 공백이 있으면 명령어 선택 시도
      const spaceIndex = value.indexOf(" ");

      if (spaceIndex > 0) {
        const commandPart = value.slice(0, spaceIndex);
        const foundCommand = getSlashCommandByName(commandPart);

        if (foundCommand) {
          // 유효한 명령어면 선택 (팔레트 닫히고 프롬프트 입력 모드)
          onSelect(foundCommand);

          return;
        }
      }

      // 일반 검색어 업데이트
      onSearchChange?.(value);
    },
    [onSearchChange, onSelect],
  );

  // 아이템 ref 설정
  const setItemRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      itemRefs.current.set(index, el);
    } else {
      itemRefs.current.delete(index);
    }
  }, []);

  // 닫힌 상태면 렌더링 안함
  if (!isOpen) {
    return null;
  }

  // 전체 인덱스 계산용
  let globalIndex = 0;

  return (
    <div
      data-testid="slash-command-palette"
      className={cn(
        "absolute bottom-full left-0 mb-2 w-full max-w-md",
        "rounded-lg border border-border bg-popover shadow-lg",
        "z-50",
        className,
      )}
      role="listbox"
      aria-label="Slash command list"
    >
      {/* Search input */}
      {/* 🎯 2026-01-06: autoFocus 제거 - 포커스를 Textarea에 유지
          - 사용자가 팔레트에서 검색하고 싶으면 직접 클릭
          - Textarea에서 방향키, Tab, Enter로 명령어 선택 가능 */}
      <div className="p-2 border-b border-border">
        <Input
          type="text"
          onKeyDown={handleKeyDown}
          placeholder="Search commands..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="h-8"
        />
      </div>

      {/* Command list */}
      <ScrollArea className="max-h-64">
        <div ref={listRef} className="p-1">
          {filteredCommands.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No results found</div>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const commands = groupedCommands.get(category) ?? [];

              if (commands.length === 0) {
                return null;
              }

              return (
                <div key={category} className="mb-2">
                  {/* 카테고리 헤더 */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {CATEGORY_LABELS[category]}
                  </div>

                  {/* 명령어 목록 */}
                  {commands.map((cmd) => {
                    const currentIndex = globalIndex++;
                    const isHighlighted = currentIndex === highlightedIndex;

                    return (
                      <div
                        key={cmd.id}
                        ref={(el) => setItemRef(currentIndex, el)}
                        data-testid="slash-command-item"
                        data-highlighted={isHighlighted ? "true" : "false"}
                        className={cn(
                          "flex items-center gap-3 px-2 py-1.5 rounded-md cursor-pointer",
                          "transition-colors",
                          isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                        )}
                        onClick={() => handleItemClick(cmd)}
                        role="option"
                        aria-selected={isHighlighted}
                      >
                        {/* 아이콘 */}
                        {cmd.icon && (
                          <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">
                            {/* 아이콘은 lucide-react 사용 예정, 일단 텍스트로 */}
                            <span className="text-xs">⌘</span>
                          </span>
                        )}

                        {/* 명령어 정보 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">{cmd.name}</span>
                            {cmd.label && <span className="text-xs text-muted-foreground">{cmd.label}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
