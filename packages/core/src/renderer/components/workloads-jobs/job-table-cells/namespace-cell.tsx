/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Job의 네임스페이스를 Badge 형태로 표시
 *
 * @param job - Job 객체
 * @returns NamespaceSelectBadge 컴포넌트 (클릭 시 네임스페이스 필터 변경)
 *
 * 📝 주의사항:
 * - NamespaceSelectBadge는 기존 컴포넌트 재사용
 * - 클릭 시 네임스페이스 필터 변경 기능 내장
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (shadcn 마이그레이션)
 */

import React from "react";
import { NamespaceSelectBadge } from "../../namespaces/namespace-select-badge";

import type { Job } from "@skuberplus/kube-object";

export const NamespaceCell = ({ job }: { job: Job }) => {
  return <NamespaceSelectBadge namespace={job.getNs()} />;
};
