/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Cluster Roles 뷰 - shadcn UI 기반 KubeDataTable 사용
 *
 * 구성 요소:
 * - ClusterRolesCommonTable: KubeDataTable 기반 테이블 (검색, 정렬, 리사이징)
 * - AddClusterRoleDialog: Cluster Role 생성 다이얼로그
 * - SiblingsInTabLayout: 탭 레이아웃 래퍼
 *
 * 🔄 변경이력:
 * - 2025-10-30: shadcn UI 마이그레이션 (KubeObjectListLayout → KubeDataTable)
 */

import React from "react";
import { SiblingsInTabLayout } from "../../layout/siblings-in-tab-layout";
import { AddClusterRoleDialog } from "./add-dialog/view";
import { ClusterRolesCommonTable } from "./cluster-roles-common-table";

/**
 * 🎯 목적: Cluster Roles 메인 뷰 컴포넌트
 *
 * @returns Cluster Roles 테이블 및 생성 다이얼로그
 */
export const ClusterRoles = () => {
  return (
    <SiblingsInTabLayout>
      <ClusterRolesCommonTable className="ClusterRoles" />
      <AddClusterRoleDialog />
    </SiblingsInTabLayout>
  );
};
