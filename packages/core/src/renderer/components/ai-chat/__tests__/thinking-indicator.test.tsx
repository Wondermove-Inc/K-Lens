/**
 * 🎯 목적: ThinkingIndicator UI 컴포넌트 테스트
 * 01: ThinkingIndicator UI 구현
 *
 * 📝 테스트 범위:
 * - 4단계 진단 루프 시각화
 * - 현재 단계 하이라이트
 * - 도구 호출 표시
 * - 접기/펼치기 토글
 * - 타임스탬프 표시
 *
 * @packageDocumentation
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { thinkingState } from "../../../../features/ai-assistant/common/thinking-state";
import { ThinkingIndicator } from "../thinking-indicator";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("ThinkingIndicator 컴포넌트", () => {
  beforeEach(() => {
    act(() => {
      thinkingState.reset();
    });
  });

  afterEach(() => {
    act(() => {
      thinkingState.reset();
    });
  });

  // ============================================
  // 🔹 렌더링 테스트
  // ============================================

  describe("렌더링", () => {
    it("idle 상태에서는 렌더링되지 않음", () => {
      const { container } = render(<ThinkingIndicator />);

      expect(container.firstChild).toBeNull();
    });

    it("isThinking=true일 때 렌더링", () => {
      act(() => {
        thinkingState.startThinking();
      });

      render(<ThinkingIndicator />);

      expect(screen.getByTestId("thinking-indicator")).toBeInTheDocument();
    });

    it("complete 상태에서도 렌더링 (히스토리 표시)", () => {
      act(() => {
        thinkingState.startThinking();
        thinkingState.completeThinking();
      });

      render(<ThinkingIndicator />);

      expect(screen.getByTestId("thinking-indicator")).toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 4단계 진단 루프 표시 테스트
  // ============================================

  describe("진단 루프 단계 표시", () => {
    beforeEach(() => {
      act(() => {
        thinkingState.startThinking();
      });
    });

    it("AC1: 4단계 진단 루프 아이콘 표시", () => {
      render(<ThinkingIndicator />);

      expect(screen.getByText("👁️")).toBeInTheDocument(); // Observe
      expect(screen.getByText("💭")).toBeInTheDocument(); // Hypothesize
      expect(screen.getByText("✅")).toBeInTheDocument(); // Validate
      expect(screen.getByText("🔧")).toBeInTheDocument(); // Mitigate
    });

    it("AC2: 현재 단계가 하이라이트 됨", () => {
      act(() => {
        thinkingState.updateThinkingStep("observing");
      });
      render(<ThinkingIndicator />);

      const observeStep = screen.getByTestId("step-observing");
      expect(observeStep).toHaveClass("active");
    });

    it("AC3: 완료된 단계에 체크 표시", () => {
      act(() => {
        thinkingState.updateThinkingStep("observing");
        thinkingState.updateThinkingStep("hypothesizing");
      });

      render(<ThinkingIndicator />);

      const observeStep = screen.getByTestId("step-observing");
      expect(observeStep).toHaveClass("completed");
    });

    it("대기 중인 단계는 비활성 스타일", () => {
      act(() => {
        thinkingState.updateThinkingStep("observing");
      });

      render(<ThinkingIndicator />);

      const validateStep = screen.getByTestId("step-validating");
      expect(validateStep).not.toHaveClass("active");
      expect(validateStep).not.toHaveClass("completed");
    });
  });

  // ============================================
  // 🔹 현재 상태 레이블 테스트
  // ============================================

  describe("현재 상태 레이블", () => {
    it("분석 중 레이블 표시", () => {
      act(() => {
        thinkingState.startThinking();
      });

      render(<ThinkingIndicator />);

      // 현재 상태 레이블과 히스토리에 모두 표시될 수 있음
      expect(screen.getAllByText("분석 중...").length).toBeGreaterThan(0);
    });

    it("관찰 중 레이블 표시", () => {
      act(() => {
        thinkingState.startThinking();
        thinkingState.updateThinkingStep("observing");
      });

      render(<ThinkingIndicator />);

      // 현재 상태 레이블과 히스토리에 모두 표시될 수 있음
      expect(screen.getAllByText(/관찰 중/).length).toBeGreaterThan(0);
    });

    it("상세 정보가 있으면 함께 표시", () => {
      act(() => {
        thinkingState.startThinking();
        thinkingState.updateThinkingStep("observing", "클러스터 상태 수집 중");
      });

      render(<ThinkingIndicator />);

      // 상세 정보가 표시됨 (히스토리에서 또는 헤더에서)
      expect(screen.getAllByText(/클러스터 상태 수집 중/).length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 🔹 접기/펼치기 테스트
  // ============================================

  describe("접기/펼치기", () => {
    beforeEach(() => {
      act(() => {
        thinkingState.startThinking();
      });
    });

    it("AC5: 기본값은 펼침 상태", () => {
      render(<ThinkingIndicator />);

      expect(screen.getByTestId("thinking-content")).toBeVisible();
    });

    it("토글 버튼 클릭 시 접힘", () => {
      render(<ThinkingIndicator />);

      const toggleButton = screen.getByTestId("toggle-expand");
      fireEvent.click(toggleButton);

      expect(thinkingState.isExpanded).toBe(false);
    });

    it("접힌 상태에서 요약 표시", () => {
      act(() => {
        thinkingState.addToolCall("tool1", {});
        thinkingState.addToolCall("tool2", {});
        thinkingState.toggleThinkingExpanded();
      });

      render(<ThinkingIndicator />);

      expect(screen.getByText(/2개 도구 호출/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 도구 호출 표시 테스트
  // ============================================

  describe("도구 호출 표시", () => {
    beforeEach(() => {
      act(() => {
        thinkingState.startThinking();
      });
    });

    it("AC4: 도구명 표시", () => {
      act(() => {
        thinkingState.addToolCall("kubectl_get", { resource: "pods" });
      });

      render(<ThinkingIndicator />);

      expect(screen.getByText("kubectl_get")).toBeInTheDocument();
    });

    it("도구 호출 인자 표시", () => {
      act(() => {
        thinkingState.addToolCall("kubectl_get", { resource: "pods" });
      });

      render(<ThinkingIndicator />);

      expect(screen.getByText(/pods/)).toBeInTheDocument();
    });

    it("결과가 있으면 결과 표시", () => {
      act(() => {
        const idx = thinkingState.addToolCall("kubectl_get", {});
        thinkingState.updateToolCallResult(idx, { count: 5 });
      });

      render(<ThinkingIndicator />);

      expect(screen.getByText(/count/)).toBeInTheDocument();
    });

    it("결과 없으면 로딩 표시", () => {
      act(() => {
        thinkingState.addToolCall("kubectl_get", {});
      });

      render(<ThinkingIndicator />);

      expect(screen.getByTestId("tool-loading-0")).toBeInTheDocument();
    });

    it("여러 도구 호출이 순서대로 표시", () => {
      act(() => {
        thinkingState.addToolCall("tool1", {});
        thinkingState.addToolCall("tool2", {});
        thinkingState.addToolCall("tool3", {});
      });

      render(<ThinkingIndicator />);

      const toolCalls = screen.getAllByTestId(/^tool-call-/);
      expect(toolCalls.length).toBe(3);
    });
  });

  // ============================================
  // 🔹 타임스탬프 테스트
  // ============================================

  describe("타임스탬프", () => {
    it("AC6: 단계별 타임스탬프 표시", () => {
      act(() => {
        thinkingState.startThinking();
        thinkingState.updateThinkingStep("observing");
      });

      render(<ThinkingIndicator />);

      // 시:분:초 형식으로 표시되는지 확인
      const timestamps = screen.getAllByTestId(/timestamp/);
      expect(timestamps.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 🔹 애니메이션 클래스 테스트
  // ============================================

  describe("애니메이션", () => {
    it("AC2: 진행 중인 단계에 애니메이션 클래스", () => {
      act(() => {
        thinkingState.startThinking();
        thinkingState.updateThinkingStep("observing");
      });

      render(<ThinkingIndicator />);

      const activeStep = screen.getByTestId("step-observing");
      expect(activeStep).toHaveClass("animate-pulse");
    });
  });

  // ============================================
  // 🔹 시나리오 테스트
  // ============================================

  describe("시나리오 테스트", () => {
    it("전체 진단 플로우 UI 표시", () => {
      // 시작
      act(() => {
        thinkingState.startThinking();
      });
      const { rerender } = render(<ThinkingIndicator />);
      expect(screen.getAllByText("분석 중...").length).toBeGreaterThan(0);

      // 관찰
      act(() => {
        thinkingState.updateThinkingStep("observing", "Pod 상태 확인");
        thinkingState.addToolCall("kubectl_get", { resource: "pods" });
      });
      rerender(<ThinkingIndicator />);
      expect(screen.getAllByText(/관찰 중/).length).toBeGreaterThan(0);
      expect(screen.getByText("kubectl_get")).toBeInTheDocument();

      // 가설
      act(() => {
        thinkingState.updateThinkingStep("hypothesizing");
      });
      rerender(<ThinkingIndicator />);
      expect(screen.getAllByText(/가설 수립 중/).length).toBeGreaterThan(0);

      // 완료
      act(() => {
        thinkingState.completeThinking();
      });
      rerender(<ThinkingIndicator />);
      expect(screen.getAllByText(/완료/).length).toBeGreaterThan(0);
    });

    it("접기 후에도 완료 상태 유지", () => {
      act(() => {
        thinkingState.startThinking();
        thinkingState.updateThinkingStep("observing");
        thinkingState.addToolCall("test-tool", {});
        thinkingState.completeThinking();
      });

      render(<ThinkingIndicator />);

      // 접기
      const toggleButton = screen.getByTestId("toggle-expand");
      fireEvent.click(toggleButton);

      // 접힌 상태에서도 컴포넌트 유지
      expect(screen.getByTestId("thinking-indicator")).toBeInTheDocument();
      expect(screen.getByText(/1개 도구 호출/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 접근성 테스트
  // ============================================

  describe("접근성", () => {
    it("aria-label이 설정됨", () => {
      act(() => {
        thinkingState.startThinking();
      });

      render(<ThinkingIndicator />);

      expect(screen.getByRole("region")).toHaveAttribute("aria-label");
    });

    it("토글 버튼에 aria-expanded 설정", () => {
      act(() => {
        thinkingState.startThinking();
      });

      render(<ThinkingIndicator />);

      const toggleButton = screen.getByTestId("toggle-expand");
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });
  });
});
