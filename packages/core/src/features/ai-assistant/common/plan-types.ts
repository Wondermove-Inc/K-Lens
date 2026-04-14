/**
 * 🎯 목적: Plan Mode 타입 정의
 * 01: Plan Mode 공용 타입
 *
 * 📝 주요 타입:
 * - PlanStatus: 계획 상태
 * - StepStatus: 단계 상태
 * - PlanStep: 계획 단계 인터페이스
 *
 * @packageDocumentation
 */

// ============================================
// 🎯 계획 상태 타입
// ============================================

/**
 * 계획 상태 타입
 *
 * - idle: 비활성 상태
 * - drafting: 계획 작성 중
 * - executing: 계획 실행 중
 * - completed: 모든 단계 실행 완료 (전부 성공)
 * - partial: 일부 단계 성공, 일부 실패 (부분 완료)
 * - rejected: 사용자 거부
 * - failed: 모든 단계 실패 또는 치명적 오류
 *
 * 📝 2026-01-13: BUG-E 수정 - "partial" 상태 추가
 */
export type PlanStatus = "idle" | "drafting" | "executing" | "completed" | "partial" | "rejected" | "failed";

/**
 * 단계 상태 타입
 *
 * - pending: 대기 중
 * - in_progress: 실행 중
 * - completed: 완료
 * - skipped: 건너뜀
 * - failed: 실패
 */
export type StepStatus = "pending" | "in_progress" | "completed" | "skipped" | "failed";

// ============================================
// 🎯 계획 단계 인터페이스
// ============================================

/**
 * 계획 단계 인터페이스
 */
export interface PlanStep {
  /** 단계 제목 */
  title: string;
  /** 단계 상태 */
  status: StepStatus;
  /** 실행할 명령어 (선택) */
  command?: string;
  /** 상세 설명 (선택) */
  description?: string;
  /** 실행 결과 요약 (선택) - 한 줄 요약 */
  result?: string;
  /** 에러 메시지 (선택) */
  error?: string;
  /** 상세 실행 출력 (선택) - stdout/stderr 전체 내용, 접힌 상태로 표시 */
  output?: string;
}

// ============================================
// 🎯 Plan 스냅샷 인터페이스 (Problem 5 해결)
// ============================================

/**
 * Plan 상태 스냅샷
 *
 * 📝 2026-01-13: 해결
 * - 각 plan-viewer 메시지에 저장되어 Plan 독립성 확보
 * - planState 싱글톤 대신 스냅샷을 사용하여 이전 Plan이 새 Plan에 영향받지 않음
 */
export interface PlanSnapshot {
  /** Plan 제목 */
  title: string;
  /** Plan 요약 설명 */
  summary: string;
  /** Plan 상태 */
  status: PlanStatus;
  /** 단계 목록 (깊은 복사) */
  steps: PlanStep[];
  /** 현재 진행 중인 단계 인덱스 */
  currentStepIndex: number;
  /** Plan이 속한 대화방 ID */
  conversationId: string;
  /** 스냅샷 생성 시간 */
  snapshotAt: number;
}

// ============================================
// 🎯 헬퍼 함수
// ============================================

/**
 * PlanStep 생성 헬퍼
 *
 * @param title - 단계 제목
 * @param command - 실행할 명령어 (선택)
 * @param description - 상세 설명 (선택)
 * @returns 새 PlanStep 객체
 */
export function createPlanStep(title: string, command?: string, description?: string): PlanStep {
  return {
    title,
    status: "pending",
    command,
    description,
  };
}

/**
 * Plan 상태 스냅샷 생성 헬퍼
 *
 * 📝 2026-01-13: 해결
 * - planState에서 현재 상태를 깊은 복사하여 스냅샷 생성
 * - 이 스냅샷은 plan-viewer 메시지에 저장됨
 *
 * @param planState - planState 싱글톤 객체
 * @returns PlanSnapshot 또는 null (Plan이 없는 경우)
 */
export function createPlanSnapshot(planState: {
  title: string;
  summary: string;
  status: PlanStatus;
  steps: PlanStep[];
  currentStepIndex: number;
  currentConversationId: string;
}): PlanSnapshot {
  return {
    title: planState.title,
    summary: planState.summary,
    status: planState.status,
    steps: planState.steps.map((step) => ({ ...step })), // 깊은 복사
    currentStepIndex: planState.currentStepIndex,
    conversationId: planState.currentConversationId,
    snapshotAt: Date.now(),
  };
}
