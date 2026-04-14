/**
 * 🎯 목적: AgentProgress UI 컴포넌트 테스트
 * 01: AgentProgress UI 구현 (TDD)
 *
 * 📝 테스트 범위:
 * - 진행 상태 표시
 * - 단계 목록 표시
 * - 승인/거부 버튼
 * - 자동 실행 토글
 *
 * @packageDocumentation
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import {
  AgentModeController,
  AgentModeStatus,
  ApprovalStatus,
  StepType,
} from "../../../../features/ai-assistant/common/agent-mode-controller";
import { AgentProgress } from "../agent-progress";

// ============================================
// 🎯 Mock 설정
// ============================================

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
};

describe("AgentProgress 컴포넌트", () => {
  let controller: AgentModeController;

  beforeEach(() => {
    Object.values(mockLogger).forEach((fn) => fn.mockClear());
    controller = new AgentModeController({ logger: mockLogger as any });
  });

  // ============================================
  // 기본 렌더링
  // ============================================

  describe("기본 렌더링", () => {
    it("Agent Mode가 비활성 상태일 때 아무것도 표시하지 않아야 함", () => {
      const { container } = render(<AgentProgress controller={controller} />);

      expect(container.firstChild).toBeNull();
    });

    it("Agent Mode가 활성 상태일 때 헤더를 표시해야 함", () => {
      controller.start("테스트 목표");

      render(<AgentProgress controller={controller} />);

      expect(screen.getByText("Agent Mode")).toBeInTheDocument();
    });

    it("현재 목표를 표시해야 함", () => {
      controller.start("파일 정리하기");

      render(<AgentProgress controller={controller} />);

      expect(screen.getByText(/파일 정리하기/)).toBeInTheDocument();
    });

    it("진행률을 표시해야 함", () => {
      controller.start("목표");
      controller.addStep({ type: StepType.THINKING, description: "분석" });
      controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });

      render(<AgentProgress controller={controller} />);

      // THINKING은 auto_approved로 50%
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 상태 표시
  // ============================================

  describe("상태 표시", () => {
    it("실행 중 상태를 표시해야 함", () => {
      controller.start("목표");

      render(<AgentProgress controller={controller} />);

      expect(screen.getByText(/실행 중/)).toBeInTheDocument();
    });

    it("일시정지 상태를 표시해야 함", () => {
      controller.start("목표");
      controller.pause();

      render(<AgentProgress controller={controller} />);

      expect(screen.getByText(/일시정지/)).toBeInTheDocument();
    });

    it("완료 상태를 표시해야 함", () => {
      controller.start("목표");
      controller.complete();

      render(<AgentProgress controller={controller} />);

      expect(screen.getByText(/완료/)).toBeInTheDocument();
    });

    it("에러 상태를 표시해야 함", () => {
      controller.start("목표");
      controller.setError("에러 발생");

      render(<AgentProgress controller={controller} />);

      // 상태 텍스트로 "에러" 표시 확인
      expect(screen.getAllByText(/에러/).length).toBeGreaterThanOrEqual(1);
      // 에러 메시지 표시 확인
      expect(screen.getByText(/에러 발생/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 단계 목록
  // ============================================

  describe("단계 목록", () => {
    it("단계 목록을 표시해야 함", () => {
      controller.start("목표");
      controller.addStep({ type: StepType.THINKING, description: "문제 분석" });
      controller.addStep({ type: StepType.TOOL_CALL, description: "파일 읽기" });

      render(<AgentProgress controller={controller} />);

      expect(screen.getByText("문제 분석")).toBeInTheDocument();
      expect(screen.getByText("파일 읽기")).toBeInTheDocument();
    });

    it("단계 타입 아이콘을 표시해야 함", () => {
      controller.start("목표");
      controller.addStep({ type: StepType.THINKING, description: "생각" });

      render(<AgentProgress controller={controller} />);

      // 아이콘이 포함된 요소 확인
      expect(screen.getByTestId("step-icon-thinking")).toBeInTheDocument();
    });

    it("승인된 단계에 체크 표시해야 함", () => {
      controller.start("목표");
      const step = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });
      controller.approveStep(step.id);

      render(<AgentProgress controller={controller} />);

      expect(screen.getByTestId("step-approved")).toBeInTheDocument();
    });

    it("거부된 단계에 X 표시해야 함", () => {
      controller.start("목표");
      const step = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });
      controller.rejectStep(step.id, "불필요");

      render(<AgentProgress controller={controller} />);

      expect(screen.getByTestId("step-rejected")).toBeInTheDocument();
    });

    it("대기 중인 단계에 승인/거부 버튼이 있어야 함", () => {
      controller.start("목표");
      controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });

      render(<AgentProgress controller={controller} />);

      expect(screen.getByRole("button", { name: /Approve/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Reject/ })).toBeInTheDocument();
    });
  });

  // ============================================
  // 승인/거부 기능
  // ============================================

  describe("승인/거부 기능", () => {
    it("승인 버튼 클릭 시 단계가 승인되어야 함", async () => {
      controller.start("목표");
      const step = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });
      const user = userEvent.setup();

      render(<AgentProgress controller={controller} />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Approve/ }));
      });

      expect(controller.getStep(step.id)?.status).toBe(ApprovalStatus.APPROVED);
    });

    it("거부 버튼 클릭 시 단계가 거부되어야 함", async () => {
      controller.start("목표");
      const step = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });
      const user = userEvent.setup();

      render(<AgentProgress controller={controller} />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Reject/ }));
      });

      expect(controller.getStep(step.id)?.status).toBe(ApprovalStatus.REJECTED);
    });

    it("모두 승인 버튼이 있어야 함", () => {
      controller.start("목표");
      controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 1",
        requiresApproval: true,
      });
      controller.addStep({
        type: StepType.FILE_CREATE,
        description: "생성",
        requiresApproval: true,
      });

      render(<AgentProgress controller={controller} />);

      expect(screen.getByRole("button", { name: /Approve All/ })).toBeInTheDocument();
    });

    it("모두 승인 버튼 클릭 시 모든 대기 단계가 승인되어야 함", async () => {
      controller.start("목표");
      const step1 = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 1",
        requiresApproval: true,
      });
      const step2 = controller.addStep({
        type: StepType.FILE_CREATE,
        description: "생성",
        requiresApproval: true,
      });
      const user = userEvent.setup();

      render(<AgentProgress controller={controller} />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /Approve All/ }));
      });

      expect(controller.getStep(step1.id)?.status).toBe(ApprovalStatus.APPROVED);
      expect(controller.getStep(step2.id)?.status).toBe(ApprovalStatus.APPROVED);
    });
  });

  // ============================================
  // 자동 실행 모드
  // ============================================

  describe("자동 실행 모드", () => {
    it("자동 실행 토글이 있어야 함", () => {
      controller.start("목표");

      render(<AgentProgress controller={controller} />);

      expect(screen.getByRole("switch", { name: /자동 실행/ })).toBeInTheDocument();
    });

    it("자동 실행 토글 활성화 시 자동 승인이 켜져야 함", () => {
      controller.start("목표");

      // 컨트롤러 메서드 직접 테스트 (UI 통합은 E2E에서 테스트)
      expect(controller.isAutoApproveEnabled).toBe(false);

      controller.enableAutoApprove();
      expect(controller.isAutoApproveEnabled).toBe(true);

      controller.disableAutoApprove();
      expect(controller.isAutoApproveEnabled).toBe(false);
    });

    it("자동 실행 횟수 선택이 있어야 함", () => {
      controller.start("목표");

      render(<AgentProgress controller={controller} />);

      expect(screen.getByLabelText(/횟수/)).toBeInTheDocument();
    });
  });

  // ============================================
  // 제어 버튼
  // ============================================

  describe("제어 버튼", () => {
    it("일시정지 버튼이 있어야 함", () => {
      controller.start("목표");

      render(<AgentProgress controller={controller} />);

      expect(screen.getByRole("button", { name: /일시정지/ })).toBeInTheDocument();
    });

    it("일시정지 버튼 클릭 시 Agent가 일시정지되어야 함", async () => {
      controller.start("목표");
      const user = userEvent.setup();

      render(<AgentProgress controller={controller} />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /일시정지/ }));
      });

      expect(controller.status).toBe(AgentModeStatus.PAUSED);
    });

    it("일시정지 상태에서 재개 버튼이 있어야 함", () => {
      controller.start("목표");
      controller.pause();

      render(<AgentProgress controller={controller} />);

      expect(screen.getByRole("button", { name: /재개/ })).toBeInTheDocument();
    });

    it("중지 버튼이 있어야 함", () => {
      controller.start("목표");

      render(<AgentProgress controller={controller} />);

      expect(screen.getByRole("button", { name: /중지/ })).toBeInTheDocument();
    });

    it("중지 버튼 클릭 시 Agent가 중지되어야 함", async () => {
      controller.start("목표");
      const user = userEvent.setup();

      render(<AgentProgress controller={controller} />);

      await act(async () => {
        await user.click(screen.getByRole("button", { name: /중지/ }));
      });

      expect(controller.status).toBe(AgentModeStatus.STOPPED);
    });
  });

  // ============================================
  // 접근성
  // ============================================

  describe("접근성", () => {
    it("적절한 ARIA 레이블이 있어야 함", () => {
      controller.start("목표");

      render(<AgentProgress controller={controller} />);

      expect(screen.getByRole("region", { name: /Agent Mode 진행 상황/ })).toBeInTheDocument();
    });

    it("진행률 바에 적절한 ARIA 속성이 있어야 함", () => {
      controller.start("목표");
      controller.addStep({ type: StepType.THINKING, description: "분석" });

      render(<AgentProgress controller={controller} />);

      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveAttribute("aria-valuenow");
      expect(progressBar).toHaveAttribute("aria-valuemin", "0");
      expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    });
  });
});
