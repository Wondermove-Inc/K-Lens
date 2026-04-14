/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Port Forwarding 페이지 - shadcn UI 마이그레이션
 *
 * @remarks
 * - PortForwardCommonTable (KubeDataTable 기반) 사용
 * - SiblingsInTabLayout 유지 (Detail Panel과 함께 사용)
 *
 * 🔄 변경이력:
 * - 2025-10-31: shadcn UI 마이그레이션 (ItemListLayout → KubeDataTable)
 */

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { PortForwardCommonTable } from "./port-forwards-common-table";

/**
 * 🎯 목적: Port Forwarding 페이지 컴포넌트
 *
 * @returns Port Forward 목록 테이블 (shadcn UI 기반)
 */
export function PortForwards() {
  return (
    <SiblingsInTabLayout>
      <PortForwardCommonTable />
    </SiblingsInTabLayout>
  );
}
