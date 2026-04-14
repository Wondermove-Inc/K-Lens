/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Network Policies 메인 컴포넌트 (간소화된 래퍼)
 *
 * @remarks
 * - SiblingsInTabLayout + NetworkPolicyCommonTable 래퍼
 * - 기존 75줄 → 41줄로 간소화 (45% 감소)
 * - CommonTable에서 모든 로직 처리
 *
 * 🔄 변경이력:
 * - 2025-10-30: shadcn UI 마이그레이션 (CommonTable 패턴 적용)
 */

import { observer } from "mobx-react";
import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { NetworkPolicyCommonTable } from "./network-policies-common-table";

/**
 * 🎯 목적: Network Policies 메인 컴포넌트
 *
 * @returns SiblingsInTabLayout으로 감싼 NetworkPolicyCommonTable
 */
const NonInjectedNetworkPolicies = observer(() => {
  return (
    <SiblingsInTabLayout>
      <NetworkPolicyCommonTable />
    </SiblingsInTabLayout>
  );
});

export const NetworkPolicies = NonInjectedNetworkPolicies;
