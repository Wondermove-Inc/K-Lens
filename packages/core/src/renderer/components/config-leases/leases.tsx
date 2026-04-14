/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Leases 리스트 뷰 래퍼 컴포넌트 (shadcn UI 마이그레이션 완료)
 *
 * 🔄 변경이력:
 *   - 2025-10-30: shadcn UI 마이그레이션 (기존 83줄 → 20줄, 76% 감소)
 */

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { LeasesCommonTable } from "./leases-common-table";

export const Leases = () => {
  return (
    <SiblingsInTabLayout>
      <LeasesCommonTable />
    </SiblingsInTabLayout>
  );
};
