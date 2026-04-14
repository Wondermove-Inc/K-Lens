/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import React from "react";
import { getStatusClasses } from "../../../utils/semantic-status";

import type { Pod } from "@skuberplus/kube-object";

/**
 * 🎯 목적: Pod 상태를 Badge 컴포넌트로 표시
 *
 * @param pod - Pod 객체
 * @returns Badge 컴포넌트 (커스텀 색상 적용)
 *
 * 📝 주의사항:
 * - 상태별 시맨틱 색상 적용 (THEME-040)
 * - pod.getStatusMessage()로 현재 상태 가져옴
 *
 * 🔄 변경이력:
 * - 2025-11-24 - Badge 컴포넌트 적용 및 커스텀 색상 추가
 * - 2026-01-31 - THEME-040: semantic-status 유틸리티 사용으로 중복 제거
 */
export const StatusCell = ({ pod }: { pod: Pod }) => {
  const statusMessage = pod.getStatusMessage();

  // 🎯 THEME-040: 통합 semantic-status 유틸리티 사용
  return (
    <Badge className={`border-transparent ${getStatusClasses(statusMessage)} hover:opacity-90`}>{statusMessage}</Badge>
  );
};
