/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterRoleBindings 메인 컴포넌트 - shadcn UI + TanStack Table 기반
 *
 * @remarks
 * - SiblingsInTabLayout 래퍼 사용
 * - ClusterRoleBindingCommonTable 컴포넌트 사용
 * - 기존 view.tsx (107줄)에서 ~40줄로 간소화
 *
 * 🔄 변경이력:
 * - 2025-11-05: 초기 생성 (RoleBindings 패턴 기반)
 */

import { observer } from "mobx-react";
import React from "react";
import { SiblingsInTabLayout } from "../../layout/siblings-in-tab-layout";
import { ClusterRoleBindingCommonTable } from "./cluster-role-bindings-common-table";
import { ClusterRoleBindingDialog } from "./dialog/view";

/**
 * 🎯 목적: ClusterRoleBindings 메인 컴포넌트
 *
 * @returns SiblingsInTabLayout으로 감싼 ClusterRoleBindingCommonTable
 */
const NonInjectedClusterRoleBindings = observer(() => {
  return (
    <>
      <SiblingsInTabLayout>
        <ClusterRoleBindingCommonTable />
      </SiblingsInTabLayout>
      <ClusterRoleBindingDialog />
    </>
  );
});

/**
 * 🎯 목적: Export용 ClusterRoleBindings 컴포넌트
 */
export const ClusterRoleBindings = NonInjectedClusterRoleBindings;
