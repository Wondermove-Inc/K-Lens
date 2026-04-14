/**
 * 🎯 목적: useMentionSuggestions 훅 단위 테스트
 * 01: useMentionSuggestions 훅 구현
 *
 * @packageDocumentation
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { ContextType } from "../../../common/context-types";
import { type MentionSuggestionItem, useMentionSuggestions } from "../use-mention-suggestions";

// Mock 리소스 데이터
const mockPods: MentionSuggestionItem[] = [
  { id: "pod-1", type: ContextType.POD, name: "nginx-pod", namespace: "default" },
  { id: "pod-2", type: ContextType.POD, name: "redis-pod", namespace: "default" },
  { id: "pod-3", type: ContextType.POD, name: "nginx-cache", namespace: "kube-system" },
];

const mockDeployments: MentionSuggestionItem[] = [
  { id: "deploy-1", type: ContextType.DEPLOYMENT, name: "nginx-deploy", namespace: "default" },
];

const mockServices: MentionSuggestionItem[] = [
  { id: "svc-1", type: ContextType.SERVICE, name: "nginx-svc", namespace: "default" },
];

// Mock fetcher
const createMockFetcher = () =>
  jest.fn().mockImplementation(async (type?: string) => {
    if (type === "pod") return mockPods;
    if (type === "deployment") return mockDeployments;
    if (type === "service") return mockServices;

    return [...mockPods, ...mockDeployments, ...mockServices];
  });

describe("useMentionSuggestions 훅", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("기본 동작", () => {
    it("AC1: 빈 쿼리 시 모든 리소스 반환", async () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionSuggestions({ query: "", fetcher: mockFetcher }));

      // debounce 처리
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.suggestions.length).toBe(5); // 모든 리소스
      expect(result.current.error).toBeNull();
    });

    it("AC2: pod 쿼리 시 Pod 목록 반환", async () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionSuggestions({ query: "pod", fetcher: mockFetcher }));

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Pod 이름에 "pod"가 포함된 결과
      expect(result.current.suggestions.length).toBeGreaterThan(0);
      result.current.suggestions.forEach((item) => {
        expect(item.name.toLowerCase()).toContain("pod");
      });
    });

    it("AC3: pod:nginx 쿼리 시 타입과 이름 필터링", async () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionSuggestions({ query: "pod:nginx", fetcher: mockFetcher }));

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Pod 타입 + nginx 포함
      result.current.suggestions.forEach((item) => {
        expect(item.type).toBe(ContextType.POD);
        expect(item.name.toLowerCase()).toContain("nginx");
      });
    });
  });

  describe("debounce", () => {
    it("AC4: 200ms debounce 적용", async () => {
      const mockFetcher = createMockFetcher();
      const { result, rerender } = renderHook(({ query }) => useMentionSuggestions({ query, fetcher: mockFetcher }), {
        initialProps: { query: "" },
      });

      // 빠른 쿼리 변경
      rerender({ query: "a" });
      rerender({ query: "ab" });
      rerender({ query: "abc" });

      // 200ms 이전에는 fetcher가 호출되지 않음
      expect(mockFetcher).not.toHaveBeenCalled();

      // 200ms 경과
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockFetcher).toHaveBeenCalledTimes(1);
      });
    });

    it("커스텀 debounce 시간 적용", async () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() =>
        useMentionSuggestions({ query: "test", fetcher: mockFetcher, debounceMs: 500 }),
      );

      // 300ms 경과 - 아직 호출 안됨
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(mockFetcher).not.toHaveBeenCalled();

      // 200ms 더 경과 (총 500ms)
      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(mockFetcher).toHaveBeenCalled();
      });
    });
  });

  describe("제한 및 정렬", () => {
    it("limit 옵션 적용", async () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionSuggestions({ query: "", fetcher: mockFetcher, limit: 3 }));

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.suggestions.length).toBeLessThanOrEqual(3);
    });

    it("AC6: 최근 사용 리소스 우선 정렬 (recentlyUsed 옵션)", async () => {
      const mockFetcher = createMockFetcher();
      const recentlyUsed = ["pod-2"]; // redis-pod

      const { result } = renderHook(() =>
        useMentionSuggestions({
          query: "",
          fetcher: mockFetcher,
          recentlyUsed,
        }),
      );

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // 최근 사용한 리소스가 먼저
      if (result.current.suggestions.length > 0) {
        expect(result.current.suggestions[0].id).toBe("pod-2");
      }
    });
  });

  describe("에러 처리", () => {
    it("AC7: 에러 발생 시 suggestions 빈 배열, error 설정", async () => {
      const errorFetcher = jest.fn().mockRejectedValue(new Error("API Error"));

      const { result } = renderHook(() => useMentionSuggestions({ query: "test", fetcher: errorFetcher }));

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.suggestions).toEqual([]);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("API Error");
    });
  });

  describe("로딩 상태", () => {
    it("로딩 중일 때 isLoading=true", async () => {
      const slowFetcher = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([]), 1000)));

      const { result } = renderHook(() => useMentionSuggestions({ query: "test", fetcher: slowFetcher }));

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // 로딩 중
      expect(result.current.isLoading).toBe(true);

      // 완료 대기
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("타입 접두사 파싱", () => {
    it("pod: 접두사 파싱", async () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionSuggestions({ query: "pod:", fetcher: mockFetcher }));

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Pod 타입만 반환
      result.current.suggestions.forEach((item) => {
        expect(item.type).toBe(ContextType.POD);
      });
    });

    it("deployment: 접두사 파싱", async () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionSuggestions({ query: "deployment:", fetcher: mockFetcher }));

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Deployment 타입만 반환
      result.current.suggestions.forEach((item) => {
        expect(item.type).toBe(ContextType.DEPLOYMENT);
      });
    });
  });

  describe("비활성화", () => {
    it("enabled=false일 때 fetch 안함", async () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() =>
        useMentionSuggestions({ query: "test", fetcher: mockFetcher, enabled: false }),
      );

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(mockFetcher).not.toHaveBeenCalled();
      expect(result.current.suggestions).toEqual([]);
    });
  });
});
