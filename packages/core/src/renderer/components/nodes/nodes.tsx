/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Nodes 메인 컴포넌트 - shadcn UI + TanStack Table 기반
 *
 * @remarks
 * - SiblingsInTabLayout 래퍼 사용
 * - NodeCommonTable 컴포넌트 사용
 * - 기존 route.tsx (282줄)에서 ~40줄로 간소화
 * - Namespace 패턴 참고하여 구현
 *
 * 🔄 변경이력:
 * - 2025-11-04: 초기 생성 (Namespace 및 Pod 패턴 적용)
 */

import { observer } from "mobx-react";
import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { NodeCommonTable } from "./nodes-common-table";

import "./nodes.scss";

/**
 * 🎯 목적: Nodes 메인 컴포넌트
 *
 * @returns SiblingsInTabLayout으로 감싼 NodeCommonTable
 */
const NonInjectedNodes = observer(() => {
  return (
    <SiblingsInTabLayout>
      <NodeCommonTable />
    </SiblingsInTabLayout>
  );
});

/**
 * 🎯 목적: Export용 Nodes 컴포넌트
 */
export const Nodes = NonInjectedNodes;
