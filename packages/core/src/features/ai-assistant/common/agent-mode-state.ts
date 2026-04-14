/**
 * 🎯 목적: Agent Mode MobX 상태 관리
 * 01: agentModeState 상태 및 액션 추가
 *
 * 📝 주요 기능:
 * - Agent Mode 활성화/비활성화
 * - 상태 전환 관리
 * - 단계 관리 (추가, 승인, 거부)
 * - 자동 승인 모드
 * - 통계 제공
 *
 * @packageDocumentation
 */

import { action, makeAutoObservable } from "mobx";
import {
  type AddStepInput,
  type AgentModeStatistics,
  AgentModeStatus,
  type AgentStep,
  ApprovalStatus,
  StepType,
} from "./agent-mode-types";

// ============================================
// 🎯 AgentModeState 클래스
// ============================================

/**
 * Agent Mode 상태 관리 클래스
 *
 * 📝 MobX makeAutoObservable을 사용한 반응형 상태
 */
export class AgentModeState {
  /** 현재 상태 */
  status: AgentModeStatus = AgentModeStatus.IDLE;

  /** 실행 목표 */
  goal: string | null = null;

  /** 실행 단계들 */
  steps: AgentStep[] = [];

  /** 에러 메시지 */
  errorMessage: string | null = null;

  /** 자동 승인 활성화 여부 */
  private _autoApproveEnabled = false;

  /** 자동 승인 남은 횟수 (-1 = 무제한) */
  private _autoApproveRemaining = -1;

  /** 시작 시간 */
  startedAt: number | null = null;

  /** 완료 시간 */
  private _completedAt: number | null = null;

  constructor() {
    makeAutoObservable(this, {
      start: action,
      pause: action,
      resume: action,
      stop: action,
      complete: action,
      setError: action,
      reset: action,
      addStep: action,
      approveStep: action,
      rejectStep: action,
      approveAllPending: action,
      enableAutoApprove: action,
      disableAutoApprove: action,
    });
  }

  // ============================================
  // 🔹 Agent Mode 라이프사이클
  // ============================================

  /**
   * Agent Mode 시작
   *
   * @param goalText - 실행 목표
   */
  start(goalText: string): void {
    this.goal = goalText;
    this.startedAt = Date.now();
    this._completedAt = null;
    this.status = AgentModeStatus.RUNNING;
  }

  /**
   * Agent Mode 일시정지
   */
  pause(): void {
    if (this.status === AgentModeStatus.RUNNING) {
      this.status = AgentModeStatus.PAUSED;
    }
  }

  /**
   * Agent Mode 재개
   */
  resume(): void {
    if (this.status === AgentModeStatus.PAUSED) {
      this.status = AgentModeStatus.RUNNING;
    }
  }

  /**
   * Agent Mode 중지
   */
  stop(): void {
    this._completedAt = Date.now();
    this.status = AgentModeStatus.STOPPED;
  }

  /**
   * Agent Mode 완료
   */
  complete(): void {
    this._completedAt = Date.now();
    this.status = AgentModeStatus.COMPLETED;
  }

  /**
   * 에러 설정
   *
   * @param message - 에러 메시지
   */
  setError(message: string): void {
    this.errorMessage = message;
    this._completedAt = Date.now();
    this.status = AgentModeStatus.ERROR;
  }

  /**
   * 상태 리셋
   */
  reset(): void {
    this.status = AgentModeStatus.IDLE;
    this.goal = null;
    this.steps = [];
    this.errorMessage = null;
    this._autoApproveEnabled = false;
    this._autoApproveRemaining = -1;
    this.startedAt = null;
    this._completedAt = null;
  }

  // ============================================
  // 🔹 단계 관리
  // ============================================

  /**
   * 새 단계 추가
   *
   * @param input - 단계 입력 정보
   */
  addStep(input: AddStepInput): void {
    const requiresApproval = input.requiresApproval ?? this.getDefaultRequiresApproval(input.type);

    const step = this.createStep(input, requiresApproval);

    // 자동 승인 처리
    if (requiresApproval && this._autoApproveEnabled) {
      step.status = ApprovalStatus.AUTO_APPROVED;
      this.decrementAutoApprove();
    } else if (!requiresApproval) {
      step.status = ApprovalStatus.AUTO_APPROVED;
    }

    this.steps.push(step);
  }

  /**
   * 단계 승인
   *
   * @param stepId - 단계 ID
   */
  approveStep(stepId: string): void {
    const step = this.steps.find((s) => s.id === stepId);

    if (step) {
      step.status = ApprovalStatus.APPROVED;
    }
  }

  /**
   * 단계 거부
   *
   * @param stepId - 단계 ID
   * @param reason - 거부 사유
   */
  rejectStep(stepId: string, reason?: string): void {
    const step = this.steps.find((s) => s.id === stepId);

    if (step) {
      step.status = ApprovalStatus.REJECTED;
      step.rejectionReason = reason;
    }
  }

  /**
   * 모든 대기 중인 단계 승인
   */
  approveAllPending(): void {
    this.steps.forEach((step) => {
      if (step.status === ApprovalStatus.PENDING) {
        step.status = ApprovalStatus.APPROVED;
      }
    });
  }

