/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ReplicaSet 워크로드 메인 컴포넌트
 *
 * 📝 주의사항:
 * - ReplicaSetsCommonTable 사용 (KubeObjectListLayout → KubeDataTable 마이그레이션)
 * - SiblingsInTabLayout으로 래핑 (탭 레이아웃 일관성 유지)
 * - Injectable DI는 ReplicaSetsCommonTable 내부에서 처리
 *
 * 🔄 변경이력:
 * - 2025-10-30: KubeObjectListLayout → ReplicaSetsCommonTable 마이그레이션 (shadcn UI 적용)
 */

import "./replicasets.scss";

import { observer } from "mobx-react";
import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { ReplicaSetsCommonTable } from "./replicasets-common-table";

/**
 * 🎯 목적: ReplicaSet 워크로드 메인 컴포넌트
 * - ReplicaSetsCommonTable을 SiblingsInTabLayout으로 래핑
 */
const NonInjectedReplicaSets = observer(() => {
  return (
    <SiblingsInTabLayout>
      <ReplicaSetsCommonTable />
    </SiblingsInTabLayout>
  );
});

/**
 * 🎯 목적: Export용 ReplicaSets 컴포넌트
 * - Injectable DI는 ReplicaSetsCommonTable에서 처리하므로 여기서는 불필요
 */
export const ReplicaSets = NonInjectedReplicaSets;
