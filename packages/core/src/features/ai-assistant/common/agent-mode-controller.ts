/**
 * 🎯 목적: Agent Mode Controller 구현
 * 01: AgentModeController 클래스 구현
 *
 * 📝 주요 기능:
 * - Agent Mode 상태 관리
 * - 단계별 실행 제어
 * - 승인/거부 처리
 * - 자동 실행 관리
 *
 * @packageDocumentation
 */

import {
  type AddStepInput,
  type AgentModeStatistics,
  AgentModeStatus,
  type AgentStep,
  type ApprovalRequiredCallback,
  ApprovalStatus,
  type StatusChangeCallback,
  type StepAddedCallback,
  StepType,
} from "./agent-mode-types";

import type { Logger } from "@skuberplus/logger";

// 타입 재export
export {
  type AddStepInput,
  type AgentModeStatistics,
  AgentModeStatus,
  type AgentStep,
  ApprovalStatus,
  StepType,
} from "./agent-mode-types";

// ============================================
// 🎯 의존성 인터페이스
// ============================================

/**
 * AgentModeController 의존성
 */
export interface AgentModeControllerDependencies {
  readonly logger: Logger;
}

// ============================================
// 🎯 AgentModeController 클래스
// ============================================

/**
 * Agent Mode Controller
 *
 * Agent의 자율 실행을 관리하는 컨트롤러입니다.
 */
export class AgentModeController {
  /** 현재 상태 */
  private _status: AgentModeStatus = AgentModeStatus.IDLE;

  /** 실행 목표 */
  private _goal: string | null = null;

  /** 실행 단계들 */
  private _steps: AgentStep[] = [];

  /** 에러 메시지 */
  private _errorMessage: string | null = null;

  /** 자동 승인 활성화 여부 */
  private _autoApproveEnabled = false;

  /** 자동 승인 남은 횟수 (-1 = 무제한) */
  private _autoApproveRemaining = -1;

  /** 시작 시간 */
  private _startedAt: number | null = null;

  /** 완료 시간 */
  private _completedAt: number | null = null;

  /** 상태 변경 콜백 */
  private statusChangeCallbacks: Set<StatusChangeCallback> = new Set();

  /** 단계 추가 콜백 */
  private stepAddedCallbacks: Set<StepAddedCallback> = new Set();

  /** 승인 필요 콜백 */
  private approvalRequiredCallbacks: Set<ApprovalRequiredCallback> = new Set();

  constructor(private readonly dependencies: AgentModeControllerDependencies) {}

  // ============================================
  // 상태 접근자
  // ============================================

  get status(): AgentModeStatus {
    return this._status;
  }

  get goal(): string | null {
    return this._goal;
  }

  get steps(): AgentStep[] {
    return [...this._steps];
  }

  get errorMessage(): string | null {
    return this._errorMessage;
  }

  get currentStep(): AgentStep | null {
    return this._steps[this._steps.length - 1] ?? null;
  }

  get startedAt(): number | null {
    return this._startedAt;
  }

  get isAutoApproveEnabled(): boolean {
    return this._autoApproveEnabled;
  }

  get autoApproveRemaining(): number {
    return this._autoApproveRemaining;
  }

  // ============================================
  // 상태 관리
  // ============================================

  /**
   * Agent Mode 시작
   */
  start(goal: string): void {
    this._goal = goal;
    this._startedAt = Date.now();
    this._completedAt = null;
    this.setStatus(AgentModeStatus.RUNNING);

    this.dependencies.logger.info("[AgentMode] 시작", { goal });
  }

  /**
   * Agent Mode 일시정지
   */
  pause(): void {
    if (this._status === AgentModeStatus.RUNNING) {
      this.setStatus(AgentModeStatus.PAUSED);
      this.dependencies.logger.info("[AgentMode] 일시정지");
    }
  }

  /**
   * Agent Mode 재개
   */
  resume(): void {
    if (this._status === AgentModeStatus.PAUSED) {
      this.setStatus(AgentModeStatus.RUNNING);
      this.dependencies.logger.info("[AgentMode] 재개");
    }
  }

  /**
   * Agent Mode 중지
   */
  stop(): void {
    this._completedAt = Date.now();
    this.setStatus(AgentModeStatus.STOPPED);
    this.dependencies.logger.info("[AgentMode] 중지");
  }

  /**
   * Agent Mode 완료
   */
  complete(): void {
    this._completedAt = Date.now();
    this.setStatus(AgentModeStatus.COMPLETED);
    this.dependencies.logger.info("[AgentMode] 완료");
  }

  /**
   * 에러 설정
   */
  setError(message: string): void {
    this._errorMessage = message;
    this._completedAt = Date.now();
    this.setStatus(AgentModeStatus.ERROR);
    this.dependencies.logger.error("[AgentMode] 에러", { message });
  }

  /**
   * 상태 초기화
   */
  reset(): void {
    this._status = AgentModeStatus.IDLE;
    this._goal = null;
    this._steps = [];
    this._errorMessage = null;
    this._autoApproveEnabled = false;
    this._autoApproveRemaining = -1;
    this._startedAt = null;
    this._completedAt = null;

    this.dependencies.logger.info("[AgentMode] 초기화");
  }

  private setStatus(status: AgentModeStatus): void {
    this._status = status;
    this.notifyStatusChange(status);
  }

  // ============================================
  // 단계 관리
  // ============================================

