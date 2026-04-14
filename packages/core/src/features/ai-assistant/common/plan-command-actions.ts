/**
 * 🎯 목적: /plan 커맨드 액션 구현
 * 02: /plan 액션 실행
 *
 * 📝 주요 기능:
 * - start, cancel, status, approve, reject, help 액션 실행
 *
 * @packageDocumentation
 */

import { PlanCommandResult } from "./plan-command";
import { planState } from "./plan-state";

// ============================================
// 🎯 액션 구현
// ============================================

/**
 * start 액션 실행
 *
 * @param title - 계획 제목
 * @returns 결과
 */
export function executeStart(title?: string): PlanCommandResult {
  const planTitle = title || "새 계획";
  const wasActive = planState.isActive;

  planState.startPlanMode(planTitle);

  if (wasActive) {
    return {
      success: true,
      message: `Plan Mode 활성화: "${planTitle}" (새 계획으로 교체됨)`,
    };
  }

  return {
    success: true,
    message: `Plan Mode 활성화: "${planTitle}"`,
  };
}

/**
 * cancel 액션 실행
 *
 * @returns 결과
 */
export function executeCancel(): PlanCommandResult {
  if (!planState.isActive) {
    return {
      success: false,
      message: "활성화된 계획이 없습니다.",
    };
  }

  const title = planState.title;
  planState.endPlanMode();

  return {
    success: true,
    message: `Plan Mode 취소: "${title}"`,
  };
}

/**
 * status 액션 실행
 *
 * @returns 결과
 */
export function executeStatus(): PlanCommandResult {
  if (!planState.isActive) {
    return {
      success: true,
      message: "Plan Mode 상태: 비활성",
    };
  }

  const lines = [
    `📋 계획: "${planState.title}"`,
    `📌 상태: ${planState.status}`,
    `📊 단계: ${planState.completedSteps}/${planState.totalSteps}개 완료`,
  ];

  if (planState.status === "executing" || planState.status === "completed") {
    lines.push(`📈 진행률: ${Math.round(planState.progressPercentage)}%`);
  }

  return {
    success: true,
    message: lines.join("\n"),
  };
}

/**
 * approve 액션 실행
 *
 * @returns 결과
 */
export function executeApprove(): PlanCommandResult {
  if (!planState.isActive) {
    return {
      success: false,
      message: "활성화된 계획이 없습니다.",
    };
  }

  if (!planState.canApprove) {
    return {
      success: false,
      message: "계획을 승인할 수 없습니다. 단계가 없거나 이미 실행 중입니다.",
    };
  }

  planState.approvePlan();

  return {
    success: true,
    message: `✅ 계획 승인: "${planState.title}" 실행을 시작합니다.`,
  };
}

/**
 * reject 액션 실행
 *
 * @returns 결과
 */
export function executeReject(): PlanCommandResult {
  if (!planState.isActive) {
    return {
      success: false,
      message: "활성화된 계획이 없습니다.",
    };
  }

  const title = planState.title;
  planState.rejectPlan();

  return {
    success: true,
    message: `❌ 계획 거부: "${title}"`,
  };
}

/**
 * help 액션 실행
 *
 * @returns 결과
 */
export function executeHelp(): PlanCommandResult {
  const help = `
📋 /plan 커맨드 도움말

사용법:
  /plan [제목]        Plan Mode 시작
  /plan --status      현재 상태 확인
  /plan --approve     계획 승인 및 실행
  /plan --reject      계획 거부
  /plan --cancel      Plan Mode 취소
  /plan --help        이 도움말 표시

단축키:
  -s  --status
  -a  --approve
  -r  --reject
  -c  --cancel
  -h  --help

예시:
  /plan Kubernetes 정리 작업
  /plan --status
  /plan --approve
`.trim();

  return {
    success: true,
    message: help,
  };
}
