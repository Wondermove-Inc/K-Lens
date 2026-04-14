/**
 * 🎯 목적: useMentionIntegration 통합 훅
 * 02: ai-chat-panel Mention 통합
 *
 * 📝 주요 기능:
 * - mentionState와 useMentionSuggestions 통합
 * - Textarea onChange/onKeyDown 이벤트 핸들링
 * - MentionAutocomplete 렌더링 props 제공
 *
 * @packageDocumentation
 */

import { useCallback } from "react";
import { type MentionPosition, mentionState } from "../../../features/ai-assistant/common/mention-state";
import {
  type MentionSuggestionFetcher,
  type MentionSuggestionItem,
  useMentionSuggestions,
} from "../../../features/ai-assistant/renderer/hooks/use-mention-suggestions";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * useMentionIntegration 옵션
 */
export interface UseMentionIntegrationOptions {
  /** 리소스 fetcher */
  fetcher: MentionSuggestionFetcher;
  /** 항목 선택 콜백 */
  onSelect?: (item: MentionSuggestionItem) => void;
  /** 최대 결과 수 */
  limit?: number;
  /** 최근 사용 리소스 ID 목록 */
  recentlyUsed?: string[];
  /** 활성화 여부 */
  enabled?: boolean;
}

/**
 * useMentionIntegration 반환 타입
 */
export interface UseMentionIntegrationResult {
  /** 드롭다운 열림 여부 */
  isOpen: boolean;
  /** 검색 쿼리 */
  query: string;
  /** 드롭다운 위치 */
  position: MentionPosition;
  /** 제안 목록 */
  suggestions: MentionSuggestionItem[];
  /** 선택된 인덱스 */
  selectedIndex: number;
  /** 타입 필터 */
  filterType: string | null;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 트리거 인덱스 */
  triggerIndex: number;
  /** 텍스트 변경 핸들러 */
  handleTextChange: (text: string, cursorPosition: number, position: MentionPosition) => void;
  /** 네비게이션 핸들러 */
  handleNavigate: (direction: "up" | "down") => void;
  /** 항목 선택 핸들러 */
  handleSelect: (item: MentionSuggestionItem) => void;
  /** 닫기 핸들러 */
  handleClose: () => void;
  /** 키보드 이벤트 핸들러 */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

// ============================================
// 🎯 훅 구현
// ============================================

/**
 * useMentionIntegration 훅
 *
 * 📝 기능:
 * - mentionState MobX 상태와 useMentionSuggestions 훅 통합
 * - Textarea 이벤트 핸들링 제공
 * - MentionAutocomplete에 필요한 모든 props 제공
 *
 * @param options - 훅 옵션
 * @returns 통합 결과
 */
export function useMentionIntegration({
  fetcher,
  onSelect,
  limit = 10,
  recentlyUsed = [],
  enabled = true,
}: UseMentionIntegrationOptions): UseMentionIntegrationResult {
  // ============================================
  // 🔹 MobX 상태 접근
  // ============================================

  const isOpen = mentionState.isOpen;
  const query = mentionState.query;
  const position = mentionState.position;
  const selectedIndex = mentionState.selectedIndex;
  const triggerIndex = mentionState.triggerIndex;
  const filterType = mentionState.filterType;

  // ============================================
  // 🔹 useMentionSuggestions 훅 사용
  // ============================================

  const { suggestions, isLoading } = useMentionSuggestions({
    query,
    fetcher,
    limit,
    recentlyUsed,
    enabled: enabled && isOpen,
  });

  // ============================================
  // 🔹 핸들러
  // ============================================

  /**
   * 텍스트 변경 핸들러
   *
   * @param text - 입력 텍스트
   * @param cursorPosition - 커서 위치
   * @param pos - 드롭다운 표시 위치
   */
  const handleTextChange = useCallback(
    (text: string, cursorPosition: number, pos: MentionPosition) => {
      if (!enabled) {
        return;
      }

      mentionState.detectMentionTrigger(text, cursorPosition, pos);
    },
    [enabled],
  );

  /**
   * 네비게이션 핸들러 (ArrowUp/ArrowDown)
   *
   * @param direction - 이동 방향
   */
  const handleNavigate = useCallback(
    (direction: "up" | "down") => {
      mentionState.moveSelection(direction, suggestions.length);
    },
    [suggestions.length],
  );

  /**
   * 항목 선택 핸들러
   *
   * @param item - 선택된 항목
   */
  const handleSelect = useCallback(
    (item: MentionSuggestionItem) => {
      // 콜백 호출
      onSelect?.(item);

      // 멘션 닫기
      mentionState.closeMention();
    },
    [onSelect],
  );

  /**
   * 닫기 핸들러
   */
  const handleClose = useCallback(() => {
    mentionState.closeMention();
  }, []);

  /**
   * 키보드 이벤트 핸들러
   *
   * @param e - 키보드 이벤트
   * @returns 이벤트 처리 여부 (true면 기본 동작 방지)
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen) {
        return false;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          handleNavigate("down");
          return true;

        case "ArrowUp":
          e.preventDefault();
          handleNavigate("up");
          return true;

        case "Enter":
          if (suggestions[selectedIndex]) {
            e.preventDefault();
            handleSelect(suggestions[selectedIndex]);
            return true;
          }
          return false;

        case "Escape":
          e.preventDefault();
          handleClose();
          return true;

        case "Tab":
          handleClose();
          return false;

        default:
          return false;
      }
    },
    [isOpen, suggestions, selectedIndex, handleNavigate, handleSelect, handleClose],
  );

  // ============================================
  // 🔹 반환
  // ============================================

  return {
    isOpen,
    query,
    position,
    suggestions,
    selectedIndex,
    filterType,
    isLoading,
    triggerIndex,
    handleTextChange,
    handleNavigate,
    handleSelect,
    handleClose,
    handleKeyDown,
  };
}
