/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Namespaces 메인 컴포넌트 - shadcn UI + TanStack Table 기반
 *
 * @remarks
 * - SiblingsInTabLayout 래퍼 사용
 * - NamespaceCommonTable 컴포넌트 사용
 * - 기존 route.tsx (126줄)에서 ~40줄로 간소화
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 */

import { observer } from "mobx-react";
import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { AddNamespaceDialog } from "./add-dialog/dialog";
import { NamespaceCommonTable } from "./namespaces-common-table";

import "./namespaces.scss";

/**
 * 🎯 목적: Namespaces 메인 컴포넌트
 *
 * @returns SiblingsInTabLayout으로 감싼 NamespaceCommonTable
 */
const NonInjectedNamespaces = observer(() => {
  return (
    <>
      <SiblingsInTabLayout>
        <NamespaceCommonTable />
      </SiblingsInTabLayout>
      <AddNamespaceDialog />
    </>
  );
});

/**
 * 🎯 목적: Export용 Namespaces 컴포넌트
 */
export const Namespaces = NonInjectedNamespaces;
