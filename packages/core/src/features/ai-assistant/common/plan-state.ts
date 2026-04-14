/**
 * 🎯 목적: Plan Mode MobX 상태 관리
 * 01: planState 상태 및 액션 추가
 *
 * 📝 주요 기능:
 * - Plan Mode 활성화/비활성화
 * - 계획 단계 관리 (추가, 업데이트, 삭제)
 * - 계획 승인/거부 처리
 * - 실행 상태 추적
 *
 * @packageDocumentation
 */

import { action, makeAutoObservable } from "mobx";
import { createPlanStep, PlanSnapshot, PlanStatus, PlanStep, StepStatus } from "./plan-types";

// 타입 재export (하위 호환성)
export { createPlanStep };
export type { PlanStatus, StepStatus, PlanStep, PlanSnapshot };

// ============================================
// 🎯 PlanState 클래스
// ============================================

/**
 * Plan Mode 상태 관리 클래스
 *
 * 📝 MobX makeAutoObservable을 사용한 반응형 상태
 */
class PlanState {
  /** Plan Mode 활성화 여부 */
  isActive = false;

  /** 현재 계획 상태 */
  status: PlanStatus = "idle";

  /** 계획 제목 */
  title = "";

  /** 계획 단계 목록 */
  steps: PlanStep[] = [];

  /** 현재 실행 중인 단계 인덱스 */
  currentStepIndex = -1;

  /** Plan 요약 설명 (Auto Plan Tracker) */
  summary = "";

  /**
   * 🆕 현재 Plan이 속한 대화방 ID
   *
   * 📝 2026-01-13: 해결
   * - planState가 싱글톤이라 대화방 구분이 필요
   * - PlanViewer에서 현재 대화방의 Plan인지 확인 시 사용
   */
  currentConversationId = "";

  constructor() {
    makeAutoObservable(this, {
      startPlanMode: action,
      endPlanMode: action,
      addStep: action,
      updateStep: action,
      removeStep: action,
      approvePlan: action,
      rejectPlan: action,
      startStep: action,
      completeStep: action,
      skipStep: action,
      failStep: action,
      nextStep: action,
      reset: action,
      setStatus: action,
      setSummary: action,
      initializeFromPlanEvent: action,
      initializeFromSnapshot: action,
    });
  }

  // ============================================
  // 🔹 Plan Mode 라이프사이클
  // ============================================

  /**
   * Plan Mode 시작
   *
   * @param planTitle - 계획 제목
   */
  startPlanMode(planTitle: string): void {
    this.reset();
    this.isActive = true;
    this.status = "drafting";
    this.title = planTitle;
  }

  /**
   * Plan Mode 종료
   */
  endPlanMode(): void {
    this.reset();
  }

  /**
   * 상태 리셋
   */
  reset(): void {
    this.isActive = false;
    this.status = "idle";
    this.title = "";
    this.summary = "";
    this.steps = [];
    this.currentStepIndex = -1;
    this.currentConversationId = "";
  }

  // ============================================
  // 🔹 단계 관리
  // ============================================

  /** 단계 추가 */
  addStep(step: PlanStep): void {
    this.steps.push(step);
  }

  /** 단계 업데이트 */
  updateStep(index: number, updates: Partial<PlanStep>): void {
    if (index < 0 || index >= this.steps.length) return;
    this.steps[index] = { ...this.steps[index], ...updates };
  }

  /** 단계 제거 */
  removeStep(index: number): void {
    if (index < 0 || index >= this.steps.length) return;
    this.steps.splice(index, 1);
  }

  // ============================================
  // 🔹 계획 승인/거부
  // ============================================

  /** 계획 승인 */
  approvePlan(): void {
    if (this.steps.length === 0) return;
    this.status = "executing";
    this.currentStepIndex = 0;
  }

  /** 계획 거부 */
  rejectPlan(): void {
    this.status = "rejected";
    this.isActive = false;
  }

  // ============================================
  // 🔹 실행 상태 추적
  // ============================================

