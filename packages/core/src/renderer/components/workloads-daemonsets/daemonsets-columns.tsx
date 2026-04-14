/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: DaemonSet 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 DaemonSet 전용 컬럼 정의
 * - 기존 Cell 컴포넌트 재사용 (namespace-cell, node-selector-cell, status-cell)
 * - 정렬 가능한 컬럼: Name, Namespace, Desired, Current, Ready, Updated, Available, Age
 * - 10개 컬럼: Checkbox, Name, Namespace, Desired, Current, Ready, Updated, Available, Status Icon, Node Selector, Age
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
// Cell 컴포넌트 imports
import { NamespaceCell } from "./daemonset-table-cells/namespace-cell";
import { NodeSelectorCell } from "./daemonset-table-cells/node-selector-cell";
import { StatusCell } from "./daemonset-table-cells/status-cell";

import type { DaemonSet } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: DaemonSet 타입 (컬럼 접근용)
 */
export type DaemonSetWithStatus = DaemonSet;

/**
 * 🎯 목적: DaemonSet 테이블 컬럼 정의 배열
 *
 * @remarks
 * 11개 컬럼: Checkbox, Name, Namespace, Desired, Current, Ready, Updated, Available, Status Icon, Node Selector, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const daemonSetColumns: ColumnDef<DaemonSetWithStatus>[] = [
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
      const daemonSet = row.original;
      return <div className="px-3 font-medium">{daemonSet.getName()}</div>;
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
      const daemonSet = row.original;
      return (
        <div className="px-3">
          <NamespaceCell daemonSet={daemonSet} />
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
  // 🔢 Desired 컬럼 (정렬 가능, 리사이징 가능)
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
      const daemonSet = row.original;
      return <div className="px-3">{daemonSet.status?.desiredNumberScheduled || 0}</div>;
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.status?.desiredNumberScheduled || 0;
      const b = rowB.original.status?.desiredNumberScheduled || 0;
      return a - b;
    },
  },

  // ============================================
  // 🔢 Current 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "current",
    id: "current",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Current
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const daemonSet = row.original;
      return <div className="px-3">{daemonSet.status?.currentNumberScheduled || 0}</div>;
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.status?.currentNumberScheduled || 0;
      const b = rowB.original.status?.currentNumberScheduled || 0;
      return a - b;
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
      const daemonSet = row.original;
      return <div className="px-3">{daemonSet.status?.numberReady || 0}</div>;
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.status?.numberReady || 0;
      const b = rowB.original.status?.numberReady || 0;
      return a - b;
    },
  },

  // ============================================
  // 🔄 Updated 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "updated",
    id: "updated",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Updated
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const daemonSet = row.original;
      return <div className="px-3">{daemonSet.status?.updatedNumberScheduled || 0}</div>;
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.status?.updatedNumberScheduled || 0;
      const b = rowB.original.status?.updatedNumberScheduled || 0;
      return a - b;
    },
  },

  // ============================================
  // ✅ Available 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "available",
    id: "available",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Available
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const daemonSet = row.original;
      return <div className="px-3">{daemonSet.status?.numberAvailable || 0}</div>;
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.status?.numberAvailable || 0;
      const b = rowB.original.status?.numberAvailable || 0;
      return a - b;
    },
  },

  // ============================================
  // ⚠️ Status Icon 컬럼 (상태 아이콘, 24px 고정)
  // ============================================
  {
    id: "status-icon",
    header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
    cell: ({ row }) => {
      const daemonSet = row.original;
      return <StatusCell daemonSet={daemonSet} />;
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
  },

  // ============================================
  // 🏷️ Node Selector 컬럼 (정렬 불가, 리사이징 가능)
  // ============================================
  {
    id: "nodeSelector",
    header: () => (
      <Button data-slot="button" variant="ghost" className="cursor-default hover:bg-transparent">
        Node Selector
      </Button>
    ),
    cell: ({ row }) => {
      const daemonSet = row.original;
      return (
        <div className="px-3">
          <NodeSelectorCell daemonSet={daemonSet} />
        </div>
      );
    },
    size: 200,
    enableSorting: false,
  },

  // ============================================
  // 🕐 Age 컬럼 (정렬 가능, 리사이징 가능)
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
      const daemonSet = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge key="age" object={daemonSet} />
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      // 🎯 목적: Age 역순 정렬 (최신이 위로)
      const a = new Date(rowA.original.getCreationTimestamp()).getTime();
      const b = new Date(rowB.original.getCreationTimestamp()).getTime();
      return b - a;
    },
  },
];
