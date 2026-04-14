/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: VPA 리스트 뷰 래퍼 컴포넌트 (shadcn UI 마이그레이션 완료)
 *
 * 📝 주의사항:
 *   - 실제 테이블 로직은 vpa-common-table.tsx에 위임
 *   - 이 파일은 SiblingsInTabLayout 레이아웃만 담당
 *
 * 🔄 변경이력:
 *   - 2025-10-30: shadcn UI 마이그레이션 (기존 88줄 → 24줄, 73% 감소)
 */

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { VerticalPodAutoscalersCommonTable } from "./vpa-common-table";

/**
 * VPA 리스트 뷰 컴포넌트
 *
 * @description
 * - SiblingsInTabLayout으로 감싼 VPA 테이블
 * - 실제 테이블 로직은 VerticalPodAutoscalersCommonTable에 위임
 */
export const VerticalPodAutoscalers = () => {
  return (
    <SiblingsInTabLayout>
      <VerticalPodAutoscalersCommonTable />
    </SiblingsInTabLayout>
  );
};
