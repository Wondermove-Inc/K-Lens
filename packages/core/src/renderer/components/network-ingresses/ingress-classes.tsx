/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Ingress Classes 메인 컴포넌트 (간소화된 래퍼)
 *
 * @remarks
 * - SiblingsInTabLayout + IngressClassCommonTable 래퍼
 * - 기존 109줄 → 41줄로 간소화 (62% 감소)
 * - CommonTable에서 모든 로직 처리
 *
 * 🔄 변경이력:
 * - 2025-10-30: shadcn UI 마이그레이션 (CommonTable 패턴 적용)
 */

import { observer } from "mobx-react";
import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { IngressClassCommonTable } from "./ingress-classes-common-table";

/**
 * 🎯 목적: Ingress Classes 메인 컴포넌트
 *
 * @returns SiblingsInTabLayout으로 감싼 IngressClassCommonTable
 */
const NonInjectedIngressClasses = observer(() => {
  return (
    <SiblingsInTabLayout>
      <IngressClassCommonTable />
    </SiblingsInTabLayout>
  );
});

export const IngressClasses = NonInjectedIngressClasses;
