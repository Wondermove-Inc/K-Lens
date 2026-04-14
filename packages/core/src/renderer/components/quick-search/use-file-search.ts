/**
 * 🎯 목적: 파일 검색 로직 훅
 * 📝 기능:
 *   - FileExplorerStore의 파일 목록에서 검색
 *   - Fuzzy 검색 (파일명 일부 매칭)
 *   - 디바운스 적용 (300ms)
 *   - 최대 50개 결과 제한
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module quick-search/use-file-search
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type { FileEntry } from "../layout/file-explorer/file-explorer.types";

/**
 * 검색 결과 아이템
 */
export interface SearchResultItem {
  /** 파일명 */
  name: string;
  /** 전체 경로 */
  path: string;
  /** 디렉토리 여부 */
  isDirectory: boolean;
  /** 검색 매칭 점수 */
  score: number;
}

/**
 * 파일 검색 결과
 */
export interface FileSearchResult {
  /** 검색 결과 목록 */
  results: SearchResultItem[];
  /** 검색 중 여부 */
  isSearching: boolean;
  /** 검색 쿼리 */
  query: string;
}

/**
 * 파일 트리에서 모든 파일을 평탄화
 */
function flattenFileTree(entries: FileEntry[]): FileEntry[] {
  const result: FileEntry[] = [];

  function traverse(items: FileEntry[]) {
    for (const item of items) {
      // 디렉토리가 아닌 파일만 추가
      if (!item.isDirectory) {
        result.push(item);
      }
      // 자식이 있으면 재귀 탐색
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(entries);
  return result;
}

/**
 * 간단한 fuzzy 검색 점수 계산
 * - 완전 일치: 100점
 * - 시작 일치: 80점
 * - 포함: 60점
 * - 부분 매칭 (연속 문자): 40 + 매칭 비율
 */
function calculateMatchScore(fileName: string, query: string): number {
  const lowerFileName = fileName.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // 완전 일치
  if (lowerFileName === lowerQuery) {
    return 100;
  }

  // 시작 일치
  if (lowerFileName.startsWith(lowerQuery)) {
    return 80;
  }

  // 포함
  if (lowerFileName.includes(lowerQuery)) {
    return 60;
  }

  // Fuzzy 매칭: 쿼리의 모든 문자가 순서대로 포함되는지 확인
  let queryIndex = 0;
  let matchCount = 0;

  for (let i = 0; i < lowerFileName.length && queryIndex < lowerQuery.length; i++) {
    if (lowerFileName[i] === lowerQuery[queryIndex]) {
      matchCount++;
      queryIndex++;
    }
  }

  // 모든 쿼리 문자가 매칭되었으면 점수 계산
  if (queryIndex === lowerQuery.length) {
    const ratio = matchCount / lowerFileName.length;
    return 40 + ratio * 20;
  }

  return 0; // 매칭 안됨
}

/**
 * 파일 검색 훅
 */
export function useFileSearch(rootEntries: FileEntry[], maxResults = 50) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // 디바운스 처리
  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // 평탄화된 파일 목록 (메모이제이션)
  const flatFiles = useMemo(() => flattenFileTree(rootEntries), [rootEntries]);

  // 검색 결과 계산 (메모이제이션)
  const results = useMemo((): SearchResultItem[] => {
    if (!debouncedQuery.trim()) {
      // 검색어 없으면 최근 파일 또는 빈 배열 반환
      return [];
    }

    const scored = flatFiles
      .map((file) => ({
        name: file.name,
        path: file.path,
        isDirectory: file.isDirectory,
        score: calculateMatchScore(file.name, debouncedQuery),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return scored;
  }, [flatFiles, debouncedQuery, maxResults]);

  // 검색어 변경
  const search = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  // 검색 초기화
  const reset = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
  }, []);

  return {
    query,
    results,
    isSearching,
    search,
    reset,
  };
}
