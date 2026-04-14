/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Helm Charts 메인 컴포넌트 - shadcn 스타일 래퍼
 *
 * @remarks
 * - HelmChartsCommonTable을 SiblingsInTabLayout으로 감싸는 간단한 래퍼
 * - 기존 145 lines → 약 30 lines로 간소화 (79% 코드 감소)
 * - CronJobs/Events 래퍼 패턴 참조
 *
 * 📝 주의사항:
 * - 모든 로직은 HelmChartsCommonTable로 이동
 * - Injectable DI 패턴 제거 (CommonTable에서 처리)
 * - Class 컴포넌트 → Function 컴포넌트
 *
 * 🔄 변경이력:
 * - 2025-11-07: shadcn 마이그레이션 (ItemListLayout → HelmChartsCommonTable)
 */

import "./helm-charts.scss";

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { HelmChartsCommonTable } from "./helm-charts-common-table";

/**
 * 🎯 목적: Helm Charts 메인 래퍼 컴포넌트
 *
 * @returns SiblingsInTabLayout + HelmChartsCommonTable
 */
export const HelmCharts = () => {
  return (
    <SiblingsInTabLayout>
      <div data-testid="page-for-helm-charts" style={{ display: "none" }} />
      <HelmChartsCommonTable className="HelmCharts" />
    </SiblingsInTabLayout>
  );
};
