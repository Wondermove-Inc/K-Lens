/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CronJobs 페이지 - CronJobCommonTable 사용
 *
 * @remarks
 * - KubeObjectListLayout에서 CronJobCommonTable (shadcn UI)로 마이그레이션 완료
 * - Deployment 패턴과 동일하게 SiblingsInTabLayout 래퍼 유지
 *
 * 🔄 변경이력:
 * - 2025-10-30: CronJobCommonTable로 마이그레이션 (shadcn UI 적용)
 */

import "./cronjobs.scss";

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { CronJobCommonTable } from "./cronjobs-common-table";

export const CronJobs = () => {
  return (
    <SiblingsInTabLayout>
      <CronJobCommonTable className="CronJobs" />
    </SiblingsInTabLayout>
  );
};
