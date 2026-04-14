/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Replication Controllers 화면 진입점
 *
 * @remarks
 * - KubeDataTable 기반 shadcn UI 스타일 적용
 * - ReplicationControllersCommonTable 컴포넌트 사용
 * - 기존 KubeObjectListLayout에서 마이그레이션 완료
 *
 * 🔄 변경이력:
 * - 2025-10-31: shadcn UI 마이그레이션 (KubeDataTable 기반 구현)
 */

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { ReplicationControllersCommonTable } from "./replication-controllers-common-table";

/**
 * 🎯 목적: Replication Controllers 화면 렌더링
 *
 * @remarks
 * - SiblingsInTabLayout으로 탭 레이아웃 래핑
 * - ReplicationControllersCommonTable이 자체적으로 DI 처리
 */
export const ReplicationControllers = () => {
  return (
    <SiblingsInTabLayout>
      <ReplicationControllersCommonTable className="ReplicationControllers" />
    </SiblingsInTabLayout>
  );
};
