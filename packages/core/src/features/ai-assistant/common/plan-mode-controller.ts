/**
 * 🎯 목적: Plan Mode 제어 컨트롤러
 * 01: PlanModeController 클래스 구현
 *
 * 📝 주요 기능:
 * - Plan Mode 진입/종료
 * - 계획 단계 관리
 * - 실행 제어
 *
 * @packageDocumentation
 */

import { PlanModeController, PlanModeControllerOptions, StepInput } from "./plan-mode-controller-types";
import { createPlanStep, PlanStatus, PlanStep, planState } from "./plan-state";

// 타입 재export
export type { StepInput, PlanModeControllerOptions, PlanModeController };

// ============================================
// 🎯 PlanModeController 구현
// ============================================

/**
 * PlanModeController 구현 클래스
 */
class PlanModeControllerImpl implements PlanModeController {
  private options: PlanModeControllerOptions;

  constructor(options: PlanModeControllerOptions = {}) {
    this.options = options;
  }

  // 라이프사이클
  enterPlanMode(title: string): void {
    planState.startPlanMode(title);
  }

  exitPlanMode(): void {
    planState.endPlanMode();
  }

  isInPlanMode(): boolean {
    return planState.isActive;
  }

  // 단계 관리
  addStep(title: string, command?: string, description?: string): void {
    if (!planState.isActive) return;
    planState.addStep(createPlanStep(title, command, description));
  }

  addSteps(steps: StepInput[]): void {
    if (!planState.isActive) return;
    for (const input of steps) {
      planState.addStep(createPlanStep(input.title, input.command, input.description));
    }
  }

  // 승인/거부
  approvePlan(): boolean {
    if (!planState.canApprove) return false;
    planState.approvePlan();
    return true;
  }

  rejectPlan(): void {
    planState.rejectPlan();
  }

  // 실행 제어
  executeCurrentStep(): void {
    const index = planState.currentStepIndex;
    if (index >= 0) planState.startStep(index);
  }

  completeCurrentStep(result?: string): void {
    const index = planState.currentStepIndex;
    if (index >= 0) {
      planState.completeStep(index, result);
      this.options.onStepComplete?.(index, result);
    }
  }

  moveToNextStep(): void {
    const previousStatus = planState.status;
    planState.nextStep();
    if (previousStatus === "executing" && planState.status === "completed") {
      this.options.onPlanComplete?.();
    }
  }

  skipCurrentStep(reason?: string): void {
    const index = planState.currentStepIndex;
    if (index >= 0) planState.skipStep(index, reason);
  }

  failCurrentStep(error?: string): void {
    const index = planState.currentStepIndex;
    if (index >= 0) {
      planState.failStep(index, error);
      this.options.onStepFail?.(index, error);
    }
  }

  executeStep(index: number): void {
    planState.startStep(index);
  }

  // 상태 조회
  getStatus(): PlanStatus {
    return planState.status;
  }

  getSteps(): PlanStep[] {
    return planState.steps;
  }

  getCurrentStep(): PlanStep | undefined {
    return planState.currentStep;
  }

  getProgress(): number {
    return planState.progressPercentage;
  }

  canApprove(): boolean {
    return planState.canApprove;
  }

  isExecuting(): boolean {
    return planState.isExecuting;
  }
}

// ============================================
// 🎯 팩토리 함수
// ============================================

/**
 * PlanModeController 인스턴스 생성
 *
 * @param options - 콜백 옵션
 * @returns PlanModeController 인스턴스
 */
export function createPlanModeController(options: PlanModeControllerOptions = {}): PlanModeController {
  return new PlanModeControllerImpl(options);
}
