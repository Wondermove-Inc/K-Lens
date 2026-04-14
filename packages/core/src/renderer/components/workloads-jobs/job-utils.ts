/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Job 유틸리티 함수 (상태 텍스트, CSS 클래스)
 *
 * @remarks
 * - getStatusText, getStatusClass를 별도 파일로 분리하여 순환 참조 방지
 * - jobs.tsx, status-cell.tsx, job-detail-panel.tsx에서 공통 사용
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (순환 참조 해결)
 */

import type { Job } from "@skuberplus/kube-object";

/**
 * 🎯 목적: Job 상태 텍스트 반환
 * @param obj - Job 객체
 * @returns Job 상태 ("Complete", "Failed", "Running" 등)
 */
export function getStatusText(obj: Job) {
  const conditions = obj.getConditions();
  if (!conditions || !conditions.length) {
    return "Unknown";
  }
  if (obj.hasCondition("Complete")) {
    return "Complete";
  } else if (obj.hasCondition("Failed")) {
    return "Failed";
  } else if (obj.metadata.deletionTimestamp) {
    if (obj.metadata.finalizers?.length) {
      return "Finalizing";
    }
    return "Terminating";
  } else if (obj.hasCondition("Suspended")) {
    return "Suspended";
  } else if (obj.hasCondition("FailureTarget")) {
    return "FailureTarget";
  }
  return "Running";
}

export type JobStatus = ReturnType<typeof getStatusText>;

/**
 * 🎯 목적: Job 상태에 따른 CSS 클래스 반환
 * @param obj - Job 객체
 * @returns CSS 클래스 ("success", "error", "info", "warning")
 */
export function getStatusClass(obj: Job) {
  const status = getStatusText(obj);
  switch (status) {
    case "Failed":
    case "FailureTarget":
      return "error";
    case "Complete":
      return "success";
    case "Running":
      return "info";
    case "Suspended":
      return "warning";
    default:
      return "";
  }
}

/**
 * 🎯 목적: Job 상태에 따른 Badge variant 반환 (shadcn 스타일)
 * @param obj - Job 객체
 * @returns Badge variant 문자열
 */
export function getStatusVariant(obj: Job): "default" | "secondary" | "destructive" | "outline" {
  const status = getStatusText(obj);

  switch (status) {
    case "Complete":
      return "secondary";
    case "Failed":
    case "FailureTarget":
      return "destructive";
    case "Running":
      return "default";
    case "Suspended":
      return "outline";
    default:
      return "outline";
  }
}
