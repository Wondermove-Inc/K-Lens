/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Pod 목록 화면 - shadcn/ui CommonTable 패턴 적용
 *
 * 🔄 변경이력:
 * - 2025-10-28: KubeObjectListLayout → PodCommonTable 마이그레이션
 */

import "./pods.scss";

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { PodCommonTable } from "./pods-common-table";

/**
 * 🎯 목적: Pod 목록을 shadcn/ui CommonTable로 렌더링
 * 📝 주의: PodCommonTable이 자체적으로 DI를 처리하므로 props 전달 불필요
 */
export const Pods = () => {
  return (
    <SiblingsInTabLayout>
      <PodCommonTable className="Pods" />
    </SiblingsInTabLayout>
  );
};
