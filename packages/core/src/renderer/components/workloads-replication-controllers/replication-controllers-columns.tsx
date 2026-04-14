/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Replication Controller 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Replication Controller 전용 컬럼 정의
 * - 기존 컴포넌트 재사용 (NamespaceSelectBadge, KubeObjectAge)
 * - 정렬 가능한 컬럼: Name, Namespace, Desired, Current, Ready, Selector, Age
 * - Selector는 Badge 배열로 표시
 *
 * 🔄 변경이력:
 * - 2025-10-31: 초기 생성 (TanStack Table 컬럼 정의, ReplicaSets 참조)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
// 기존 컴포넌트 imports
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";
import { WithTooltip } from "../with-tooltip";

import type { ReplicationController } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Replication Controller 테이블 컬럼 정의 배열
 *
 * @remarks
 * 8개 컬럼: Checkbox, Name, Namespace, Desired, Current, Ready, Selector, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const replicationControllerColumns: ColumnDef<ReplicationController>[] = [
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
      const rc = row.original;
      return (
        <div className="px-3">
          <WithTooltip>
            <div className="font-medium">{rc.getName()}</div>
          </WithTooltip>
        </div>
      );
    },
    size: 200,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.getName();
      const b = rowB.original.getName();
      return a.localeCompare(b);
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
      const rc = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={rc.getNs()} />
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.getNs();
      const b = rowB.original.getNs();
      return a.localeCompare(b);
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
      const rc = row.original;
      return <div className="px-3">{rc.getDesiredReplicas()}</div>;
    },
    size: 100,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.getDesiredReplicas();
      const b = rowB.original.getDesiredReplicas();
      return a - b;
    },
  },

  // ============================================
  // 📊 Current 컬럼 (정렬 가능, 리사이징 가능)
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
      const rc = row.original;
      return <div className="px-3">{rc.getReplicas() || 0}</div>;
    },
    size: 100,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.getReplicas() || 0;
      const b = rowB.original.getReplicas() || 0;
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
      const rc = row.original;
      return <div className="px-3">{rc.status?.readyReplicas || 0}</div>;
    },
    size: 100,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.status?.readyReplicas || 0;
      const b = rowB.original.status?.readyReplicas || 0;
      return a - b;
    },
  },

  // ============================================
  // 🏷️ Selector 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "selector",
    id: "selector",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Selector
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const rc = row.original;
      const labels = rc.getSelectorLabels();

      // 🎯 빈 배열 처리
      if (labels.length === 0) {
        return <span className="px-3 text-muted-foreground text-xs">None</span>;
      }

      return (
        <div className="flex flex-wrap gap-1 px-3">
          {labels.map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      );
    },
    size: 250,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.getSelectorLabels().join(",");
      const b = rowB.original.getSelectorLabels().join(",");
      return a.localeCompare(b);
    },
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
      const rc = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge key="age" object={rc} />
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.metadata.creationTimestamp;
      const b = rowB.original.metadata.creationTimestamp;
      if (!a || !b) return 0;
      return new Date(b).getTime() - new Date(a).getTime(); // 최신순
    },
  },
];