  /**
   * 단계 생성 헬퍼
   *
   * @param input - 단계 입력 정보
   * @param requiresApproval - 승인 필요 여부
   * @returns 생성된 단계
   */
  private createStep(input: AddStepInput, requiresApproval: boolean): AgentStep {
    const base = {
      id: this.generateId(),
      type: input.type,
      description: input.description,
      status: ApprovalStatus.PENDING,
      createdAt: Date.now(),
      requiresApproval,
    };

    // 타입별 추가 필드
    switch (input.type) {
      case StepType.TOOL_CALL:
        return { ...base, type: StepType.TOOL_CALL, toolName: input.toolName, toolInput: input.toolInput };
      case StepType.CODE_EDIT:
        return { ...base, type: StepType.CODE_EDIT, filePath: input.filePath, diff: input.diff };
      case StepType.FILE_CREATE:
      case StepType.FILE_DELETE:
        return { ...base, type: input.type, filePath: input.filePath } as AgentStep;
      case StepType.COMMAND:
        return { ...base, type: StepType.COMMAND, command: input.command };
      case StepType.RESPONSE:
        return { ...base, type: StepType.RESPONSE, content: input.content };
      default:
        return { ...base, type: input.type } as AgentStep;
    }
  }

  /**
   * 기본 승인 필요 여부 반환
   *
   * @param type - 단계 타입
   * @returns 승인 필요 여부
   */
  private getDefaultRequiresApproval(type: StepType): boolean {
    // 생각과 응답은 승인 불필요
    return ![StepType.THINKING, StepType.RESPONSE].includes(type);
  }

  /**
   * 고유 ID 생성
   *
   * @returns 고유 ID
   */
  private generateId(): string {
    return `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // ============================================
  // 🔹 자동 승인 모드
  // ============================================

  /**
   * 자동 승인 활성화
   *
   * @param count - 횟수 제한 (undefined = 무제한)
   */
  enableAutoApprove(count?: number): void {
    this._autoApproveEnabled = true;
    this._autoApproveRemaining = count ?? -1;
  }

  /**
   * 자동 승인 비활성화
   */
  disableAutoApprove(): void {
    this._autoApproveEnabled = false;
    this._autoApproveRemaining = -1;
  }

  /**
   * 자동 승인 횟수 감소
   */
  private decrementAutoApprove(): void {
    if (this._autoApproveRemaining > 0) {
      this._autoApproveRemaining--;

      if (this._autoApproveRemaining === 0) {
        this._autoApproveEnabled = false;
      }
    }
  }

  // ============================================
  // 🔹 Computed 속성
  // ============================================

  /**
   * Agent Mode 활성화 여부
   */
  get isActive(): boolean {
    return this.status !== AgentModeStatus.IDLE;
  }

  /**
   * 자동 승인 활성화 여부
   */
  get isAutoApproveEnabled(): boolean {
    return this._autoApproveEnabled;
  }

  /**
   * 자동 승인 남은 횟수
   */
  get autoApproveRemaining(): number {
    return this._autoApproveRemaining;
  }

  /**
   * 대기 중인 승인이 있는지 여부
   */
  get hasPendingApprovals(): boolean {
    return this.steps.some((s) => s.status === ApprovalStatus.PENDING);
  }

  /**
   * 완료된 단계 수
   */
  get completedStepCount(): number {
    return this.steps.filter((s) => [ApprovalStatus.APPROVED, ApprovalStatus.AUTO_APPROVED].includes(s.status)).length;
  }

  /**
   * 총 단계 수
   */
  get totalStepCount(): number {
    return this.steps.length;
  }

  /**
   * 진행률 (%)
   */
  get progressPercentage(): number {
    if (this.steps.length === 0) return 0;

    return Math.round((this.completedStepCount / this.steps.length) * 100);
  }

  /**
   * 현재 단계
   */
  get currentStep(): AgentStep | null {
    return this.steps[this.steps.length - 1] ?? null;
  }

  /**
   * 실행 시간 (ms)
   */
  get duration(): number {
    if (!this.startedAt) return 0;

    const endTime = this._completedAt ?? Date.now();

    return endTime - this.startedAt;
  }

  // ============================================
  // 🔹 통계
  // ============================================

  /**
   * 통계 반환
   *
   * @returns Agent Mode 실행 통계
   */
  getStatistics(): AgentModeStatistics {
    const stepsByType: Partial<Record<StepType, number>> = {};

    this.steps.forEach((step) => {
      stepsByType[step.type] = (stepsByType[step.type] ?? 0) + 1;
    });

    return {
      totalSteps: this.steps.length,
      completedSteps: this.completedStepCount,
      rejectedSteps: this.steps.filter((s) => s.status === ApprovalStatus.REJECTED).length,
      pendingSteps: this.steps.filter((s) => s.status === ApprovalStatus.PENDING).length,
      stepsByType,
    };
  }
}

// ============================================
// 🎯 싱글톤 인스턴스
// ============================================

/**
 * agentModeState 싱글톤
 *
 * 📝 앱 전체에서 공유하는 Agent Mode 상태
 */
export const agentModeState = new AgentModeState();
