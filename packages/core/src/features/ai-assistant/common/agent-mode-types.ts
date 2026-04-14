/**
 * 🎯 목적: Agent Mode 타입 정의
 * 01: AgentModeController 타입 정의
 *
 * 📝 주요 타입:
 * - AgentModeStatus: Agent 실행 상태
 * - StepType: 단계 유형
 * - AgentStep: 실행 단계 정보
 *
 * @packageDocumentation
 */

// ============================================
// 🎯 상태 열거형
// ============================================

/**
 * Agent Mode 실행 상태
 */
export enum AgentModeStatus {
  /** 대기 중 */
  IDLE = "idle",
  /** 실행 중 */
  RUNNING = "running",
  /** 일시정지 */
  PAUSED = "paused",
  /** 중지됨 */
  STOPPED = "stopped",
  /** 완료 */
  COMPLETED = "completed",
  /** 에러 발생 */
  ERROR = "error",
}

/**
 * 실행 단계 유형
 */
export enum StepType {
  /** 생각/분석 중 */
  THINKING = "thinking",
  /** 도구 호출 */
  TOOL_CALL = "tool_call",
  /** 코드 수정 */
  CODE_EDIT = "code_edit",
  /** 파일 생성 */
  FILE_CREATE = "file_create",
  /** 파일 삭제 */
  FILE_DELETE = "file_delete",
  /** 명령어 실행 */
  COMMAND = "command",
  /** 사용자 응답 */
  RESPONSE = "response",
}

/**
 * 승인 상태
 */
export enum ApprovalStatus {
  /** 대기 중 */
  PENDING = "pending",
  /** 승인됨 */
  APPROVED = "approved",
  /** 자동 승인됨 */
  AUTO_APPROVED = "auto_approved",
  /** 거부됨 */
  REJECTED = "rejected",
}

// ============================================
// 🎯 단계 인터페이스
// ============================================

/**
 * 기본 단계 정보
 */
interface AgentStepBase {
  /** 고유 ID */
  id: string;
  /** 단계 유형 */
  type: StepType;
  /** 설명 */
  description: string;
  /** 승인 상태 */
  status: ApprovalStatus;
  /** 생성 시간 */
  createdAt: number;
  /** 승인 필요 여부 */
  requiresApproval: boolean;
  /** 실행 결과 */
  result?: string;
  /** 거부 사유 */
  rejectionReason?: string;
}

/**
 * 도구 호출 단계
 */
export interface ToolCallStep extends AgentStepBase {
  type: StepType.TOOL_CALL;
  /** 도구 이름 */
  toolName?: string;
  /** 도구 입력 */
  toolInput?: Record<string, unknown>;
}

/**
 * 코드 수정 단계
 */
export interface CodeEditStep extends AgentStepBase {
  type: StepType.CODE_EDIT;
  /** 파일 경로 */
  filePath?: string;
  /** Diff 내용 */
  diff?: string;
}

/**
 * 파일 생성 단계
 */
export interface FileCreateStep extends AgentStepBase {
  type: StepType.FILE_CREATE;
  /** 파일 경로 */
  filePath?: string;
}

/**
 * 파일 삭제 단계
 */
export interface FileDeleteStep extends AgentStepBase {
  type: StepType.FILE_DELETE;
  /** 파일 경로 */
  filePath?: string;
}

/**
 * 명령어 실행 단계
 */
export interface CommandStep extends AgentStepBase {
  type: StepType.COMMAND;
  /** 명령어 */
  command?: string;
}

/**
 * 응답 단계
 */
export interface ResponseStep extends AgentStepBase {
  type: StepType.RESPONSE;
  /** 응답 내용 */
  content?: string;
}

/**
 * 생각 단계
 */
export interface ThinkingStep extends AgentStepBase {
  type: StepType.THINKING;
}

/**
 * 모든 단계 유형
 */
export type AgentStep =
  | ThinkingStep
  | ToolCallStep
  | CodeEditStep
  | FileCreateStep
  | FileDeleteStep
  | CommandStep
  | ResponseStep;

// ============================================
// 🎯 입력 인터페이스
// ============================================

/**
 * 단계 추가 입력
 */
export interface AddStepInput {
  type: StepType;
  description: string;
  requiresApproval?: boolean;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  filePath?: string;
  diff?: string;
  command?: string;
  content?: string;
}

// ============================================
// 🎯 통계 인터페이스
// ============================================

/**
 * 실행 통계
 */
export interface AgentModeStatistics {
  /** 총 단계 수 */
  totalSteps: number;
  /** 완료된 단계 수 */
  completedSteps: number;
  /** 거부된 단계 수 */
  rejectedSteps: number;
  /** 대기 중인 단계 수 */
  pendingSteps: number;
  /** 타입별 단계 수 */
  stepsByType: Partial<Record<StepType, number>>;
}

// ============================================
// 🎯 콜백 타입
// ============================================

/** 상태 변경 콜백 */
export type StatusChangeCallback = (status: AgentModeStatus) => void;

/** 단계 추가 콜백 */
export type StepAddedCallback = (step: AgentStep) => void;

/** 승인 필요 콜백 */
export type ApprovalRequiredCallback = (step: AgentStep) => void;
