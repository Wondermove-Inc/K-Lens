/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Storage Class 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Storage Class 전용 컬럼 정의
 * - 기존 컴포넌트 재사용 (KubeObjectStatusIcon, KubeObjectAge, WithTooltip)
 * - 정렬 가능한 컬럼: Name, Provisioner, Reclaim Policy, Age
 * - Default 컬럼 셀 구현 (Yes/null → Badge 스타일)
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의, StatefulSets 패턴 참조)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { WithTooltip } from "../with-tooltip";

import type { StorageClass } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Storage Class 테이블 컬럼 정의 배열
 *
 * @remarks
 * 7개 컬럼: Checkbox, Name, Status Icon, Provisioner, Reclaim Policy, Default, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const storageClassColumns: ColumnDef<StorageClass>[] = [
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
      const storageClass = row.original;
      return (
        <div className="px-3">
          <WithTooltip>
            <div className="font-medium">{storageClass.getName()}</div>
          </WithTooltip>
        </div>
      );
    },
    size: 200,
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
      const storageClass = row.original;
      return (
        <div className="px-3">
          <KubeObjectStatusIcon object={storageClass} />
        </div>
      );
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
  },

  // ============================================
  // 🏷️ Provisioner 컬럼 (정렬 가능)
  // ============================================
  {
    accessorKey: "provisioner",
    id: "provisioner",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Provisioner
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const storageClass = row.original;
      return (
        <div className="px-3">
          <WithTooltip>{storageClass.provisioner}</WithTooltip>
        </div>
      );
    },
    size: 200,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const provA = rowA.original.provisioner;
      const provB = rowB.original.provisioner;
      return provA.localeCompare(provB);
    },
  },

  // ============================================
  // 🔄 Reclaim Policy 컬럼 (정렬 가능)
  // ============================================
  {
    accessorKey: "reclaimPolicy",
    id: "reclaimPolicy",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Reclaim Policy
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const storageClass = row.original;
      return (
        <div className="px-3">
          <WithTooltip>{storageClass.getReclaimPolicy()}</WithTooltip>
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const policyA = rowA.original.reclaimPolicy || "";
      const policyB = rowB.original.reclaimPolicy || "";
      return policyA.localeCompare(policyB);
    },
  },

  // ============================================
  // ✅ Default 컬럼 (정렬 비활성화, Badge 스타일)
  // ============================================
  {
    id: "default",
    header: () => <div className="px-3">Default</div>,
    cell: ({ row }) => {
      const storageClass = row.original;
      if (!storageClass.isDefault()) {
        return <div className="px-3" />;
      }

      return (
        <div className="px-3">
          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
            Yes
          </span>
        </div>
      );
    },
    size: 100,
    enableSorting: false,
    enableResizing: true,
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
      const storageClass = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={storageClass} />
        </div>
      );
    },
    size: 100,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const ageA = rowA.original.getCreationTimestamp();
      const ageB = rowB.original.getCreationTimestamp();
      return ageB - ageA; // 최신순 (역순)
    },
  },
];
