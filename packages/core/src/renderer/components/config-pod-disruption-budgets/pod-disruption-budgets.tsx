/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: PDB 리스트 뷰 래퍼 컴포넌트 (shadcn UI 마이그레이션 완료)
 *
 * 📝 주의사항:
 *   - 실제 테이블 로직은 pod-disruption-budgets-common-table.tsx에 위임
 *   - 이 파일은 SiblingsInTabLayout 레이아웃만 담당
 *
 * 🔄 변경이력:
 *   - 2025-10-30: shadcn UI 마이그레이션 (기존 116줄 → 24줄, 79% 감소)
 */

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { PodDisruptionBudgetsCommonTable } from "./pod-disruption-budgets-common-table";

/**
 * PDB 리스트 뷰 컴포넌트
 *
 * @description
 * - SiblingsInTabLayout으로 감싼 PDB 테이블
 * - 실제 테이블 로직은 PodDisruptionBudgetsCommonTable에 위임
 */
export const PodDisruptionBudgets = () => {
  return (
    <SiblingsInTabLayout>
      <PodDisruptionBudgetsCommonTable />
    </SiblingsInTabLayout>
  );
};
