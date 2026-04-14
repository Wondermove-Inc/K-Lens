/**
 * 🎯 목적: useContextResources 훅 단위 테스트
 * 02: useContextResources 훅 구현
 * @packageDocumentation
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { ContextType } from "../../../common/context-types";
import { type ResourceFetcher, useContextResources } from "../use-context-resources";

import type { ContextItem } from "../../../common/context-types";

// Mock 리소스 데이터
const mockPods: ContextItem[] = [
  { id: "pod-1", type: ContextType.POD, name: "nginx-pod-1", namespace: "default", createdAt: new Date() },
  { id: "pod-2", type: ContextType.POD, name: "nginx-pod-2", namespace: "default", createdAt: new Date() },
  { id: "pod-3", type: ContextType.POD, name: "redis-pod", namespace: "production", createdAt: new Date() },
];

const mockDeployments: ContextItem[] = [
  { id: "deploy-1", type: ContextType.DEPLOYMENT, name: "nginx-deploy", namespace: "default", createdAt: new Date() },
];

// Mock fetcher 생성
function createMockFetcher(data: ContextItem[] = mockPods): ResourceFetcher {
  return jest.fn().mockResolvedValue(data);
}

describe("useContextResources 훅", () => {
  describe("초기 상태", () => {
    it("AC1: 초기 resources는 빈 배열이어야 한다", () => {
      const { result } = renderHook(() => useContextResources());
      expect(result.current.resources).toEqual([]);
    });

    it("AC2: 초기 isLoading은 false여야 한다", () => {
      const { result } = renderHook(() => useContextResources());
      expect(result.current.isLoading).toBe(false);
    });

    it("초기 error는 null이어야 한다", () => {
      const { result } = renderHook(() => useContextResources());
      expect(result.current.error).toBeNull();
    });
  });

  describe("리소스 조회", () => {
    it("AC3: fetchResources 호출 시 리소스 목록을 가져와야 한다", async () => {
      const mockFetcher = createMockFetcher(mockPods);
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({ types: [ContextType.POD] });
      });

      expect(result.current.resources.length).toBe(3);
      expect(result.current.resources[0].type).toBe(ContextType.POD);
    });

    it("fetcher가 호출되어야 한다", async () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({ types: [ContextType.POD] });
      });

      expect(mockFetcher).toHaveBeenCalledWith(expect.objectContaining({ types: [ContextType.POD] }));
    });

    it("로딩 상태가 적절하게 변경되어야 한다", async () => {
      const mockFetcher = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockPods), 50)));
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      expect(result.current.isLoading).toBe(false);

      let fetchPromise: Promise<void>;
      act(() => {
        fetchPromise = result.current.fetchResources({ types: [ContextType.POD] });
      });

      // 로딩 중
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await fetchPromise;
      });

      // 로딩 완료
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("검색 필터링", () => {
    it("AC4: 이름으로 리소스를 필터링할 수 있어야 한다", async () => {
      const mockFetcher = createMockFetcher(mockPods);
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({
          types: [ContextType.POD],
          search: "nginx",
        });
      });

      // 로컬 필터링 적용
      const filteredResources = result.current.resources;
      expect(filteredResources.length).toBe(2);
      expect(filteredResources.every((r) => r.name.includes("nginx"))).toBe(true);
    });

    it("대소문자 구분 없이 검색해야 한다", async () => {
      const mockFetcher = createMockFetcher(mockPods);
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({
          types: [ContextType.POD],
          search: "NGINX",
        });
      });

      expect(result.current.resources.length).toBeGreaterThan(0);
    });
  });

  describe("네임스페이스 필터링", () => {
    it("AC5: 네임스페이스로 리소스를 필터링할 수 있어야 한다", async () => {
      const mockFetcher = createMockFetcher(mockPods);
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({
          types: [ContextType.POD],
          namespace: "default",
        });
      });

      expect(result.current.resources.every((r) => r.namespace === "default")).toBe(true);
    });
  });

  describe("에러 처리", () => {
    it("AC6: API 에러 시 error 상태가 설정되어야 한다", async () => {
      const mockFetcher = jest.fn().mockRejectedValue(new Error("API Error"));
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({ types: [ContextType.POD] });
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain("Error");
    });

    it("clearError로 에러를 초기화할 수 있어야 한다", async () => {
      const mockFetcher = jest.fn().mockRejectedValue(new Error("API Error"));
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({ types: [ContextType.POD] });
      });

      expect(result.current.error).toBeTruthy();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("리소스 변환", () => {
    it("리소스가 ContextItem 형태여야 한다", async () => {
      const mockFetcher = createMockFetcher(mockPods);
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({ types: [ContextType.POD] });
      });

      const resource = result.current.resources[0];
      expect(resource).toHaveProperty("id");
      expect(resource).toHaveProperty("type");
      expect(resource).toHaveProperty("name");
      expect(resource).toHaveProperty("createdAt");
    });
  });

  describe("리프레시", () => {
    it("refresh 호출 시 마지막 쿼리로 다시 조회해야 한다", async () => {
      const mockFetcher = createMockFetcher(mockPods);
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({ types: [ContextType.POD] });
      });

      expect(mockFetcher).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockFetcher).toHaveBeenCalledTimes(2);
    });

    it("이전 쿼리가 없으면 refresh는 아무것도 하지 않아야 한다", async () => {
      const mockFetcher = createMockFetcher(mockPods);
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockFetcher).not.toHaveBeenCalled();
    });
  });

  describe("정렬", () => {
    it("이름순 오름차순으로 정렬할 수 있어야 한다", async () => {
      const mockFetcher = createMockFetcher(mockPods);
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({
          types: [ContextType.POD],
          sortBy: "name",
          sortOrder: "asc",
        });
      });

      const names = result.current.resources.map((r) => r.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it("이름순 내림차순으로 정렬할 수 있어야 한다", async () => {
      const mockFetcher = createMockFetcher(mockPods);
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({
          types: [ContextType.POD],
          sortBy: "name",
          sortOrder: "desc",
        });
      });

      const names = result.current.resources.map((r) => r.name);
      const sortedNames = [...names].sort().reverse();
      expect(names).toEqual(sortedNames);
    });
  });

  describe("초기화", () => {
    it("reset으로 상태를 초기화할 수 있어야 한다", async () => {
      const mockFetcher = createMockFetcher(mockPods);
      const { result } = renderHook(() => useContextResources({ fetcher: mockFetcher }));

      await act(async () => {
        await result.current.fetchResources({ types: [ContextType.POD] });
      });

      expect(result.current.resources.length).toBeGreaterThan(0);

      act(() => {
        result.current.reset();
      });

      expect(result.current.resources).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });
});
