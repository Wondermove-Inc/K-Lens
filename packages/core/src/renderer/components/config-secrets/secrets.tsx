/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Secrets 메인 컴포넌트
 *
 * 구성:
 * - SiblingsInTabLayout으로 감싼 SecretsCommonTable
 * - AddSecretDialog 포함
 * - CommonTable 패턴으로 마이그레이션 완료
 *
 * 📝 주의사항:
 * - CommonTable이 모든 기능 포함 (검색, 필터, 테이블, Add 버튼)
 * - 이 컴포넌트는 레이아웃 wrapper 역할만 수행
 *
 * 🔄 변경이력:
 * - 2025-10-30: shadcn UI 마이그레이션 (CommonTable 패턴 + Add 버튼)
 */

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { AddSecretDialog } from "./add-dialog/view";
import { SecretsCommonTable } from "./secrets-common-table";

/**
 * 🎯 목적: Secrets 컴포넌트 (Tab 레이아웃)
 */
export const Secrets = () => {
  return (
    <SiblingsInTabLayout>
      <SecretsCommonTable />
      <AddSecretDialog />
    </SiblingsInTabLayout>
  );
};
