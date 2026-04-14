/**
 * 🎯 목적: agentModeState MobX 상태 관리 테스트
 * 01: agentModeState 상태 및 액션 추가 (TDD)
 *
 * 📝 테스트 범위:
 * - Agent Mode 활성화/비활성화
 * - 상태 전환 (IDLE → RUNNING → PAUSED → COMPLETED)
 * - 단계 관리
 * - 자동 승인 모드
 * - Computed 속성
 *
 * @packageDocumentation
 */

import { AgentModeState, agentModeState } from "../agent-mode-state";
import { AgentModeStatus, ApprovalStatus, StepType } from "../agent-mode-types";

// ============================================
// 🎯 테스트
// ============================================

describe("agentModeState", () => {
  beforeEach(() => {
    agentModeState.reset();
  });

  // ============================================
  // 기본 상태
  // ============================================

  describe("기본 상태", () => {
    it("초기 상태는 IDLE이어야 함", () => {
      expect(agentModeState.status).toBe(AgentModeStatus.IDLE);
    });

    it("초기 목표는 null이어야 함", () => {
      expect(agentModeState.goal).toBeNull();
    });

    it("초기 단계 목록은 비어있어야 함", () => {
      expect(agentModeState.steps).toHaveLength(0);
    });

    it("초기 자동 승인은 비활성화되어야 함", () => {
      expect(agentModeState.isAutoApproveEnabled).toBe(false);
    });
  });

  // ============================================
  // Agent Mode 라이프사이클
  // ============================================

  describe("Agent Mode 라이프사이클", () => {
    it("start 호출 시 RUNNING 상태가 되어야 함", () => {
      agentModeState.start("테스트 목표");

      expect(agentModeState.status).toBe(AgentModeStatus.RUNNING);
      expect(agentModeState.goal).toBe("테스트 목표");
      expect(agentModeState.isActive).toBe(true);
    });

    it("pause 호출 시 PAUSED 상태가 되어야 함", () => {
      agentModeState.start("테스트");
      agentModeState.pause();

      expect(agentModeState.status).toBe(AgentModeStatus.PAUSED);
    });

    it("resume 호출 시 RUNNING 상태로 돌아가야 함", () => {
      agentModeState.start("테스트");
      agentModeState.pause();
      agentModeState.resume();

      expect(agentModeState.status).toBe(AgentModeStatus.RUNNING);
    });

    it("stop 호출 시 STOPPED 상태가 되어야 함", () => {
      agentModeState.start("테스트");
      agentModeState.stop();

      expect(agentModeState.status).toBe(AgentModeStatus.STOPPED);
    });

    it("complete 호출 시 COMPLETED 상태가 되어야 함", () => {
      agentModeState.start("테스트");
      agentModeState.complete();

      expect(agentModeState.status).toBe(AgentModeStatus.COMPLETED);
    });

    it("setError 호출 시 ERROR 상태가 되어야 함", () => {
      agentModeState.start("테스트");
      agentModeState.setError("에러 발생");

      expect(agentModeState.status).toBe(AgentModeStatus.ERROR);
      expect(agentModeState.errorMessage).toBe("에러 발생");
    });

    it("reset 호출 시 초기 상태로 돌아가야 함", () => {
      agentModeState.start("테스트");
      agentModeState.addStep({
        type: StepType.THINKING,
        description: "생각",
      });
      agentModeState.enableAutoApprove();

      agentModeState.reset();

      expect(agentModeState.status).toBe(AgentModeStatus.IDLE);
      expect(agentModeState.goal).toBeNull();
      expect(agentModeState.steps).toHaveLength(0);
      expect(agentModeState.isAutoApproveEnabled).toBe(false);
    });
  });

  // ============================================
  // 단계 관리
  // ============================================

  describe("단계 관리", () => {
    beforeEach(() => {
      agentModeState.start("테스트");
    });

    it("단계를 추가할 수 있어야 함", () => {
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "코드 수정",
        requiresApproval: true,
      });

      expect(agentModeState.steps).toHaveLength(1);
      expect(agentModeState.steps[0].type).toBe(StepType.CODE_EDIT);
      expect(agentModeState.steps[0].description).toBe("코드 수정");
    });

    it("단계 추가 시 고유 ID가 부여되어야 함", () => {
      agentModeState.addStep({
        type: StepType.THINKING,
        description: "분석",
      });

      expect(agentModeState.steps[0].id).toBeDefined();
      expect(agentModeState.steps[0].id.length).toBeGreaterThan(0);
    });

    it("승인이 필요 없는 단계는 AUTO_APPROVED가 되어야 함", () => {
      agentModeState.addStep({
        type: StepType.THINKING,
        description: "생각",
      });

      expect(agentModeState.steps[0].status).toBe(ApprovalStatus.AUTO_APPROVED);
    });

    it("승인이 필요한 단계는 PENDING이 되어야 함", () => {
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });

      expect(agentModeState.steps[0].status).toBe(ApprovalStatus.PENDING);
    });

    it("단계를 승인할 수 있어야 함", () => {
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });
      const stepId = agentModeState.steps[0].id;

      agentModeState.approveStep(stepId);

      expect(agentModeState.steps[0].status).toBe(ApprovalStatus.APPROVED);
    });

    it("단계를 거부할 수 있어야 함", () => {
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });
      const stepId = agentModeState.steps[0].id;

      agentModeState.rejectStep(stepId, "불필요함");

      expect(agentModeState.steps[0].status).toBe(ApprovalStatus.REJECTED);
      expect(agentModeState.steps[0].rejectionReason).toBe("불필요함");
    });

    it("모든 대기 중인 단계를 승인할 수 있어야 함", () => {
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 1",
        requiresApproval: true,
      });
      agentModeState.addStep({
        type: StepType.FILE_CREATE,
        description: "생성",
        requiresApproval: true,
      });

      agentModeState.approveAllPending();

      expect(agentModeState.steps[0].status).toBe(ApprovalStatus.APPROVED);
      expect(agentModeState.steps[1].status).toBe(ApprovalStatus.APPROVED);
    });
  });

  // ============================================
  // 자동 승인 모드
  // ============================================

  describe("자동 승인 모드", () => {
    beforeEach(() => {
      agentModeState.start("테스트");
    });

    it("자동 승인을 활성화할 수 있어야 함", () => {
      agentModeState.enableAutoApprove();

      expect(agentModeState.isAutoApproveEnabled).toBe(true);
    });

    it("자동 승인을 비활성화할 수 있어야 함", () => {
      agentModeState.enableAutoApprove();
      agentModeState.disableAutoApprove();

      expect(agentModeState.isAutoApproveEnabled).toBe(false);
    });

    it("자동 승인 활성화 시 새 단계가 자동 승인되어야 함", () => {
      agentModeState.enableAutoApprove();
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });

      expect(agentModeState.steps[0].status).toBe(ApprovalStatus.AUTO_APPROVED);
    });

    it("횟수 제한 자동 승인이 작동해야 함", () => {
      agentModeState.enableAutoApprove(2);

      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 1",
        requiresApproval: true,
      });
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 2",
        requiresApproval: true,
      });
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 3",
        requiresApproval: true,
      });

      expect(agentModeState.steps[0].status).toBe(ApprovalStatus.AUTO_APPROVED);
      expect(agentModeState.steps[1].status).toBe(ApprovalStatus.AUTO_APPROVED);
      expect(agentModeState.steps[2].status).toBe(ApprovalStatus.PENDING);
      expect(agentModeState.isAutoApproveEnabled).toBe(false);
    });

    it("자동 승인 남은 횟수를 확인할 수 있어야 함", () => {
      agentModeState.enableAutoApprove(5);

      expect(agentModeState.autoApproveRemaining).toBe(5);
    });
  });

  // ============================================
  // Computed 속성
  // ============================================

  describe("Computed 속성", () => {
    beforeEach(() => {
      agentModeState.start("테스트");
    });

    it("isActive가 IDLE이 아닐 때 true여야 함", () => {
      expect(agentModeState.isActive).toBe(true);
    });

    it("isActive가 IDLE일 때 false여야 함", () => {
      agentModeState.reset();
      expect(agentModeState.isActive).toBe(false);
    });

    it("hasPendingApprovals가 대기 중인 단계가 있을 때 true여야 함", () => {
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });

      expect(agentModeState.hasPendingApprovals).toBe(true);
    });

    it("hasPendingApprovals가 대기 중인 단계가 없을 때 false여야 함", () => {
      agentModeState.addStep({
        type: StepType.THINKING,
        description: "생각",
      });

      expect(agentModeState.hasPendingApprovals).toBe(false);
    });

    it("completedStepCount가 정확해야 함", () => {
      agentModeState.addStep({
        type: StepType.THINKING,
        description: "분석",
      });
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });
      const stepId = agentModeState.steps[1].id;
      agentModeState.approveStep(stepId);

      expect(agentModeState.completedStepCount).toBe(2);
    });

    it("totalStepCount가 정확해야 함", () => {
      agentModeState.addStep({
        type: StepType.THINKING,
        description: "분석",
      });
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });

      expect(agentModeState.totalStepCount).toBe(2);
    });

    it("progressPercentage가 정확해야 함", () => {
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 1",
        requiresApproval: true,
      });
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 2",
        requiresApproval: true,
      });
      const stepId = agentModeState.steps[0].id;
      agentModeState.approveStep(stepId);

      expect(agentModeState.progressPercentage).toBe(50);
    });

    it("currentStep이 마지막 단계를 반환해야 함", () => {
      agentModeState.addStep({
        type: StepType.THINKING,
        description: "분석",
      });
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });

      expect(agentModeState.currentStep?.description).toBe("수정");
    });

    it("빈 단계일 때 currentStep이 null이어야 함", () => {
      expect(agentModeState.currentStep).toBeNull();
    });
  });

  // ============================================
  // 시간 추적
  // ============================================

  describe("시간 추적", () => {
    it("start 시 startedAt이 설정되어야 함", () => {
      agentModeState.start("테스트");

      expect(agentModeState.startedAt).not.toBeNull();
      expect(agentModeState.startedAt).toBeLessThanOrEqual(Date.now());
    });

    it("duration이 계산되어야 함", () => {
      agentModeState.start("테스트");

      // 약간의 시간 경과
      const duration = agentModeState.duration;

      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // 통계
  // ============================================

  describe("통계", () => {
    beforeEach(() => {
      agentModeState.start("테스트");
    });

    it("getStatistics가 올바른 통계를 반환해야 함", () => {
      agentModeState.addStep({
        type: StepType.THINKING,
        description: "분석",
      });
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 1",
        requiresApproval: true,
      });
      agentModeState.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 2",
        requiresApproval: true,
      });
      agentModeState.rejectStep(agentModeState.steps[2].id, "취소");

      const stats = agentModeState.getStatistics();

      expect(stats.totalSteps).toBe(3);
      expect(stats.completedSteps).toBe(1); // THINKING (auto-approved)
      expect(stats.rejectedSteps).toBe(1);
      expect(stats.pendingSteps).toBe(1);
      expect(stats.stepsByType[StepType.THINKING]).toBe(1);
      expect(stats.stepsByType[StepType.CODE_EDIT]).toBe(2);
    });
  });
});

// ============================================
// 🎯 클래스 테스트
// ============================================

describe("AgentModeState 클래스", () => {
  it("싱글톤이 존재해야 함", () => {
    expect(agentModeState).toBeDefined();
    expect(agentModeState).toBeInstanceOf(AgentModeState);
  });
});
