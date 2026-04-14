/**
 * 🎯 목적: PlanViewer 유틸리티 함수 및 타입
 * 01: PlanViewer UI 유틸리티
 *
 * @packageDocumentation
 */

import { PlanStatus, StepStatus } from "../../../features/ai-assistant/common/plan-state";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * PlanViewer Props
 */
export interface PlanViewerProps {
  /** 승인 콜백 */
  onApprove?: () => void;
  /** 거부 콜백 */
  onReject?: () => void;
  /** 기본 펼침 상태 */
  defaultExpanded?: boolean;
}

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 상태별 배지 텍스트
 *
 * @param status - 계획 상태
 * @returns 한글 텍스트
 */
export function getStatusText(status: PlanStatus): string {
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
 * 상태별 배지 색상 클래스
 * 🎯 THEME-024: CSS 변수 기반 색상으로 마이그레이션
 *
 * @param status - 계획 상태
 * @returns CSS 클래스
 */
export function getStatusColorClass(status: PlanStatus): string {
  const colors: Record<PlanStatus, string> = {
    idle: "bg-badge-neutral",
    drafting: "bg-badge-info",
    executing: "bg-badge-warning",
    completed: "bg-badge-success",
    partial: "bg-[var(--status-warning-muted)] text-[var(--status-warning)]",
    rejected: "bg-badge-error",
    failed: "bg-badge-error",
  };
  return colors[status];
}

/**
 * 단계 상태별 아이콘
 *
 * @param status - 단계 상태
 * @returns 이모지 아이콘
 */
export function getStepIcon(status: StepStatus): string {
  const icons: Record<StepStatus, string> = {
    pending: "⏳",
    in_progress: "🔄",
    completed: "✅",
    skipped: "⏭️",
    failed: "❌",
  };
  return icons[status];
}
