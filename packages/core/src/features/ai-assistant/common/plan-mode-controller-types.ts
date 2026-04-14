/**
 * 🎯 목적: PlanModeController 타입 정의
 * 01: PlanModeController 타입
 *
 * @packageDocumentation
 */

import { PlanStatus, PlanStep } from "./plan-types";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 단계 입력 인터페이스
 */
export interface StepInput {
  /** 단계 제목 */
  title: string;
  /** 실행할 명령어 (선택) */
  command?: string;
  /** 상세 설명 (선택) */
  description?: string;
}

/**
 * 콜백 옵션 인터페이스
 */
export interface PlanModeControllerOptions {
  /** 단계 완료 시 콜백 */
  onStepComplete?: (stepIndex: number, result?: string) => void;
  /** 단계 실패 시 콜백 */
  onStepFail?: (stepIndex: number, error?: string) => void;
  /** 계획 완료 시 콜백 */
  onPlanComplete?: () => void;
}

/**
 * PlanModeController 인터페이스
 */
export interface PlanModeController {
  /** Plan Mode 진입 */
  enterPlanMode(title: string): void;
  /** Plan Mode 종료 */
  exitPlanMode(): void;
  /** Plan Mode 여부 확인 */
  isInPlanMode(): boolean;

  /** 단계 추가 */
  addStep(title: string, command?: string, description?: string): void;
  /** 여러 단계 추가 */
  addSteps(steps: StepInput[]): void;

  /** 계획 승인 */
  approvePlan(): boolean;
  /** 계획 거부 */
  rejectPlan(): void;

  /** 현재 단계 실행 시작 */
  executeCurrentStep(): void;
  /** 현재 단계 완료 */
  completeCurrentStep(result?: string): void;
  /** 다음 단계로 이동 */
  moveToNextStep(): void;
  /** 현재 단계 건너뛰기 */
  skipCurrentStep(reason?: string): void;
  /** 현재 단계 실패 */
  failCurrentStep(error?: string): void;
  /** 특정 단계 실행 */
  executeStep(index: number): void;

  /** 현재 상태 조회 */
  getStatus(): PlanStatus;
  /** 모든 단계 조회 */
  getSteps(): PlanStep[];
  /** 현재 단계 조회 */
  getCurrentStep(): PlanStep | undefined;
  /** 진행률 조회 */
  getProgress(): number;
  /** 승인 가능 여부 */
  canApprove(): boolean;
  /** 실행 중 여부 */
  isExecuting(): boolean;
}
