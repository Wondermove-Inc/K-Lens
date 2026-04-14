/**
 * 🎯 목적: useMentionSuggestions 훅
 * 01: useMentionSuggestions 훅 구현
 *
 * 📝 주요 기능:
 * - 쿼리 기반 리소스 제안
 * - 타입 접두사 파싱 (pod:, deployment: 등)
 * - Debounce 적용
 * - 최근 사용 리소스 우선 정렬
 *
 * @packageDocumentation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ContextTypeValue } from "../../common/context-types";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 멘션 제안 아이템
 */
export interface MentionSuggestionItem {
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
 * 멘션 제안 fetcher 타입
 */
export type MentionSuggestionFetcher = (type?: string) => Promise<MentionSuggestionItem[]>;

/**
 * useMentionSuggestions 훅 옵션
 */
export interface UseMentionSuggestionsOptions {
  /** 검색 쿼리 */
  query: string;
  /** 리소스 fetcher */
  fetcher: MentionSuggestionFetcher;
  /** 최대 결과 수 (기본값: 10) */
  limit?: number;
  /** Debounce 시간 (기본값: 200ms) */
  debounceMs?: number;
  /** 최근 사용 리소스 ID 목록 */
  recentlyUsed?: string[];
  /** 활성화 여부 (기본값: true) */
  enabled?: boolean;
}

/**
 * useMentionSuggestions 훅 반환 타입
 */
export interface UseMentionSuggestionsResult {
  /** 제안 목록 */
  suggestions: MentionSuggestionItem[];
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 */
  error: Error | null;
  /** 감지된 타입 필터 */
  filterType: string | null;
}

// ============================================
// 🎯 상수 정의
// ============================================

const DEFAULT_LIMIT = 10;
const DEFAULT_DEBOUNCE_MS = 200;

/**
 * 타입 접두사 파싱 정규식
 * 📝 @type:query 또는 type:query 형식 지원
 */
const TYPE_PREFIX_REGEX = /^@?(\w+):(.*)$/;

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 쿼리에서 타입과 검색어를 분리합니다
 *
 * @param query - 검색 쿼리
 * @returns 타입과 검색어
 */
function parseQuery(query: string): { type: string | null; search: string } {
  const match = query.match(TYPE_PREFIX_REGEX);

  if (match) {
    return {
      type: match[1].toLowerCase(),
      search: match[2].toLowerCase(),
    };
  }

  return {
    type: null,
    search: query.toLowerCase(),
  };
}

/**
 * 제안 목록을 필터링합니다
 *
 * @param items - 원본 아이템 목록
 * @param type - 타입 필터 (nullable)
 * @param search - 검색어
 * @returns 필터링된 아이템 목록
 */
function filterSuggestions(
  items: MentionSuggestionItem[],
  type: string | null,
  search: string,
): MentionSuggestionItem[] {
  return items.filter((item) => {
    // 타입 필터
    if (type && item.type.toLowerCase() !== type) {
      return false;
    }

    // 검색어 필터 (이름에 포함)
    if (search && !item.name.toLowerCase().includes(search)) {
      return false;
    }

    return true;
  });
}

/**
 * 제안 목록을 정렬합니다 (최근 사용 우선)
 *
 * @param items - 아이템 목록
 * @param recentlyUsed - 최근 사용 ID 목록
 * @returns 정렬된 아이템 목록
 */
function sortSuggestions(items: MentionSuggestionItem[], recentlyUsed: string[]): MentionSuggestionItem[] {
  if (recentlyUsed.length === 0) {
    return items;
  }

  const recentSet = new Set(recentlyUsed);

  return [...items].sort((a, b) => {
    const aRecent = recentSet.has(a.id);
    const bRecent = recentSet.has(b.id);

    if (aRecent && !bRecent) return -1;
    if (!aRecent && bRecent) return 1;

    // 둘 다 최근 사용이면 최근 순서대로
    if (aRecent && bRecent) {
      return recentlyUsed.indexOf(a.id) - recentlyUsed.indexOf(b.id);
    }

    return 0;
  });
}

// ============================================
// 🎯 훅 구현
// ============================================

/**
 * useMentionSuggestions 훅
 *
 * 📝 기능:
 * - 쿼리 기반 리소스 제안
 * - 타입 접두사 파싱 (pod:, deployment: 등)
 * - Debounce 적용
 * - 최근 사용 리소스 우선 정렬
 *
 * @param options - 훅 옵션
 * @returns 제안 결과
 */
export function useMentionSuggestions({
  query,
  fetcher,
  limit = DEFAULT_LIMIT,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  recentlyUsed = [],
  enabled = true,
}: UseMentionSuggestionsOptions): UseMentionSuggestionsResult {
  const [suggestions, setSuggestions] = useState<MentionSuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 쿼리 파싱
  const { type: filterType, search } = useMemo(() => parseQuery(query), [query]);

  // 데이터 페치
  const fetchSuggestions = useCallback(async () => {
    if (!enabled) {
      setSuggestions([]);
      return;
    }

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      // fetcher 호출 (타입 필터 전달)
      const items = await fetcher(filterType ?? undefined);

      // 필터링 및 정렬
      const filtered = filterSuggestions(items, filterType, search);
      const sorted = sortSuggestions(filtered, recentlyUsed);
      const limited = sorted.slice(0, limit);

      setSuggestions(limited);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // 취소된 요청 무시
      }

      setError(err instanceof Error ? err : new Error(String(err)));
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, fetcher, filterType, search, recentlyUsed, limit]);

  // Debounced fetch
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // 기존 타이머 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 새 타이머 설정
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, debounceMs, enabled, fetchSuggestions]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    filterType,
  };
}
