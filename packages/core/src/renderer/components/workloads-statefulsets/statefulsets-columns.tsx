/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: StatefulSet 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 StatefulSet 전용 컬럼 정의
 * - 기존 컴포넌트 재사용 (NamespaceSelectBadge, KubeObjectStatusIcon, KubeObjectAge)
 * - 정렬 가능한 컬럼: Name, Namespace, Ready, Desired, Age
 * - Status Icon은 정렬 비활성화 (상태 아이콘 표시만)
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
// 기존 컴포넌트 imports
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";
import { WithTooltip } from "../with-tooltip";

import type { StatefulSet } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: StatefulSet 테이블 컬럼 정의 배열
 *
 * @remarks
 * 7개 컬럼: Checkbox, Name, Namespace, Ready, Desired, Status Icon, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const statefulSetColumns: ColumnDef<StatefulSet>[] = [
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
      const statefulSet = row.original;
      return (
        <div className="px-3">
          <WithTooltip>
            <div className="font-medium">{statefulSet.getName()}</div>
          </WithTooltip>
        </div>
      );
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getName().localeCompare(rowB.original.getName());
    },
  },

  // ============================================
  // 🏷️ Namespace 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "namespace",
    id: "namespace",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Namespace
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const statefulSet = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={statefulSet.getNs()} />
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getNs().localeCompare(rowB.original.getNs());
    },
  },

  // ============================================
  // ✅ Ready 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "ready",
    id: "ready",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Ready
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const statefulSet = row.original;
      return <div className="px-3">{statefulSet.status?.readyReplicas || 0}</div>;
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const aReady = rowA.original.status?.readyReplicas || 0;
      const bReady = rowB.original.status?.readyReplicas || 0;
      return aReady - bReady;
    },
  },

  // ============================================
  // 🎯 Desired 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "desired",
    id: "desired",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Desired
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const statefulSet = row.original;
      return <div className="px-3">{statefulSet.getReplicas()}</div>;
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getReplicas() - rowB.original.getReplicas();
    },
  },

  // ============================================
  // ⚠️ Status Icon 컬럼 (상태 아이콘, 24px 고정)
  // ============================================
  {
    id: "status-icon",
    header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
    cell: ({ row }) => {
      const statefulSet = row.original;
      return (
        <div className="px-3">
          <KubeObjectStatusIcon object={statefulSet} />
        </div>
      );
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
  },

  // ============================================
  // ⏰ Age 컬럼 (정렬 가능, 리사이징 가능)
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
      const statefulSet = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={statefulSet} />
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      // Age는 역순 정렬 (최신순)
      return rowB.original.getCreationTimestamp() - rowA.original.getCreationTimestamp();
    },
  },
];
