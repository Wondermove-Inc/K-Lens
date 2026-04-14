/**
 * 🎯 목적: MentionAutocomplete 컴포넌트
 * 02: MentionAutocomplete UI 구현
 *
 * 📝 주요 기능:
 * - @ 멘션 자동완성 드롭다운 UI
 * - 리소스 타입 아이콘, 이름, 네임스페이스 표시
 * - 키보드 네비게이션 지원
 * - 검색어 하이라이트
 *
 * @packageDocumentation
 */

import React, { useCallback, useEffect, useRef } from "react";
import { ContextIcon } from "../../../features/ai-assistant/renderer/components/context-icon";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../shadcn-ui/scroll-area";

import type { ContextTypeValue } from "../../../features/ai-assistant/common/context-types";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 멘션 제안 아이템
 */
export interface MentionSuggestion {
  /** 고유 ID */
  id: string;
  /** 컨텍스트 타입 */
  type: ContextTypeValue;
  /** 리소스 이름 */
  name: string;
  /** 네임스페이스 */
  namespace?: string;
}

/**
 * MentionAutocomplete 컴포넌트 props
 */
export interface MentionAutocompleteProps {
  /** 드롭다운 표시 여부 */
  isOpen: boolean;
  /** 드롭다운 위치 */
  position: { top: number; left: number };
  /** 검색 쿼리 */
  query: string;
  /** 제안 목록 */
  suggestions: MentionSuggestion[];
  /** 선택된 인덱스 */
  selectedIndex: number;
  /** 항목 선택 콜백 */
  onSelect: (suggestion: MentionSuggestion) => void;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 네비게이션 콜백 */
  onNavigate: (direction: "up" | "down") => void;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 타입 필터 */
  filterType?: string;
  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 🎯 상수 정의
// ============================================

/** 최대 표시 항목 수 */
const MAX_VISIBLE_ITEMS = 10;

// ============================================
// 🎯 하이라이트 컴포넌트
// ============================================

/**
 * 검색어 하이라이트 컴포넌트
 */
function HighlightText({ text, query }: { text: string; query: string }): React.ReactElement {
  if (!query.trim()) {
    return <span>{text}</span>;
  }

  // 타입 접두사 제거 (pod:, deployment: 등)
  const cleanQuery = query.includes(":") ? query.split(":")[1] : query;

  if (!cleanQuery.trim()) {
    return <span>{text}</span>;
  }

  const regex = new RegExp(`(${cleanQuery})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} data-testid="highlight-match" className="font-bold text-primary">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

// ============================================
// 🎯 메인 컴포넌트
// ============================================

/**
 * MentionAutocomplete 컴포넌트
 *
 * 📝 기능:
 * - @ 멘션 자동완성 드롭다운
 * - 리소스 목록 표시 (아이콘, 이름, 네임스페이스)
 * - 키보드 네비게이션
 * - 검색어 하이라이트
 */
export function MentionAutocomplete({
  isOpen,
  position,
  query,
  suggestions,
  selectedIndex,
  onSelect,
  onClose,
  onNavigate,
  isLoading = false,
  filterType,
  className,
}: MentionAutocompleteProps): React.ReactElement | null {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // 외부 클릭 감지
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // 선택된 항목으로 스크롤
  useEffect(() => {
    const itemEl = itemRefs.current.get(selectedIndex);

    if (itemEl && typeof itemEl.scrollIntoView === "function") {
      itemEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          onNavigate("down");
          break;

        case "ArrowUp":
          e.preventDefault();
          onNavigate("up");
          break;

        case "Enter":
          e.preventDefault();

          if (suggestions[selectedIndex]) {
            onSelect(suggestions[selectedIndex]);
          }
          break;

        case "Escape":
        case "Tab":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [suggestions, selectedIndex, onSelect, onClose, onNavigate],
  );

  // 아이템 클릭 핸들러
  const handleItemClick = useCallback(
    (suggestion: MentionSuggestion) => {
      onSelect(suggestion);
    },
    [onSelect],
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

  // 표시할 제안 목록 (최대 10개)
  const visibleSuggestions = suggestions.slice(0, MAX_VISIBLE_ITEMS);

  return (
    <div
      ref={dropdownRef}
      data-testid="mention-autocomplete"
      className={cn(
        "absolute z-50",
        "min-w-[280px] max-w-[400px]",
        "rounded-lg border border-border bg-popover shadow-lg",
        className,
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="멘션 자동완성"
      tabIndex={0}
    >
      {/* 타입 필터 힌트 */}
      {filterType && (
        <div className="px-3 py-1.5 border-b border-border text-xs text-muted-foreground">
          <span className="font-medium capitalize">{filterType}</span> 검색 중...
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && <div className="px-3 py-6 text-center text-sm text-muted-foreground">검색 중...</div>}

      {/* 빈 상태 */}
      {!isLoading && suggestions.length === 0 && (
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">검색 결과가 없습니다</div>
      )}

      {/* 제안 목록 */}
      {!isLoading && suggestions.length > 0 && (
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {visibleSuggestions.map((suggestion, index) => {
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={suggestion.id}
                  ref={(el) => setItemRef(index, el)}
                  data-testid="mention-item"
                  data-selected={isSelected ? "true" : "false"}
                  className={cn(
                    "flex items-center gap-3 px-2 py-1.5 rounded-md cursor-pointer",
                    "transition-colors",
                    isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                  )}
                  onClick={() => handleItemClick(suggestion)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* 타입 아이콘 */}
                  <ContextIcon type={suggestion.type} size={14} />

                  {/* 리소스 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      <HighlightText text={suggestion.name} query={query} />
                    </div>
                    {suggestion.namespace && (
                      <div className="text-xs text-muted-foreground truncate">{suggestion.namespace}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* 더 많은 결과 힌트 */}
      {suggestions.length > MAX_VISIBLE_ITEMS && (
        <div className="px-3 py-1.5 border-t border-border text-xs text-muted-foreground text-center">
          +{suggestions.length - MAX_VISIBLE_ITEMS}개 더 있음
        </div>
      )}
    </div>
  );
}

MentionAutocomplete.displayName = "MentionAutocomplete";
