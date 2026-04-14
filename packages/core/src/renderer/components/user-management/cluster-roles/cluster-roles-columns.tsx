/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Cluster Role 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Cluster Role 전용 컬럼 정의
 * - 기존 컴포넌트 재사용 (KubeObjectStatusIcon, KubeObjectAge, WithTooltip)
 * - 정렬 가능한 컬럼: Name, Age
 * - 클러스터 레벨 리소스이므로 Namespace 컬럼 없음
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의, Storage 패턴 참조)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../../kube-object/age";
import { KubeObjectStatusIcon } from "../../kube-object-status-icon";
import { WithTooltip } from "../../with-tooltip";

import type { ClusterRole } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Cluster Role 테이블 컬럼 정의 배열
 *
 * @remarks
 * 4개 컬럼: Checkbox, Name, Status Icon, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const clusterRoleColumns: ColumnDef<ClusterRole>[] = [
  // ============================================
  // 🔲 Checkbox 컬럼 (행 선택)
  // ============================================
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          data-slot="checkbox"
          aria-label="전체 선택"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          data-slot="checkbox"
          aria-label="행 선택"
        />
      </div>
    ),
    size: 64,
    enableSorting: false,
    enableResizing: false,
  },

  // ============================================
  // 📝 Name 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "name",
    id: "name",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const clusterRole = row.original;
      return (
        <div className="px-3">
          <WithTooltip>
            <div className="font-medium">{clusterRole.getName()}</div>
          </WithTooltip>
        </div>
      );
    },
    size: 300,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const nameA = rowA.original.getName();
      const nameB = rowB.original.getName();
      return nameA.localeCompare(nameB);
    },
  },

  // ============================================
  // ⚠️ Status Icon 컬럼 (상태 아이콘, 24px 고정)
  // ============================================
  {
    id: "status-icon",
    header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
    cell: ({ row }) => {
      const clusterRole = row.original;
      return <KubeObjectStatusIcon object={clusterRole} />;
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
  },

  // ============================================
  // ⏱️ Age 컬럼 (정렬 가능)
  // ============================================
  {
    accessorKey: "age",
    id: "age",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Age
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const clusterRole = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={clusterRole} />
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const ageA = rowA.original.getCreationTimestamp();
      const ageB = rowB.original.getCreationTimestamp();
      return ageB - ageA; // 최신순 (역순)
    },
  },
];