  /**
   * 단계 시작
   *
   * 📝 2026-01-13: MobX 반응성을 위해 새 객체 할당 방식으로 수정
   * - 기존: this.steps[index].status = "xxx" (반응성 안됨)
   * - 수정: this.steps[index] = { ...this.steps[index], status: "xxx" }
   */
  startStep(index: number): void {
    if (index < 0 || index >= this.steps.length) return;
    // 🎯 FIX: MobX 반응성을 위해 새 객체 할당
    this.steps[index] = { ...this.steps[index], status: "in_progress" };
    this.currentStepIndex = index;
  }

  /**
   * 단계 완료
   *
   * 📝 2026-01-13: output 파라미터 추가 (상세 실행 출력)
   * 📝 2026-01-13: MobX 반응성을 위해 새 객체 할당 방식으로 수정
   */
  completeStep(index: number, result?: string, output?: string): void {
    if (index < 0 || index >= this.steps.length) return;
    // 🎯 FIX: MobX 반응성을 위해 새 객체 할당
    this.steps[index] = {
      ...this.steps[index],
      status: "completed",
      ...(result !== undefined && { result }),
      ...(output !== undefined && { output }),
    };
  }

  /**
   * 단계 건너뛰기
   *
   * 📝 2026-01-13: output 파라미터 추가 (상세 실행 출력)
   * 📝 2026-01-13: MobX 반응성을 위해 새 객체 할당 방식으로 수정
   */
  skipStep(index: number, reason?: string, output?: string): void {
    if (index < 0 || index >= this.steps.length) return;
    // 🎯 FIX: MobX 반응성을 위해 새 객체 할당
    this.steps[index] = {
      ...this.steps[index],
      status: "skipped",
      ...(reason !== undefined && { result: reason }),
      ...(output !== undefined && { output }),
    };
  }

  /**
   * 단계 실패
   *
   * 📝 2026-01-13: output 파라미터 추가 (상세 실행 출력)
   * 📝 2026-01-13: MobX 반응성을 위해 새 객체 할당 방식으로 수정
   */
  failStep(index: number, error?: string, output?: string): void {
    if (index < 0 || index >= this.steps.length) return;
    // 🎯 FIX: MobX 반응성을 위해 새 객체 할당
    this.steps[index] = {
      ...this.steps[index],
      status: "failed",
      ...(error !== undefined && { error }),
      ...(output !== undefined && { output }),
    };
    this.status = "failed";
  }

  /** 다음 단계로 이동 */
  nextStep(): void {
    if (this.currentStepIndex >= this.steps.length - 1) {
      this.status = "completed";
      return;
    }
    this.currentStepIndex += 1;
  }

  // ============================================
  // 🔹 Computed 속성
  // ============================================

  get totalSteps(): number {
    return this.steps.length;
  }

  get completedSteps(): number {
    return this.steps.filter((s) => s.status === "completed").length;
  }

  get progressPercentage(): number {
    if (this.steps.length === 0) return 0;
    return (this.completedSteps / this.steps.length) * 100;
  }

