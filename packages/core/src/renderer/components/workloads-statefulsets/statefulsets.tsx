/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: StatefulSets 목록 페이지 - StatefulSetsCommonTable 렌더링
 *
 * @remarks
 * - SiblingsInTabLayout 래퍼로 탭 레이아웃 유지
 * - StatefulSetsCommonTable이 모든 로직 처리 (DI, 상태 관리, 렌더링)
 *
 * 🔄 변경이력:
 * - 2025-10-30: KubeObjectListLayout → StatefulSetsCommonTable 마이그레이션
 */

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { StatefulSetsCommonTable } from "./statefulsets-common-table";

import "./statefulsets.scss";

/**
 * 🎯 목적: StatefulSets 목록 페이지 컴포넌트
 */
export const StatefulSets = () => {
  return (
    <SiblingsInTabLayout>
      <StatefulSetsCommonTable className="StatefulSets" />
    </SiblingsInTabLayout>
  );
};
