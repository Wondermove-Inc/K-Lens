/**
 * 🎯 목적: 전역 파일 내용 검색 훅
 * 📝 기능:
 *   - IPC를 통한 파일 내용 검색
 *   - 디바운스 적용 (500ms)
 *   - 검색 옵션 (대소문자, 정규식)
 *   - 검색 결과 캐싱
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module quick-search/use-global-search
 */

import { ipcRenderer } from "electron";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fileSystemChannels,
  type SearchContentRequest,
  type SearchContentResponse,
  type SearchMatch,
} from "../../../common/ipc/filesystem";

/**
 * 전역 검색 옵션
 */
export interface GlobalSearchOptions {
  /** 대소문자 구분 여부 */
  caseSensitive: boolean;
  /** 정규식 사용 여부 */
  useRegex: boolean;
  /** 최대 결과 수 */
  maxResults: number;
}

/**
 * 전역 검색 결과
 */
export interface GlobalSearchResult {
  /** 검색 결과 목록 */
  matches: SearchMatch[];
  /** 총 매치 수 */
  totalMatches: number;
  /** 검색된 파일 수 */
  filesSearched: number;
  /** 검색 소요 시간 (ms) */
  elapsedMs?: number;
}

/**
 * 전역 검색 상태
 */
export interface GlobalSearchState {
  /** 검색어 */
  query: string;
  /** 검색 결과 */
  result: GlobalSearchResult | null;
  /** 검색 중 여부 */
  isSearching: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 검색 옵션 */
  options: GlobalSearchOptions;
}

/**
 * 기본 검색 옵션
 */
const DEFAULT_OPTIONS: GlobalSearchOptions = {
  caseSensitive: false,
  useRegex: false,
  maxResults: 100,
};

/**
 * 전역 파일 내용 검색 훅
 * @param rootPath - 검색 대상 루트 경로
 */
export function useGlobalSearch(rootPath: string | null) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<GlobalSearchOptions>(DEFAULT_OPTIONS);

  // 검색 취소용 ref
  const searchIdRef = useRef(0);

  /**
   * 디바운스 처리 (500ms)
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  /**
   * 검색 실행
   */
  useEffect(() => {
    if (!rootPath || !debouncedQuery.trim()) {
      setResult(null);
      setError(null);
      return;
    }

    const currentSearchId = ++searchIdRef.current;

    const executeSearch = async () => {
      setIsSearching(true);
      setError(null);

      try {
        const request: SearchContentRequest = {
          rootPath,
          query: debouncedQuery,
          caseSensitive: options.caseSensitive,
          useRegex: options.useRegex,
          maxResults: options.maxResults,
        };

        const response = (await ipcRenderer.invoke(fileSystemChannels.searchContent, request)) as SearchContentResponse;

        // 검색 취소됨
        if (currentSearchId !== searchIdRef.current) {
          return;
        }

        if (response.success) {
          setResult({
            matches: response.matches,
            totalMatches: response.totalMatches,
            filesSearched: response.filesSearched,
            elapsedMs: response.elapsedMs,
          });
          setError(null);
        } else {
          setResult(null);
          setError(response.error || "Search failed");
        }
      } catch (err) {
        if (currentSearchId !== searchIdRef.current) {
          return;
        }
        setResult(null);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (currentSearchId === searchIdRef.current) {
          setIsSearching(false);
        }
      }
    };

    executeSearch();
  }, [rootPath, debouncedQuery, options]);

  /**
   * 검색어 변경
   */
  const search = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  /**
   * 검색 옵션 업데이트
   */
  const updateOptions = useCallback((newOptions: Partial<GlobalSearchOptions>) => {
    setOptions((prev) => ({ ...prev, ...newOptions }));
  }, []);

  /**
   * 검색 초기화
   */
  const reset = useCallback(() => {
    searchIdRef.current++;
    setQuery("");
    setDebouncedQuery("");
    setResult(null);
    setError(null);
    setIsSearching(false);
  }, []);

  /**
   * 대소문자 구분 토글
   */
  const toggleCaseSensitive = useCallback(() => {
    setOptions((prev) => ({ ...prev, caseSensitive: !prev.caseSensitive }));
  }, []);

  /**
   * 정규식 사용 토글
   */
  const toggleRegex = useCallback(() => {
    setOptions((prev) => ({ ...prev, useRegex: !prev.useRegex }));
  }, []);

  return {
    query,
    result,
    isSearching,
    error,
    options,
    search,
    updateOptions,
    reset,
    toggleCaseSensitive,
    toggleRegex,
  };
}
