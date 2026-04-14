/**
 * 🎯 목적: useMentionIntegration 훅 단위 테스트
 * 02: ai-chat-panel Mention 통합
 *
 * 📝 주요 기능:
 * - mentionState와 useMentionSuggestions 통합
 * - Textarea onChange/onKeyDown 이벤트 핸들링
 * - MentionAutocomplete 렌더링 props 제공
 *
 * @packageDocumentation
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { ContextType } from "../../../../features/ai-assistant/common/context-types";
import { mentionState } from "../../../../features/ai-assistant/common/mention-state";
import { useMentionIntegration } from "../use-mention-integration";

import type { MentionSuggestionItem } from "../../../../features/ai-assistant/renderer/hooks/use-mention-suggestions";

// ============================================
// 🎯 Mock 데이터
// ============================================

const mockSuggestions: MentionSuggestionItem[] = [
  { id: "pod-1", type: ContextType.POD, name: "nginx-pod", namespace: "default" },
  { id: "pod-2", type: ContextType.POD, name: "redis-pod", namespace: "default" },
  { id: "deploy-1", type: ContextType.DEPLOYMENT, name: "nginx-deploy", namespace: "kube-system" },
];

// Mock fetcher
const createMockFetcher = () => jest.fn().mockResolvedValue(mockSuggestions);

// ============================================
// 🎯 테스트
// ============================================

describe("useMentionIntegration 훅", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // 각 테스트 전 MobX 상태 리셋
    mentionState.reset();
  });

  afterEach(() => {
    jest.useRealTimers();
    // 테스트 후 상태 정리
    mentionState.reset();
  });

  describe("초기 상태", () => {
    it("AC1: mentionState.isOpen은 false여야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      // MobX 상태 직접 확인
      expect(mentionState.isOpen).toBe(false);
    });

    it("suggestions는 빈 배열이어야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      expect(result.current.suggestions).toEqual([]);
    });

    it("selectedIndex는 0이어야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      expect(mentionState.selectedIndex).toBe(0);
    });
  });

  describe("@ 트리거 감지", () => {
    it("AC2: @ 입력 시 mentionState가 열려야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      // @ 입력 시뮬레이션
      act(() => {
        result.current.handleTextChange("hello @", 7, { top: 100, left: 50 });
      });

      // MobX 상태 직접 확인
      expect(mentionState.isOpen).toBe(true);
    });

    it("AC3: @ 뒤에 쿼리가 있으면 query가 업데이트되어야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      act(() => {
        result.current.handleTextChange("hello @nginx", 12, { top: 100, left: 50 });
      });

      expect(mentionState.query).toBe("nginx");
    });

    it("@ 뒤에 공백이 있으면 닫혀야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      // 먼저 열기
      act(() => {
        result.current.handleTextChange("hello @nginx", 12, { top: 100, left: 50 });
      });
      expect(mentionState.isOpen).toBe(true);

      // 공백 입력으로 닫기
      act(() => {
        result.current.handleTextChange("hello @nginx ", 13, { top: 100, left: 50 });
      });
      expect(mentionState.isOpen).toBe(false);
    });
  });

  describe("제안 목록 로딩", () => {
    it("AC4: @ 입력 후 debounce 후 fetcher가 호출되어야 한다", async () => {
      const mockFetcher = createMockFetcher();
      const { result, rerender } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      act(() => {
        result.current.handleTextChange("@", 1, { top: 100, left: 50 });
      });

      // debounce 전에는 호출 안됨
      expect(mockFetcher).not.toHaveBeenCalled();

      // rerender로 MobX 상태 반영
      rerender();

      // debounce 후 호출
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockFetcher).toHaveBeenCalled();
      });
    });

    it("AC5: 제안이 로드되면 suggestions에 표시되어야 한다", async () => {
      const mockFetcher = createMockFetcher();
      const { result, rerender } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      act(() => {
        result.current.handleTextChange("@", 1, { top: 100, left: 50 });
      });

      // rerender로 MobX 상태 반영
      rerender();

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      });
    });
  });

  describe("키보드 네비게이션", () => {
    it("AC6: ArrowDown으로 다음 항목 선택", async () => {
      const mockFetcher = createMockFetcher();
      const { result, rerender } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      // 멘션 열기
      act(() => {
        result.current.handleTextChange("@", 1, { top: 100, left: 50 });
      });

      // rerender로 MobX 상태 반영
      rerender();

      // 제안 로드
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      });

      // ArrowDown
      act(() => {
        result.current.handleNavigate("down");
      });

      expect(mentionState.selectedIndex).toBe(1);
    });

    it("AC6: ArrowUp으로 이전 항목 선택", async () => {
      const mockFetcher = createMockFetcher();
      const { result, rerender } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      // 멘션 열기
      act(() => {
        result.current.handleTextChange("@", 1, { top: 100, left: 50 });
      });

      // rerender로 MobX 상태 반영
      rerender();

      // 제안 로드
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      });

      // 먼저 아래로
      act(() => {
        result.current.handleNavigate("down");
        result.current.handleNavigate("down");
      });

      expect(mentionState.selectedIndex).toBe(2);

      // 위로
      act(() => {
        result.current.handleNavigate("up");
      });

      expect(mentionState.selectedIndex).toBe(1);
    });
  });

  describe("항목 선택", () => {
    it("AC7: 항목 선택 시 onSelect 콜백이 호출되어야 한다", async () => {
      const mockFetcher = createMockFetcher();
      const onSelect = jest.fn();
      const { result, rerender } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher, onSelect }));

      // 멘션 열기
      act(() => {
        result.current.handleTextChange("@", 1, { top: 100, left: 50 });
      });

      // rerender로 MobX 상태 반영
      rerender();

      // 제안 로드
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      });

      // 항목 선택
      act(() => {
        result.current.handleSelect(mockSuggestions[0]);
      });

      expect(onSelect).toHaveBeenCalledWith(mockSuggestions[0]);
    });

    it("AC8: 항목 선택 후 멘션이 닫혀야 한다", async () => {
      const mockFetcher = createMockFetcher();
      const { result, rerender } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      // 멘션 열기
      act(() => {
        result.current.handleTextChange("@", 1, { top: 100, left: 50 });
      });

      // rerender로 MobX 상태 반영
      rerender();

      // 제안 로드
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      });

      // 항목 선택
      act(() => {
        result.current.handleSelect(mockSuggestions[0]);
      });

      expect(mentionState.isOpen).toBe(false);
    });
  });

  describe("닫기", () => {
    it("AC9: handleClose 호출 시 멘션이 닫혀야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      // 열기
      act(() => {
        result.current.handleTextChange("@", 1, { top: 100, left: 50 });
      });
      expect(mentionState.isOpen).toBe(true);

      // 닫기
      act(() => {
        result.current.handleClose();
      });
      expect(mentionState.isOpen).toBe(false);
    });

    it("Escape 키로 닫기를 테스트하기 위한 handleKeyDown 제공", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      // handleKeyDown 함수가 있어야 함
      expect(typeof result.current.handleKeyDown).toBe("function");
    });
  });

  describe("타입 필터링", () => {
    it("AC10: pod: 접두사로 타입 필터가 설정되어야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      act(() => {
        result.current.handleTextChange("@pod:nginx", 10, { top: 100, left: 50 });
      });

      expect(mentionState.filterType).toBe("pod");
    });

    it("타입 접두사가 없으면 filterType은 null이어야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      act(() => {
        result.current.handleTextChange("@nginx", 6, { top: 100, left: 50 });
      });

      expect(mentionState.filterType).toBeNull();
    });
  });

  describe("position 관리", () => {
    it("AC11: position이 전달되어야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      act(() => {
        result.current.handleTextChange("@", 1, { top: 200, left: 100 });
      });

      expect(mentionState.position).toEqual({ top: 200, left: 100 });
    });
  });

  describe("비활성화", () => {
    it("enabled=false일 때 @ 입력해도 열리지 않아야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher, enabled: false }));

      act(() => {
        result.current.handleTextChange("@", 1, { top: 100, left: 50 });
      });

      expect(mentionState.isOpen).toBe(false);
    });
  });

  describe("triggerIndex 관리", () => {
    it("트리거 인덱스가 설정되어야 한다", () => {
      const mockFetcher = createMockFetcher();
      const { result } = renderHook(() => useMentionIntegration({ fetcher: mockFetcher }));

      act(() => {
        result.current.handleTextChange("hello @nginx", 12, { top: 100, left: 50 });
      });

      expect(mentionState.triggerIndex).toBe(6);
    });
  });
});
