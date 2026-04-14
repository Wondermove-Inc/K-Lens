/**
 * 🎯 목적: AgentModeController 테스트
 * 01: AgentModeController 클래스 구현 (TDD)
 *
 * 📝 테스트 범위:
 * - Agent Mode 상태 관리
 * - 단계별 실행 제어
 * - 승인/거부 처리
 * - 자동 실행 관리
 *
 * @packageDocumentation
 */

import { AgentModeController, AgentModeStatus, AgentStep, ApprovalStatus, StepType } from "../agent-mode-controller";

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

describe("AgentModeController", () => {
  let controller: AgentModeController;

  beforeEach(() => {
    Object.values(mockLogger).forEach((fn) => fn.mockClear());
    controller = new AgentModeController({ logger: mockLogger as any });
  });

  // ============================================
  // 기본 상태 관리
  // ============================================

  describe("기본 상태 관리", () => {
    it("초기 상태는 idle이어야 함", () => {
      expect(controller.status).toBe(AgentModeStatus.IDLE);
    });

    it("Agent Mode를 시작할 수 있어야 함", () => {
      controller.start("테스트 목표");

      expect(controller.status).toBe(AgentModeStatus.RUNNING);
      expect(controller.goal).toBe("테스트 목표");
    });

    it("Agent Mode를 일시정지할 수 있어야 함", () => {
      controller.start("목표");
      controller.pause();

      expect(controller.status).toBe(AgentModeStatus.PAUSED);
    });

    it("일시정지된 Agent Mode를 재개할 수 있어야 함", () => {
      controller.start("목표");
      controller.pause();
      controller.resume();

      expect(controller.status).toBe(AgentModeStatus.RUNNING);
    });

    it("Agent Mode를 중지할 수 있어야 함", () => {
      controller.start("목표");
      controller.stop();

      expect(controller.status).toBe(AgentModeStatus.STOPPED);
    });

    it("Agent Mode를 완료할 수 있어야 함", () => {
      controller.start("목표");
      controller.complete();

      expect(controller.status).toBe(AgentModeStatus.COMPLETED);
    });

    it("에러 발생 시 error 상태로 전환해야 함", () => {
      controller.start("목표");
      controller.setError("에러 발생");

      expect(controller.status).toBe(AgentModeStatus.ERROR);
      expect(controller.errorMessage).toBe("에러 발생");
    });

    it("리셋 시 초기 상태로 돌아가야 함", () => {
      controller.start("목표");
      controller.addStep({ type: StepType.THINKING, description: "생각 중" });
      controller.stop();
      controller.reset();

      expect(controller.status).toBe(AgentModeStatus.IDLE);
      expect(controller.goal).toBeNull();
      expect(controller.steps).toHaveLength(0);
    });
  });

  // ============================================
  // 단계 관리
  // ============================================

  describe("단계 관리", () => {
    beforeEach(() => {
      controller.start("목표");
    });

    it("새 단계를 추가할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "코드 수정",
        requiresApproval: true,
      });

      expect(step.id).toBeDefined();
      expect(step.type).toBe(StepType.CODE_EDIT);
      expect(step.status).toBe(ApprovalStatus.PENDING);
      expect(controller.steps).toHaveLength(1);
    });

    it("여러 단계를 추가할 수 있어야 함", () => {
      controller.addStep({ type: StepType.THINKING, description: "분석" });
      controller.addStep({ type: StepType.TOOL_CALL, description: "파일 읽기" });
      controller.addStep({ type: StepType.CODE_EDIT, description: "코드 수정" });

      expect(controller.steps).toHaveLength(3);
    });

    it("현재 단계를 가져올 수 있어야 함", () => {
      controller.addStep({ type: StepType.THINKING, description: "분석" });
      const step2 = controller.addStep({ type: StepType.TOOL_CALL, description: "실행" });

      expect(controller.currentStep?.id).toBe(step2.id);
    });

    it("단계 상태를 업데이트할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.THINKING,
        description: "분석",
      });

      controller.updateStepStatus(step.id, ApprovalStatus.APPROVED);

      expect(controller.getStep(step.id)?.status).toBe(ApprovalStatus.APPROVED);
    });

    it("단계 결과를 설정할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.TOOL_CALL,
        description: "파일 읽기",
      });

      controller.setStepResult(step.id, "파일 내용입니다");

      expect(controller.getStep(step.id)?.result).toBe("파일 내용입니다");
    });

    it("완료된 단계 수를 계산할 수 있어야 함", () => {
      const step1 = controller.addStep({ type: StepType.THINKING, description: "1" });
      const step2 = controller.addStep({ type: StepType.TOOL_CALL, description: "2" });
      controller.addStep({ type: StepType.CODE_EDIT, description: "3" });

      controller.updateStepStatus(step1.id, ApprovalStatus.APPROVED);
      controller.updateStepStatus(step2.id, ApprovalStatus.APPROVED);

      expect(controller.completedStepCount).toBe(2);
      expect(controller.totalStepCount).toBe(3);
    });
  });

  // ============================================
  // 단계 타입
  // ============================================

  describe("단계 타입", () => {
    beforeEach(() => {
      controller.start("목표");
    });

    it("THINKING 타입 단계를 추가할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.THINKING,
        description: "문제 분석",
      });

      expect(step.type).toBe(StepType.THINKING);
    });

    it("TOOL_CALL 타입 단계를 추가할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.TOOL_CALL,
        description: "kubectl get pods",
        toolName: "kubectl",
        toolInput: { command: "get pods" },
      });

      expect(step.type).toBe(StepType.TOOL_CALL);
      expect(step.toolName).toBe("kubectl");
    });

    it("CODE_EDIT 타입 단계를 추가할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "파일 수정",
        filePath: "/src/index.ts",
        diff: "+ console.log('hello');",
      });

      expect(step.type).toBe(StepType.CODE_EDIT);
      expect(step.filePath).toBe("/src/index.ts");
    });

    it("FILE_CREATE 타입 단계를 추가할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.FILE_CREATE,
        description: "새 파일 생성",
        filePath: "/src/new-file.ts",
      });

      expect(step.type).toBe(StepType.FILE_CREATE);
    });

    it("FILE_DELETE 타입 단계를 추가할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.FILE_DELETE,
        description: "파일 삭제",
        filePath: "/src/old-file.ts",
      });

      expect(step.type).toBe(StepType.FILE_DELETE);
    });

    it("COMMAND 타입 단계를 추가할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.COMMAND,
        description: "npm install 실행",
        command: "npm install",
      });

      expect(step.type).toBe(StepType.COMMAND);
      expect(step.command).toBe("npm install");
    });

    it("RESPONSE 타입 단계를 추가할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.RESPONSE,
        description: "사용자에게 응답",
        content: "작업이 완료되었습니다.",
      });

      expect(step.type).toBe(StepType.RESPONSE);
      expect(step.content).toBe("작업이 완료되었습니다.");
    });
  });

  // ============================================
  // 승인 처리
  // ============================================

  describe("승인 처리", () => {
    beforeEach(() => {
      controller.start("목표");
    });

    it("단계를 승인할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "코드 수정",
        requiresApproval: true,
      });

      controller.approveStep(step.id);

      expect(controller.getStep(step.id)?.status).toBe(ApprovalStatus.APPROVED);
    });

    it("단계를 거부할 수 있어야 함", () => {
      const step = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "코드 수정",
        requiresApproval: true,
      });

      controller.rejectStep(step.id, "이 변경은 필요하지 않습니다");

      const rejectedStep = controller.getStep(step.id);
      expect(rejectedStep?.status).toBe(ApprovalStatus.REJECTED);
      expect(rejectedStep?.rejectionReason).toBe("이 변경은 필요하지 않습니다");
    });

    it("모든 대기 중인 단계를 승인할 수 있어야 함", () => {
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

      controller.approveAllPending();

      expect(controller.getStep(step1.id)?.status).toBe(ApprovalStatus.APPROVED);
      expect(controller.getStep(step2.id)?.status).toBe(ApprovalStatus.APPROVED);
    });

    it("승인이 필요한 단계가 있는지 확인할 수 있어야 함", () => {
      expect(controller.hasPendingApprovals).toBe(false);

      controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });

      expect(controller.hasPendingApprovals).toBe(true);
    });

    it("승인이 필요하지 않은 단계는 자동 승인되어야 함", () => {
      const step = controller.addStep({
        type: StepType.THINKING,
        description: "분석",
        requiresApproval: false,
      });

      expect(controller.getStep(step.id)?.status).toBe(ApprovalStatus.AUTO_APPROVED);
    });
  });

  // ============================================
  // 자동 실행 모드
  // ============================================

  describe("자동 실행 모드", () => {
    beforeEach(() => {
      controller.start("목표");
    });

    it("자동 실행 모드를 활성화할 수 있어야 함", () => {
      expect(controller.isAutoApproveEnabled).toBe(false);

      controller.enableAutoApprove();

      expect(controller.isAutoApproveEnabled).toBe(true);
    });

    it("자동 실행 모드를 비활성화할 수 있어야 함", () => {
      controller.enableAutoApprove();
      controller.disableAutoApprove();

      expect(controller.isAutoApproveEnabled).toBe(false);
    });

    it("자동 실행 모드에서는 모든 단계가 자동 승인되어야 함", () => {
      controller.enableAutoApprove();

      const step = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "코드 수정",
        requiresApproval: true,
      });

      expect(controller.getStep(step.id)?.status).toBe(ApprovalStatus.AUTO_APPROVED);
    });

    it("자동 실행 횟수 제한을 설정할 수 있어야 함", () => {
      controller.enableAutoApprove(3);

      expect(controller.autoApproveRemaining).toBe(3);
    });

    it("자동 실행 횟수가 감소해야 함", () => {
      controller.enableAutoApprove(3);

      controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정 1",
        requiresApproval: true,
      });

      expect(controller.autoApproveRemaining).toBe(2);
    });

    it("자동 실행 횟수가 0이 되면 비활성화되어야 함", () => {
      controller.enableAutoApprove(1);

      controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });

      expect(controller.isAutoApproveEnabled).toBe(false);
    });
  });

  // ============================================
  // 진행률
  // ============================================

  describe("진행률", () => {
    beforeEach(() => {
      controller.start("목표");
    });

    it("진행률을 계산할 수 있어야 함", () => {
      const step1 = controller.addStep({
        type: StepType.TOOL_CALL,
        description: "1",
        requiresApproval: true,
      });
      const step2 = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "2",
        requiresApproval: true,
      });
      controller.addStep({
        type: StepType.COMMAND,
        description: "3",
        requiresApproval: true,
      });
      controller.addStep({
        type: StepType.FILE_CREATE,
        description: "4",
        requiresApproval: true,
      });

      controller.updateStepStatus(step1.id, ApprovalStatus.APPROVED);
      controller.updateStepStatus(step2.id, ApprovalStatus.APPROVED);

      expect(controller.progressPercentage).toBe(50);
    });

    it("단계가 없으면 진행률은 0이어야 함", () => {
      expect(controller.progressPercentage).toBe(0);
    });

    it("모든 단계가 완료되면 진행률은 100이어야 함", () => {
      const step1 = controller.addStep({ type: StepType.THINKING, description: "1" });
      const step2 = controller.addStep({ type: StepType.RESPONSE, description: "2" });

      controller.updateStepStatus(step1.id, ApprovalStatus.APPROVED);
      controller.updateStepStatus(step2.id, ApprovalStatus.APPROVED);

      expect(controller.progressPercentage).toBe(100);
    });
  });

  // ============================================
  // 이벤트/콜백
  // ============================================

  describe("이벤트/콜백", () => {
    it("상태 변경 시 콜백이 호출되어야 함", () => {
      const onStatusChange = jest.fn();
      controller.onStatusChange(onStatusChange);

      controller.start("목표");

      expect(onStatusChange).toHaveBeenCalledWith(AgentModeStatus.RUNNING);
    });

    it("단계 추가 시 콜백이 호출되어야 함", () => {
      const onStepAdded = jest.fn();
      controller.onStepAdded(onStepAdded);
      controller.start("목표");

      const step = controller.addStep({
        type: StepType.THINKING,
        description: "분석",
      });

      expect(onStepAdded).toHaveBeenCalledWith(expect.objectContaining({ id: step.id }));
    });

    it("승인 대기 시 콜백이 호출되어야 함", () => {
      const onApprovalRequired = jest.fn();
      controller.onApprovalRequired(onApprovalRequired);
      controller.start("목표");

      const step = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "수정",
        requiresApproval: true,
      });

      expect(onApprovalRequired).toHaveBeenCalledWith(expect.objectContaining({ id: step.id }));
    });

    it("콜백을 제거할 수 있어야 함", () => {
      const onStatusChange = jest.fn();
      const unsubscribe = controller.onStatusChange(onStatusChange);

      unsubscribe();
      controller.start("목표");

      expect(onStatusChange).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // 통계
  // ============================================

  describe("통계", () => {
    beforeEach(() => {
      controller.start("목표");
    });

    it("실행 통계를 가져올 수 있어야 함", () => {
      const step1 = controller.addStep({ type: StepType.THINKING, description: "1" });
      const step2 = controller.addStep({ type: StepType.TOOL_CALL, description: "2" });
      const step3 = controller.addStep({
        type: StepType.CODE_EDIT,
        description: "3",
        requiresApproval: true,
      });

      controller.updateStepStatus(step1.id, ApprovalStatus.APPROVED);
      controller.updateStepStatus(step2.id, ApprovalStatus.APPROVED);
      controller.rejectStep(step3.id, "불필요");

      const stats = controller.getStatistics();

      expect(stats.totalSteps).toBe(3);
      expect(stats.completedSteps).toBe(2);
      expect(stats.rejectedSteps).toBe(1);
      expect(stats.pendingSteps).toBe(0);
    });

    it("타입별 단계 수를 계산할 수 있어야 함", () => {
      controller.addStep({ type: StepType.THINKING, description: "1" });
      controller.addStep({ type: StepType.THINKING, description: "2" });
      controller.addStep({ type: StepType.TOOL_CALL, description: "3" });
      controller.addStep({ type: StepType.CODE_EDIT, description: "4" });

      const stats = controller.getStatistics();

      expect(stats.stepsByType[StepType.THINKING]).toBe(2);
      expect(stats.stepsByType[StepType.TOOL_CALL]).toBe(1);
      expect(stats.stepsByType[StepType.CODE_EDIT]).toBe(1);
    });
  });

  // ============================================
  // 시간 추적
  // ============================================

  describe("시간 추적", () => {
    it("시작 시간을 기록해야 함", () => {
      const beforeStart = Date.now();
      controller.start("목표");
      const afterStart = Date.now();

      expect(controller.startedAt).toBeGreaterThanOrEqual(beforeStart);
      expect(controller.startedAt).toBeLessThanOrEqual(afterStart);
    });

    it("완료 시 소요 시간을 계산할 수 있어야 함", async () => {
      controller.start("목표");

      // 짧은 대기
      await new Promise((resolve) => setTimeout(resolve, 50));

      controller.complete();

      expect(controller.duration).toBeGreaterThan(0);
    });

    it("실행 중이면 현재까지 소요 시간을 반환해야 함", async () => {
      controller.start("목표");

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(controller.duration).toBeGreaterThan(0);
    });
  });
});
