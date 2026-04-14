/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Storage Classes 페이지 - StorageClassesCommonTable 사용
 *
 * @remarks
 * - KubeObjectListLayout에서 StorageClassesCommonTable (shadcn UI)로 마이그레이션 완료
 * - Pod 패턴과 동일하게 SiblingsInTabLayout 래퍼 유지
 *
 * 🔄 변경이력:
 * - 2025-10-30: StorageClassesCommonTable로 마이그레이션 (shadcn UI 적용)
 */

import "./storage-classes.scss";

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { StorageClassesCommonTable } from "./storage-classes-common-table";

export const StorageClasses = () => {
  return (
    <SiblingsInTabLayout>
      <StorageClassesCommonTable className="StorageClasses" />
    </SiblingsInTabLayout>
  );
};
