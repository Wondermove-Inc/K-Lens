/**
 * 🎯 목적: useContextResources 훅 - Kubernetes 리소스 조회 및 관리
 * 02: useContextResources 훅 구현
 *
 * 주요 기능:
 * - 리소스 비동기 조회 (fetcher 의존성 주입)
 * - 검색/필터링/정렬
 * - 로딩/에러 상태 관리
 * - 리프레시 및 초기화
 *
 * @packageDocumentation
 */

import { useCallback, useRef, useState } from "react";

import type { ContextItem, ContextTypeValue } from "../../common/context-types";

/** 리소스 조회 쿼리 파라미터 */
export interface ResourceQuery {
  /** 조회할 리소스 타입 목록 */
  types: ContextTypeValue[];
  /** 이름 검색어 (대소문자 무시) */
  search?: string;
  /** 네임스페이스 필터 */
  namespace?: string;
  /** 정렬 기준 */
  sortBy?: "name" | "createdAt";
  /** 정렬 순서 */
  sortOrder?: "asc" | "desc";
}

/** 리소스 조회 함수 타입 (의존성 주입용) */
export type ResourceFetcher = (query: ResourceQuery) => Promise<ContextItem[]>;

/** useContextResources 옵션 */
export interface UseContextResourcesOptions {
  /** 리소스 조회 함수 (테스트 시 mock 주입 가능) */
  fetcher?: ResourceFetcher;
}

/** useContextResources 훅 반환 타입 */
export interface UseContextResourcesResult {
  /** 조회된 리소스 목록 */
  resources: ContextItem[];
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 상태 */
  error: Error | null;
  /** 리소스 조회 함수 */
  fetchResources: (query: ResourceQuery) => Promise<void>;
  /** 마지막 쿼리로 다시 조회 */
  refresh: () => Promise<void>;
  /** 에러 초기화 */
  clearError: () => void;
  /** 상태 초기화 */
  reset: () => void;
}

/** 기본 fetcher (실제 API 호출) - 추후 구현 */
const defaultFetcher: ResourceFetcher = async () => [];

/**
 * 리소스 필터링 함수 (검색 + 네임스페이스)
 * @param resources - 원본 리소스 배열
 * @param query - 쿼리 파라미터
 * @returns 필터링된 리소스 배열
 */
function filterResources(resources: ContextItem[], query: ResourceQuery): ContextItem[] {
  let result = [...resources];

  // 검색어 필터링 (대소문자 무시)
  if (query.search) {
    const searchLower = query.search.toLowerCase();
    result = result.filter((r) => r.name.toLowerCase().includes(searchLower));
  }

  // 네임스페이스 필터링
  if (query.namespace) {
    result = result.filter((r) => r.namespace === query.namespace);
  }

  return result;
}

/**
 * 리소스 정렬 함수
 * @param resources - 정렬할 리소스 배열
 * @param sortBy - 정렬 기준
 * @param sortOrder - 정렬 순서
 * @returns 정렬된 리소스 배열
 */
function sortResources(
  resources: ContextItem[],
  sortBy?: "name" | "createdAt",
  sortOrder?: "asc" | "desc",
): ContextItem[] {
  if (!sortBy) return resources;

  const result = [...resources];
  const order = sortOrder === "desc" ? -1 : 1;

  return result.sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name) * order;
    }
    // createdAt 정렬
    const aTime = a.createdAt.getTime();
    const bTime = b.createdAt.getTime();
    return (aTime - bTime) * order;
  });
}

/**
 * useContextResources 훅 - Kubernetes 리소스 조회 및 관리
 *
 * @param options - 훅 옵션 (fetcher 주입 가능)
 * @returns 리소스 상태 및 조작 함수
 *
 * @example
 * ```tsx
 * const { resources, isLoading, fetchResources } = useContextResources();
 *
 * useEffect(() => {
 *   fetchResources({ types: [ContextType.POD], namespace: "default" });
 * }, []);
 * ```
 */
export function useContextResources(options: UseContextResourcesOptions = {}): UseContextResourcesResult {
  const { fetcher = defaultFetcher } = options;

  const [resources, setResources] = useState<ContextItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 마지막 쿼리 저장 (refresh용)
  const lastQueryRef = useRef<ResourceQuery | null>(null);

  /** 리소스 조회 */
  const fetchResources = useCallback(
    async (query: ResourceQuery): Promise<void> => {
      lastQueryRef.current = query;
      setIsLoading(true);
      setError(null);

      try {
        const rawResources = await fetcher(query);
        // 필터링 및 정렬 적용
        const filtered = filterResources(rawResources, query);
        const sorted = sortResources(filtered, query.sortBy, query.sortOrder);
        setResources(sorted);
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
      } finally {
        setIsLoading(false);
      }
    },
    [fetcher],
  );

  /** 마지막 쿼리로 다시 조회 */
  const refresh = useCallback(async (): Promise<void> => {
    if (lastQueryRef.current) {
      await fetchResources(lastQueryRef.current);
    }
  }, [fetchResources]);

  /** 에러 초기화 */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /** 상태 전체 초기화 */
  const reset = useCallback((): void => {
    setResources([]);
    setIsLoading(false);
    setError(null);
    lastQueryRef.current = null;
  }, []);

  return {
    resources,
    isLoading,
    error,
    fetchResources,
    refresh,
    clearError,
    reset,
  };
}
