/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Job의 Resumed 상태를 Boolean Badge로 표시
 *
 * @param job - Job 객체
 * @returns BadgeBoolean 컴포넌트 (suspend 여부의 반대)
 *
 * 📝 주의사항:
 * - job.spec.suspend가 false이면 Resumed (실행 중)
 * - job.spec.suspend가 true이면 Suspended (일시 중지)
 * - BadgeBoolean은 true/false에 따라 Yes/No 또는 체크마크/X 표시
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (shadcn 마이그레이션)
 */

import React from "react";
import { BadgeBoolean } from "../../badge";

import type { Job } from "@skuberplus/kube-object";

export const ResumedCell = ({ job }: { job: Job }) => {
  // suspend가 false이면 resumed (실행 중)
  const isResumed = !job.spec.suspend;
  return <BadgeBoolean value={isResumed} />;
};
