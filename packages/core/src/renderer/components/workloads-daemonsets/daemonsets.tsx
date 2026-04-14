/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: DaemonSet 워크로드 메인 컴포넌트
 *
 * 📝 주의사항:
 * - DaemonSetsCommonTable 사용 (CommonTable 패턴)
 * - SiblingsInTabLayout으로 래핑 (탭 레이아웃 일관성 유지)
 * - Injectable DI는 DaemonSetsCommonTable 내부에서 처리
 *
 * 🔄 변경이력:
 * - 2025-10-30: CommonTable 패턴으로 마이그레이션 (shadcn UI + Detail Panel)
 */

import { observer } from "mobx-react";
import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { DaemonSetsCommonTable } from "./daemonsets-common-table";

/**
 * 🎯 목적: DaemonSet 워크로드 메인 컴포넌트
 * - DaemonSetsCommonTable을 SiblingsInTabLayout으로 래핑
 */
const NonInjectedDaemonSets = observer(() => {
  return (
    <SiblingsInTabLayout>
      <DaemonSetsCommonTable />
    </SiblingsInTabLayout>
  );
});

/**
 * 🎯 목적: Export용 DaemonSets 컴포넌트
 * - Injectable DI는 DaemonSetsCommonTable에서 처리하므로 여기서는 불필요
 */
export const DaemonSets = NonInjectedDaemonSets;