  /**
   * 새 단계 추가
   */
  addStep(input: AddStepInput): AgentStep {
    const requiresApproval = input.requiresApproval ?? this.getDefaultRequiresApproval(input.type);

    const step = this.createStep(input, requiresApproval);

    // 자동 승인 처리
    if (requiresApproval && this._autoApproveEnabled) {
      step.status = ApprovalStatus.AUTO_APPROVED;
      this.decrementAutoApprove();
    } else if (!requiresApproval) {
      step.status = ApprovalStatus.AUTO_APPROVED;
    }

    this._steps.push(step);
    this.notifyStepAdded(step);

    // 승인 필요 시 콜백 호출
    if (step.status === ApprovalStatus.PENDING) {
      this.notifyApprovalRequired(step);
    }

    this.dependencies.logger.debug("[AgentMode] 단계 추가", {
      type: step.type,
      status: step.status,
    });

    return step;
  }

  /**
   * 단계 가져오기
   */
  getStep(stepId: string): AgentStep | undefined {
    return this._steps.find((s) => s.id === stepId);
  }

  /**
   * 단계 상태 업데이트
   */
  updateStepStatus(stepId: string, status: ApprovalStatus): void {
    const step = this.getStep(stepId);

    if (step) {
      step.status = status;
    }
  }

  /**
   * 단계 결과 설정
   */
  setStepResult(stepId: string, result: string): void {
    const step = this.getStep(stepId);

    if (step) {
      step.result = result;
    }
  }

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

  private getDefaultRequiresApproval(type: StepType): boolean {
    // 생각과 응답은 승인 불필요
    return ![StepType.THINKING, StepType.RESPONSE].includes(type);
  }

  private generateId(): string {
    return `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // ============================================
  // 승인 처리
  // ============================================

  /**
   * 단계 승인
   */
  approveStep(stepId: string): void {
    this.updateStepStatus(stepId, ApprovalStatus.APPROVED);
    this.dependencies.logger.info("[AgentMode] 단계 승인", { stepId });
  }

  /**
   * 단계 거부
   */
  rejectStep(stepId: string, reason?: string): void {
    const step = this.getStep(stepId);

    if (step) {
      step.status = ApprovalStatus.REJECTED;
      step.rejectionReason = reason;
      this.dependencies.logger.info("[AgentMode] 단계 거부", { stepId, reason });
    }
  }

  /**
   * 모든 대기 중인 단계 승인
   */
  approveAllPending(): void {
    this._steps.forEach((step) => {
      if (step.status === ApprovalStatus.PENDING) {
        step.status = ApprovalStatus.APPROVED;
      }
    });
    this.dependencies.logger.info("[AgentMode] 모든 대기 단계 승인");
  }

  get hasPendingApprovals(): boolean {
    return this._steps.some((s) => s.status === ApprovalStatus.PENDING);
  }

  // ============================================
  // 자동 승인 모드
  // ============================================

  /**
   * 자동 승인 활성화
   */
  enableAutoApprove(count?: number): void {
    this._autoApproveEnabled = true;
    this._autoApproveRemaining = count ?? -1;
    this.dependencies.logger.info("[AgentMode] 자동 승인 활성화", { count });
  }

  /**
   * 자동 승인 비활성화
   */
  disableAutoApprove(): void {
    this._autoApproveEnabled = false;
    this._autoApproveRemaining = -1;
    this.dependencies.logger.info("[AgentMode] 자동 승인 비활성화");
  }

  private decrementAutoApprove(): void {
    if (this._autoApproveRemaining > 0) {
      this._autoApproveRemaining--;

      if (this._autoApproveRemaining === 0) {
        this._autoApproveEnabled = false;
      }
    }
  }

  // ============================================
  // 진행률
  // ============================================

  get completedStepCount(): number {
    return this._steps.filter((s) => [ApprovalStatus.APPROVED, ApprovalStatus.AUTO_APPROVED].includes(s.status)).length;
  }

  get totalStepCount(): number {
    return this._steps.length;
  }

  get progressPercentage(): number {
    if (this._steps.length === 0) return 0;

    return Math.round((this.completedStepCount / this._steps.length) * 100);
  }

  // ============================================
  // 시간 추적
  // ============================================

  get duration(): number {
    if (!this._startedAt) return 0;

    const endTime = this._completedAt ?? Date.now();

    return endTime - this._startedAt;
  }

  // ============================================
  // 통계
  // ============================================

  getStatistics(): AgentModeStatistics {
    const stepsByType: Partial<Record<StepType, number>> = {};

    this._steps.forEach((step) => {
      stepsByType[step.type] = (stepsByType[step.type] ?? 0) + 1;
    });

    return {
      totalSteps: this._steps.length,
      completedSteps: this.completedStepCount,
      rejectedSteps: this._steps.filter((s) => s.status === ApprovalStatus.REJECTED).length,
      pendingSteps: this._steps.filter((s) => s.status === ApprovalStatus.PENDING).length,
      stepsByType,
    };
  }

  // ============================================
  // 이벤트/콜백
  // ============================================

  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeCallbacks.add(callback);

    return () => this.statusChangeCallbacks.delete(callback);
  }

  onStepAdded(callback: StepAddedCallback): () => void {
    this.stepAddedCallbacks.add(callback);

    return () => this.stepAddedCallbacks.delete(callback);
  }

  onApprovalRequired(callback: ApprovalRequiredCallback): () => void {
    this.approvalRequiredCallbacks.add(callback);

    return () => this.approvalRequiredCallbacks.delete(callback);
  }

  private notifyStatusChange(status: AgentModeStatus): void {
    this.statusChangeCallbacks.forEach((cb) => cb(status));
  }

  private notifyStepAdded(step: AgentStep): void {
    this.stepAddedCallbacks.forEach((cb) => cb(step));
  }

  private notifyApprovalRequired(step: AgentStep): void {
    this.approvalRequiredCallbacks.forEach((cb) => cb(step));
  }
}
