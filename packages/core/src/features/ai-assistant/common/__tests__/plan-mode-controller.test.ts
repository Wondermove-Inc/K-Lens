/**
 * 🎯 목적: PlanModeController 테스트
 * 01: PlanModeController 클래스 구현
 *
 * 📝 테스트 범위:
 * - Plan Mode 활성화/비활성화
 * - 계획 단계 생성
 * - 계획 실행 제어
 * - planState와 연동
 *
 * @packageDocumentation
 */

import { createPlanModeController, PlanModeController } from "../plan-mode-controller";
import { createPlanStep, planState } from "../plan-state";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("PlanModeController", () => {
  let controller: PlanModeController;

  beforeEach(() => {
    planState.reset();
    controller = createPlanModeController();
  });

  afterEach(() => {
    planState.reset();
  });

  // ============================================
  // 🔹 Plan Mode 활성화/비활성화
  // ============================================

  describe("Plan Mode 활성화/비활성화", () => {
    it("enterPlanMode()가 planState 활성화", () => {
      controller.enterPlanMode("테스트 계획");

      expect(planState.isActive).toBe(true);
      expect(planState.status).toBe("drafting");
      expect(planState.title).toBe("테스트 계획");
    });

    it("exitPlanMode()가 planState 비활성화", () => {
      controller.enterPlanMode("테스트 계획");
      controller.exitPlanMode();

      expect(planState.isActive).toBe(false);
      expect(planState.status).toBe("idle");
    });

    it("isInPlanMode()가 현재 상태 반환", () => {
      expect(controller.isInPlanMode()).toBe(false);

      controller.enterPlanMode("계획");
      expect(controller.isInPlanMode()).toBe(true);

      controller.exitPlanMode();
      expect(controller.isInPlanMode()).toBe(false);
    });

    it("중복 enterPlanMode()는 새 계획으로 교체", () => {
      controller.enterPlanMode("첫 번째");
      controller.addStep("단계 1");

      controller.enterPlanMode("두 번째");

      expect(planState.title).toBe("두 번째");
      expect(planState.steps.length).toBe(0);
    });
  });

  // ============================================
  // 🔹 단계 추가
  // ============================================

  describe("단계 추가", () => {
    beforeEach(() => {
      controller.enterPlanMode("테스트 계획");
    });

    it("addStep()이 단계 추가", () => {
      controller.addStep("Pod 확인");

      expect(planState.steps.length).toBe(1);
      expect(planState.steps[0].title).toBe("Pod 확인");
      expect(planState.steps[0].status).toBe("pending");
    });

    it("addStep()이 명령어와 함께 추가", () => {
      controller.addStep("Pod 목록 조회", "kubectl get pods");

      expect(planState.steps[0].command).toBe("kubectl get pods");
    });

    it("addStep()이 설명과 함께 추가", () => {
      controller.addStep("리소스 분석", undefined, "CPU 사용량을 분석합니다");

      expect(planState.steps[0].description).toBe("CPU 사용량을 분석합니다");
    });

    it("addSteps()가 여러 단계 추가", () => {
      controller.addSteps([
        { title: "단계 1" },
        { title: "단계 2", command: "echo test" },
        { title: "단계 3", description: "설명" },
      ]);

      expect(planState.steps.length).toBe(3);
      expect(planState.steps.map((s) => s.title)).toEqual(["단계 1", "단계 2", "단계 3"]);
    });

    it("Plan Mode가 아닐 때 addStep()은 무시", () => {
      controller.exitPlanMode();
      controller.addStep("테스트");

      expect(planState.steps.length).toBe(0);
    });
  });

  // ============================================
  // 🔹 계획 승인/거부
  // ============================================

  describe("계획 승인/거부", () => {
    beforeEach(() => {
      controller.enterPlanMode("테스트 계획");
      controller.addStep("단계 1");
      controller.addStep("단계 2");
    });

    it("approvePlan()이 실행 모드로 전환", () => {
      const result = controller.approvePlan();

      expect(result).toBe(true);
      expect(planState.status).toBe("executing");
      expect(planState.currentStepIndex).toBe(0);
    });

    it("rejectPlan()이 계획 거부", () => {
      controller.rejectPlan();

      expect(planState.status).toBe("rejected");
      expect(planState.isActive).toBe(false);
    });

    it("빈 계획은 승인 실패", () => {
      planState.reset();
      controller.enterPlanMode("빈 계획");

      const result = controller.approvePlan();

      expect(result).toBe(false);
      expect(planState.status).toBe("drafting");
    });
  });

  // ============================================
  // 🔹 실행 제어
  // ============================================

  describe("실행 제어", () => {
    beforeEach(() => {
      controller.enterPlanMode("테스트 계획");
      controller.addStep("단계 1");
      controller.addStep("단계 2");
      controller.addStep("단계 3");
      controller.approvePlan();
    });

    it("executeCurrentStep()이 현재 단계 시작", () => {
      controller.executeCurrentStep();

      expect(planState.steps[0].status).toBe("in_progress");
    });

    it("completeCurrentStep()이 현재 단계 완료", () => {
      controller.executeCurrentStep();
      controller.completeCurrentStep("성공");

      expect(planState.steps[0].status).toBe("completed");
      expect(planState.steps[0].result).toBe("성공");
    });

    it("moveToNextStep()이 다음 단계로 이동", () => {
      controller.executeCurrentStep();
      controller.completeCurrentStep();
      controller.moveToNextStep();

      expect(planState.currentStepIndex).toBe(1);
    });

    it("skipCurrentStep()이 현재 단계 건너뛰기", () => {
      controller.skipCurrentStep("필요 없음");

      expect(planState.steps[0].status).toBe("skipped");
      expect(planState.steps[0].result).toBe("필요 없음");
    });

    it("failCurrentStep()이 현재 단계 실패 처리", () => {
      controller.executeCurrentStep();
      controller.failCurrentStep("오류 발생");

      expect(planState.steps[0].status).toBe("failed");
      expect(planState.steps[0].error).toBe("오류 발생");
      expect(planState.status).toBe("failed");
    });

    it("executeStep()으로 특정 단계 실행", () => {
      controller.executeStep(1);

      expect(planState.steps[1].status).toBe("in_progress");
      expect(planState.currentStepIndex).toBe(1);
    });
  });

  // ============================================
  // 🔹 상태 조회
  // ============================================

  describe("상태 조회", () => {
    beforeEach(() => {
      controller.enterPlanMode("테스트 계획");
      controller.addStep("단계 1");
      controller.addStep("단계 2");
    });

    it("getStatus()가 현재 상태 반환", () => {
      expect(controller.getStatus()).toBe("drafting");

      controller.approvePlan();
      expect(controller.getStatus()).toBe("executing");
    });

    it("getSteps()가 단계 목록 반환", () => {
      const steps = controller.getSteps();

      expect(steps.length).toBe(2);
      expect(steps[0].title).toBe("단계 1");
    });

    it("getCurrentStep()이 현재 단계 반환", () => {
      controller.approvePlan();

      const current = controller.getCurrentStep();

      expect(current?.title).toBe("단계 1");
    });

    it("getProgress()가 진행률 반환", () => {
      controller.approvePlan();
      controller.executeCurrentStep();
      controller.completeCurrentStep();

      expect(controller.getProgress()).toBeCloseTo(50, 0);
    });

    it("canApprove()가 승인 가능 여부 반환", () => {
      expect(controller.canApprove()).toBe(true);

      controller.approvePlan();
      expect(controller.canApprove()).toBe(false);
    });

    it("isExecuting()가 실행 중 여부 반환", () => {
      expect(controller.isExecuting()).toBe(false);

      controller.approvePlan();
      expect(controller.isExecuting()).toBe(true);
    });
  });

  // ============================================
  // 🔹 전체 시나리오
  // ============================================

  describe("전체 시나리오", () => {
    it("계획 작성 → 승인 → 실행 → 완료 플로우", () => {
      // 1. 계획 작성
      controller.enterPlanMode("Kubernetes 정리 작업");
      controller.addSteps([
        { title: "미사용 ConfigMap 조회", command: "kubectl get cm" },
        { title: "삭제 대상 선정" },
        { title: "ConfigMap 삭제", command: "kubectl delete cm old-config" },
      ]);

      expect(controller.getSteps().length).toBe(3);
      expect(controller.getStatus()).toBe("drafting");

      // 2. 승인
      const approved = controller.approvePlan();
      expect(approved).toBe(true);
      expect(controller.isExecuting()).toBe(true);

      // 3. 단계별 실행
      // 단계 1 실행
      controller.executeCurrentStep();
      expect(planState.steps[0].status).toBe("in_progress");
      controller.completeCurrentStep("5개 ConfigMap 발견");
      controller.moveToNextStep();

      // 단계 2 실행
      controller.executeCurrentStep();
      controller.completeCurrentStep("old-config 선정");
      controller.moveToNextStep();

      // 단계 3 실행
      controller.executeCurrentStep();
      controller.completeCurrentStep("삭제 완료");
      controller.moveToNextStep();

      // 4. 완료 확인
      expect(controller.getStatus()).toBe("completed");
      expect(controller.getProgress()).toBe(100);
    });

    it("실행 중 실패 시나리오", () => {
      controller.enterPlanMode("배포");
      controller.addSteps([{ title: "빌드" }, { title: "테스트" }, { title: "배포" }]);
      controller.approvePlan();

      // 첫 단계 성공
      controller.executeCurrentStep();
      controller.completeCurrentStep();
      controller.moveToNextStep();

      // 두 번째 단계 실패
      controller.executeCurrentStep();
      controller.failCurrentStep("테스트 실패");

      expect(controller.getStatus()).toBe("failed");
      expect(planState.steps[1].status).toBe("failed");
    });

    it("계획 거부 시나리오", () => {
      controller.enterPlanMode("위험한 작업");
      controller.addStep("모든 Pod 삭제");

      controller.rejectPlan();

      expect(controller.getStatus()).toBe("rejected");
      expect(controller.isInPlanMode()).toBe(false);
    });
  });

  // ============================================
  // 🔹 콜백 지원
  // ============================================

  describe("콜백 지원", () => {
    it("onStepComplete 콜백 호출", () => {
      const onComplete = jest.fn();
      controller = createPlanModeController({ onStepComplete: onComplete });

      controller.enterPlanMode("테스트");
      controller.addStep("단계 1");
      controller.approvePlan();
      controller.executeCurrentStep();
      controller.completeCurrentStep("결과");

      expect(onComplete).toHaveBeenCalledWith(0, "결과");
    });

    it("onStepFail 콜백 호출", () => {
      const onFail = jest.fn();
      controller = createPlanModeController({ onStepFail: onFail });

      controller.enterPlanMode("테스트");
      controller.addStep("단계 1");
      controller.approvePlan();
      controller.executeCurrentStep();
      controller.failCurrentStep("에러");

      expect(onFail).toHaveBeenCalledWith(0, "에러");
    });

    it("onPlanComplete 콜백 호출", () => {
      const onPlanComplete = jest.fn();
      controller = createPlanModeController({ onPlanComplete: onPlanComplete });

      controller.enterPlanMode("테스트");
      controller.addStep("단계");
      controller.approvePlan();
      controller.executeCurrentStep();
      controller.completeCurrentStep();
      controller.moveToNextStep();

      expect(onPlanComplete).toHaveBeenCalled();
    });
  });
});
