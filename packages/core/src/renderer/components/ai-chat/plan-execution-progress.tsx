/**
 * 🎯 목적: PlanExecutionProgress UI 컴포넌트
 * 02: 계획 실행 진행 표시
 *
 * 📝 주요 기능:
 * - 현재 실행 단계 표시
 * - 진행률 바
 * - 단계 인디케이터
 * - 상태 텍스트
 * - 스피너 애니메이션
 * - 에러 메시지 표시
 *
 * @packageDocumentation
 */

import { observer } from "mobx-react-lite";
import React from "react";
import { PlanStatus, planState, StepStatus } from "../../../features/ai-assistant/common/plan-state";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * PlanExecutionProgress Props
 */
export interface PlanExecutionProgressProps {
  /** 컴팩트 모드 */
  compact?: boolean;
}

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 상태별 텍스트 반환
 *
 * @param status - 계획 상태
 * @returns 상태 텍스트
 */
function getStatusText(status: PlanStatus): string {
  const texts: Record<PlanStatus, string> = {
    idle: "Idle",
    drafting: "Drafting",
    executing: "Executing",
    completed: "Completed",
    partial: "Partial",
    rejected: "Rejected",
    failed: "Failed",
  };
  return texts[status];
}

/**
 * 상태별 색상 반환
 * 🎯 THEME-024: CSS 변수 기반 색상으로 마이그레이션
 *
 * @param status - 계획 상태
 * @returns CSS 색상 클래스
 */
function getStatusColor(status: PlanStatus): string {
  const colors: Record<PlanStatus, string> = {
    idle: "text-status-pending",
    drafting: "text-status-info",
    executing: "text-status-warning",
    completed: "text-status-success",
    partial: "text-status-warning",
    rejected: "text-status-error",
    failed: "text-status-error",
  };
  return colors[status];
}

/**
 * 단계 상태별 인디케이터 클래스 반환
 * 🎯 THEME-024: CSS 변수 기반 유틸리티 클래스로 마이그레이션
 *
 * @param status - 단계 상태
 * @param isActive - 현재 활성 단계 여부
 * @returns CSS 클래스
 */
function getIndicatorClass(status: StepStatus, isActive: boolean): string {
  if (status === "completed") {
    return "completed bg-status-success";
  }
  if (status === "failed") {
    return "failed bg-status-error";
  }
  if (status === "skipped") {
    return "skipped bg-status-pending";
  }
  if (isActive) {
    return "active bg-status-info";
  }
  return "pending bg-muted";
}

// ============================================
// 🎯 서브 컴포넌트
// ============================================

/**
 * 스피너 컴포넌트
 */
const Spinner: React.FC = React.memo(() => (
  <span
    className="inline-block w-4 h-4 border-2 border-status-info border-t-transparent rounded-full animate-spin"
    data-testid="spinner"
    aria-label="로딩 중"
  />
));

Spinner.displayName = "Spinner";

/**
 * 단계 인디케이터 컴포넌트
 */
interface StepIndicatorProps {
  index: number;
  status: StepStatus;
  isActive: boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = React.memo(({ index, status, isActive }) => {
  const className = getIndicatorClass(status, isActive);

  return (
    <div
      className={`w-3 h-3 rounded-full ${className}`}
      data-testid={`step-indicator-${index}`}
      title={`단계 ${index + 1}`}
    />
  );
});

StepIndicator.displayName = "StepIndicator";

// ============================================
// 🎯 메인 컴포넌트
// ============================================

/**
 * PlanExecutionProgress 컴포넌트
 *
 * 📝 계획 실행 진행 상태를 표시
 */
export const PlanExecutionProgress: React.FC<PlanExecutionProgressProps> = observer(({ compact = false }) => {
  // 실행 관련 상태에서만 렌더링
  const shouldRender =
    planState.status === "executing" || planState.status === "completed" || planState.status === "failed";

  if (!shouldRender) {
    return null;
  }

  const currentStep = planState.currentStep;
  const isExecuting = planState.status === "executing";
  const isFailed = planState.status === "failed";
  const isCompleted = planState.status === "completed";

  // 현재 실행 중인 단계 (in_progress 상태)
  const hasActiveStep = planState.steps.some((s) => s.status === "in_progress");

  // 에러 메시지 찾기
  const failedStep = planState.steps.find((s) => s.status === "failed");
  const errorMessage = failedStep?.error;

  const containerClass = ["border rounded-lg p-3 bg-card", compact && "compact py-2"].filter(Boolean).join(" ");

  return (
    <div className={containerClass} data-testid="execution-progress" role="status" aria-label="실행 진행 상황">
      {/* 상단: 현재 단계 정보 + 상태 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* 스피너 (실행 중일 때만) */}
          {isExecuting && hasActiveStep && <Spinner />}

          {/* 완료/실패 아이콘 - 🎯 THEME-024 */}
          {isCompleted && <span className="text-status-success">✅</span>}
          {isFailed && <span className="text-status-error">❌</span>}

          {/* 현재 단계 제목 */}
          <span className="font-medium text-sm" data-testid="current-step-title">
            {currentStep?.title ?? "완료"}
          </span>
        </div>

        {/* 단계 번호 + 상태 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground" data-testid="current-step-number">
            {planState.currentStepIndex + 1}/{planState.totalSteps}
          </span>
          <span className={`text-xs font-medium ${getStatusColor(planState.status)}`} data-testid="status-text">
            {getStatusText(planState.status)}
          </span>
        </div>
      </div>

      {/* 진행률 바 - 🎯 THEME-040: CSS 변수 직접 참조 제거 */}
      <div className="w-full bg-muted rounded-full h-1.5 mb-2">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${
            isFailed ? "bg-status-error" : "bg-status-info"
          }`}
          style={{ width: `${planState.progressPercentage}%` }}
          data-testid="progress-fill"
        />
      </div>

      {/* 단계 인디케이터 (compact 모드가 아닐 때) */}
      {!compact && (
        <div className="flex items-center gap-1">
          {planState.steps.map((step, index) => (
            <StepIndicator
              key={index}
              index={index}
              status={step.status}
              isActive={index === planState.currentStepIndex}
            />
          ))}
        </div>
      )}

      {/* 에러 메시지 - 🎯 THEME-024 */}
      {errorMessage && (
        <div className="mt-2 p-2 bg-status-error-muted rounded text-xs text-status-error" data-testid="error-message">
          ⚠️ {errorMessage}
        </div>
      )}
    </div>
  );
});

PlanExecutionProgress.displayName = "PlanExecutionProgress";

export default PlanExecutionProgress;