  get currentStep(): PlanStep | undefined {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.steps.length) {
      return undefined;
    }
    return this.steps[this.currentStepIndex];
  }

  get hasSteps(): boolean {
    return this.steps.length > 0;
  }

  get canApprove(): boolean {
    return this.steps.length > 0 && this.status === "drafting";
  }

  get isExecuting(): boolean {
    return this.status === "executing";
  }

  // ============================================
  // 🔹 IPC 이벤트 처리용 액션 (Auto Plan Tracker)
  // ============================================

  /**
   * 상태 직접 설정 (IPC 이벤트 처리용)
   *
   * 📝 2026-01-12: Auto Plan Tracker 추가
   * - Main Process에서 plan-status 이벤트를 수신했을 때 호출
   *
   * 📝 2026-01-13: FIX - Plan UI 완료 후 사라짐 문제 수정
   * - completed/partial/failed 상태에서도 isActive를 true로 유지
   * - 사용자가 각 단계의 output을 확인할 수 있어야 함
   * - idle/rejected 상태에서만 isActive = false (완전히 리셋될 때)
   *
   * 📝 2026-01-13: BUG-E 수정 - partial 상태 지원
   * - partial: 일부 단계 성공, 일부 실패
   *
   * @param status - 새 Plan 상태
   */
  setStatus(status: PlanStatus): void {
    this.status = status;
    /**
     * 🎯 FIX: 상태에 따른 isActive 설정
     * - idle: Plan이 리셋됨 → UI 숨김
     * - rejected: 사용자가 거부함 → UI 숨김
     * - completed/partial/failed: 실행 완료/부분완료/실패 → UI 유지 (output 확인용)
     * - drafting/executing: 실행 중 → UI 표시
     */
    if (status === "idle" || status === "rejected") {
      this.isActive = false;
    } else {
      this.isActive = true;
    }
  }

  /**
   * 요약 설명 설정 (IPC 이벤트 처리용)
   *
   * 📝 2026-01-12: Auto Plan Tracker 추가
   * - Main Process에서 plan-generated 이벤트를 수신했을 때 호출
   *
   * @param summary - Plan 요약 설명
   */
  setSummary(summary: string): void {
    this.summary = summary;
  }

  /**
   * Plan 생성 이벤트로부터 상태 초기화
   *
   * 📝 2026-01-12: Auto Plan Tracker 추가
   * - plan-generated 이벤트 수신 시 한 번에 상태를 초기화
   *
   * 📝 2026-01-13: 해결
   * - conversationId 파라미터 추가하여 대화방 구분
   *
   * @param title - Plan 제목
   * @param summary - Plan 요약 설명
   * @param steps - Plan 단계 목록
   * @param conversationId - 이 Plan이 속한 대화방 ID
   */
  initializeFromPlanEvent(
    title: string,
    summary: string,
    steps: Array<{ title: string; description?: string; command?: string }>,
    conversationId: string,
  ): void {
    this.reset();
    this.isActive = true;
    this.status = "drafting";
    this.title = title;
    this.summary = summary;
    this.currentConversationId = conversationId;
    this.steps = steps.map((step) => createPlanStep(step.title, step.command, step.description));
  }

  /**
   * PlanSnapshot에서 상태 복원
   *
   * 📝 2026-02-03: Plan 영속성 개선
   * - 대화방 전환 시 JSONL에서 로드된 스냅샷으로 상태 복원
   * - 기존 상태 초기화 후 스냅샷 데이터로 덮어쓰기
   * - initializeFromPlanEvent와 유사하지만 완전한 상태 복원 (status, steps 전체 포함)
   *
   * 📌 사용처:
   * - 대화방 전환 시 해당 대화방의 저장된 Plan 표시
   * - 앱 재시작 후 마지막 대화방의 Plan 복원
   * - 이전 대화의 Plan 히스토리 조회
   *
   * @param snapshot - 복원할 Plan 스냅샷 (null/undefined 시 무시)
   */
  initializeFromSnapshot(snapshot: PlanSnapshot | null | undefined): void {
    // null/undefined 체크 - 무시하고 현재 상태 유지
    if (!snapshot) {
      return;
    }

    // 기존 상태 초기화
    this.reset();

    try {
      // 스냅샷에서 복원
      this.title = snapshot.title;
      this.summary = snapshot.summary;
      this.status = snapshot.status;
      this.currentStepIndex = snapshot.currentStepIndex;
      this.currentConversationId = snapshot.conversationId;

      // steps 복원 (깊은 복사 - PlanStep 형식으로 변환)
      this.steps = (snapshot.steps ?? []).map((step) => ({
        title: step.title,
        status: step.status,
        command: step.command,
        description: step.description,
        result: step.result,
        error: step.error,
        output: step.output,
      }));

      // isActive 설정
      // - idle/rejected: Plan이 리셋되거나 거부됨 → UI 숨김
      // - 나머지(drafting/executing/completed/partial/failed): UI 표시
      if (snapshot.status === "idle" || snapshot.status === "rejected") {
        this.isActive = false;
      } else {
        this.isActive = true;
      }
    } catch {
      // 스냅샷 복원 실패 시 초기 상태로 유지
      this.reset();
    }
  }
}

// ============================================
// 🎯 싱글톤 인스턴스
// ============================================

/**
 * planState 싱글톤
 *
 * 📝 앱 전체에서 공유하는 Plan Mode 상태
 */
export const planState = new PlanState();
