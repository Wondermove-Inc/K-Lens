/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CustomResourceDefinitions 메인 컴포넌트 - shadcn 스타일 테이블 적용
 *
 * @remarks
 * - CustomResourceDefinitionCommonTable 사용 (KubeDataTable 기반)
 * - SiblingsInTabLayout 사용 (다른 리소스와 동일 패턴)
 *
 * 🔄 변경이력:
 * - 2025-11-05: 초기 생성 (RoleBindings 패턴 기반)
 * - 2025-12-01: TabLayout → SiblingsInTabLayout 변경 (마진 이슈 해결)
 */

import { observer } from "mobx-react";
import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { CustomResourceDefinitionCommonTable } from "./custom-resource-definitions-common-table";

/**
 * 🎯 목적: CustomResourceDefinitions 메인 컴포넌트
 *
 * @returns SiblingsInTabLayout + CustomResourceDefinitionCommonTable
 */
export const CustomResourceDefinitions = observer(() => {
  return (
    <SiblingsInTabLayout>
      <CustomResourceDefinitionCommonTable />
    </SiblingsInTabLayout>
  );
});
