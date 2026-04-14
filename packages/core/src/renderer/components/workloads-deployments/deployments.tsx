/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Deployments 페이지 - DeploymentCommonTable 사용
 *
 * @remarks
 * - KubeObjectListLayout에서 DeploymentCommonTable (shadcn UI)로 마이그레이션 완료
 * - Pod 패턴과 동일하게 SiblingsInTabLayout 래퍼 유지
 *
 * 🔄 변경이력:
 * - 2025-10-30: DeploymentCommonTable로 마이그레이션 (shadcn UI 적용)
 */

import "./deployments.scss";

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { DeploymentCommonTable } from "./deployments-common-table";

export const Deployments = () => {
  return (
    <SiblingsInTabLayout>
      <DeploymentCommonTable className="Deployments" />
    </SiblingsInTabLayout>
  );
};
