/**
 * 🎯 목적: PlanExecutionProgress 컴포넌트 테스트
 * 02: 계획 실행 진행 표시
 *
 * 📝 테스트 범위:
 * - 실행 중 상태에서 렌더링
 * - 현재 단계 하이라이트
 * - 진행 상태 텍스트
 * - 단계별 애니메이션
 * - 완료/실패 상태
 *
 * @packageDocumentation
 */

import { act, render, screen } from "@testing-library/react";
import React from "react";
import { createPlanStep, planState } from "../../../../features/ai-assistant/common/plan-state";
import { PlanExecutionProgress } from "../plan-execution-progress";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("PlanExecutionProgress 컴포넌트", () => {
  beforeEach(() => {
    act(() => {
      planState.reset();
    });
  });

  afterEach(() => {
    act(() => {
      planState.reset();
    });
  });

  // ============================================
  // 🔹 기본 렌더링
  // ============================================

  describe("기본 렌더링", () => {
    it("비실행 상태에서 null 반환", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
      });

      const { container } = render(<PlanExecutionProgress />);

      expect(container.firstChild).toBeNull();
    });

    it("executing 상태에서 렌더링", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
      });

      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("execution-progress")).toBeInTheDocument();
    });

    it("completed 상태에서도 렌더링", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
        planState.startStep(0);
        planState.completeStep(0);
        planState.nextStep();
      });

      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("execution-progress")).toBeInTheDocument();
    });

    it("failed 상태에서도 렌더링", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
        planState.startStep(0);
        planState.failStep(0, "에러");
      });

      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("execution-progress")).toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 현재 단계 표시
  // ============================================

  describe("현재 단계 표시", () => {
    beforeEach(() => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("첫 번째 단계"));
        planState.addStep(createPlanStep("두 번째 단계"));
        planState.addStep(createPlanStep("세 번째 단계"));
        planState.approvePlan();
      });
    });

    it("현재 단계 제목 표시", () => {
      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("current-step-title")).toHaveTextContent("첫 번째 단계");
    });

    it("현재 단계 번호 표시", () => {
      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("current-step-number")).toHaveTextContent("1/3");
    });

    it("두 번째 단계로 이동 시 업데이트", () => {
      const { rerender } = render(<PlanExecutionProgress />);

      act(() => {
        planState.startStep(0);
        planState.completeStep(0);
        planState.nextStep();
      });

      rerender(<PlanExecutionProgress />);

      expect(screen.getByTestId("current-step-title")).toHaveTextContent("두 번째 단계");
      expect(screen.getByTestId("current-step-number")).toHaveTextContent("2/3");
    });
  });

  // ============================================
  // 🔹 진행 상태 텍스트
  // ============================================

  describe("진행 상태 텍스트", () => {
    beforeEach(() => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
      });
    });

    it("실행 중 텍스트 표시", () => {
      act(() => {
        planState.startStep(0);
      });

      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("status-text")).toHaveTextContent("Executing");
    });

    it("완료 텍스트 표시", () => {
      act(() => {
        planState.startStep(0);
        planState.completeStep(0);
        planState.nextStep();
      });

      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("status-text")).toHaveTextContent("Completed");
    });

    it("실패 텍스트 표시", () => {
      act(() => {
        planState.startStep(0);
        planState.failStep(0, "에러");
      });

      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("status-text")).toHaveTextContent("Failed");
    });
  });

  // ============================================
  // 🔹 진행률 바
  // ============================================

  describe("진행률 바", () => {
    it("0% 시작", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계 1"));
        planState.addStep(createPlanStep("단계 2"));
        planState.approvePlan();
      });

      render(<PlanExecutionProgress />);

      const progressBar = screen.getByTestId("progress-fill");
      expect(progressBar).toHaveStyle({ width: "0%" });
    });

    it("50% 진행", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계 1"));
        planState.addStep(createPlanStep("단계 2"));
        planState.approvePlan();
        planState.startStep(0);
        planState.completeStep(0);
      });

      render(<PlanExecutionProgress />);

      const progressBar = screen.getByTestId("progress-fill");
      expect(progressBar).toHaveStyle({ width: "50%" });
    });

    it("100% 완료", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
        planState.startStep(0);
        planState.completeStep(0);
        planState.nextStep();
      });

      render(<PlanExecutionProgress />);

      const progressBar = screen.getByTestId("progress-fill");
      expect(progressBar).toHaveStyle({ width: "100%" });
    });
  });

  // ============================================
  // 🔹 단계 인디케이터
  // ============================================

  describe("단계 인디케이터", () => {
    beforeEach(() => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계 1"));
        planState.addStep(createPlanStep("단계 2"));
        planState.addStep(createPlanStep("단계 3"));
        planState.approvePlan();
      });
    });

    it("모든 단계 인디케이터 표시", () => {
      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("step-indicator-0")).toBeInTheDocument();
      expect(screen.getByTestId("step-indicator-1")).toBeInTheDocument();
      expect(screen.getByTestId("step-indicator-2")).toBeInTheDocument();
    });

    it("현재 단계 활성화 표시", () => {
      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("step-indicator-0")).toHaveClass("active");
    });

    it("완료된 단계 완료 표시", () => {
      act(() => {
        planState.startStep(0);
        planState.completeStep(0);
        planState.nextStep();
      });

      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("step-indicator-0")).toHaveClass("completed");
      expect(screen.getByTestId("step-indicator-1")).toHaveClass("active");
    });

    it("실패한 단계 실패 표시", () => {
      act(() => {
        planState.startStep(0);
        planState.failStep(0, "에러");
      });

      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("step-indicator-0")).toHaveClass("failed");
    });
  });

  // ============================================
  // 🔹 스피너 애니메이션
  // ============================================

  describe("스피너 애니메이션", () => {
    it("실행 중일 때 스피너 표시", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
        planState.startStep(0);
      });

      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });

    it("완료 시 스피너 숨김", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
        planState.startStep(0);
        planState.completeStep(0);
        planState.nextStep();
      });

      render(<PlanExecutionProgress />);

      expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
    });

    it("실패 시 스피너 숨김", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
        planState.startStep(0);
        planState.failStep(0, "에러");
      });

      render(<PlanExecutionProgress />);

      expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 에러 메시지
  // ============================================

  describe("에러 메시지", () => {
    it("실패 시 에러 메시지 표시", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
        planState.startStep(0);
        planState.failStep(0, "네트워크 오류 발생");
      });

      render(<PlanExecutionProgress />);

      expect(screen.getByTestId("error-message")).toHaveTextContent("네트워크 오류 발생");
    });

    it("성공 시 에러 메시지 없음", () => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
        planState.startStep(0);
        planState.completeStep(0);
        planState.nextStep();
      });

      render(<PlanExecutionProgress />);

      expect(screen.queryByTestId("error-message")).not.toBeInTheDocument();
    });
  });

  // ============================================
  // 🔹 컴팩트 모드
  // ============================================

  describe("컴팩트 모드", () => {
    beforeEach(() => {
      act(() => {
        planState.startPlanMode("테스트");
        planState.addStep(createPlanStep("단계"));
        planState.approvePlan();
      });
    });

    it("compact 모드에서 간략한 표시", () => {
      render(<PlanExecutionProgress compact />);

      expect(screen.getByTestId("execution-progress")).toHaveClass("compact");
    });

    it("compact 모드에서 단계 인디케이터 숨김", () => {
      render(<PlanExecutionProgress compact />);

      expect(screen.queryByTestId("step-indicator-0")).not.toBeInTheDocument();
    });
  });
});
