/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Job 상태를 Badge로 표시 (Complete, Failed, Running, Suspended 등)
 *
 * @param job - Job 객체
 * @returns Badge 컴포넌트 (getStatusVariant로 shadcn 스타일 적용)
 *
 * 📝 주의사항:
 * - getStatusText()로 현재 상태 텍스트 가져옴
 * - getStatusVariant()로 상태에 따른 Badge variant 적용
 * - shadcn Badge 컴포넌트로 시각적 스타일 제공
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (shadcn 마이그레이션)
 * - 2025-11-xx: Badge variant 매핑 적용 (Complete=secondary 등)
 */

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import React from "react";
import { getStatusText, getStatusVariant } from "../job-utils";

import type { Job } from "@skuberplus/kube-object";

export const StatusCell = ({ job }: { job: Job }) => {
  const statusText = getStatusText(job);
  const badgeVariant = getStatusVariant(job);

  return <Badge variant={badgeVariant}>{statusText}</Badge>;
};
