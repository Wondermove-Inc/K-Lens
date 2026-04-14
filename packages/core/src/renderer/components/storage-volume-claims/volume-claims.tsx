/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Persistent Volume Claims 페이지 - PersistentVolumeClaimsCommonTable 사용
 *
 * @remarks
 * - KubeObjectListLayout에서 PersistentVolumeClaimsCommonTable (shadcn UI)로 마이그레이션 완료
 * - Pod 패턴과 동일하게 SiblingsInTabLayout 래퍼 유지
 *
 * 🔄 변경이력:
 * - 2025-10-30: PersistentVolumeClaimsCommonTable로 마이그레이션 (shadcn UI 적용)
 */

import "./volume-claims.scss";

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { PersistentVolumeClaimsCommonTable } from "./volume-claims-common-table";

export const PersistentVolumeClaims = () => {
  return (
    <SiblingsInTabLayout>
      <PersistentVolumeClaimsCommonTable className="PersistentVolumeClaims" />
    </SiblingsInTabLayout>
  );
};
