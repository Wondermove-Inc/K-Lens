/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Priority Classes 테이블의 컬럼 정의 (TanStack Table 사용)
 *
 * 📊 컬럼 구성 (6개):
 * 1. Checkbox - 행 선택용
 * 2. Name - Priority Class 이름 (정렬 가능)
 * 3. Status Icon - 상태 아이콘
 * 4. Value - 우선순위 값
 * 5. Global Default - 전역 기본값 여부
 * 6. Age - 생성된 지 얼마나 지났는지
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";

import type { PriorityClass } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

export const priorityClassColumns: ColumnDef<PriorityClass>[] = [
  // ============================================
  // 📋 Checkbox 컬럼 (선택용, 48px 고정 너비)
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
  // 📋 Name 컬럼 (정렬 가능, 250px 기본 너비)
  // ============================================
  {
    accessorKey: "name",
    id: "name",
    size: 250,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pc = row.original;
      return <div className="px-3 font-medium">{pc.getName()}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const nameA = rowA.original.getName();
      const nameB = rowB.original.getName();
      return nameA.localeCompare(nameB);
    },
  },

  // ============================================
  // 📋 Status Icon 컬럼 (상태 아이콘, 24px 고정)
  // ============================================
  {
    id: "status-icon",
    size: 24,
    enableSorting: false,
    enableResizing: false,
    header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
    cell: ({ row }) => {
      const pc = row.original;
      return (
        <div className="flex items-center justify-center">
          <KubeObjectStatusIcon object={pc} />
        </div>
      );
    },
    meta: {
      cellClassName: "text-center",
    },
  },

  // ============================================
  // 📋 Value 컬럼 (우선순위 값, 120px)
  // ============================================
  {
    id: "value",
    size: 120,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Value
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pc = row.original;
      return <div className="px-3">{pc.getValue()}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const valueA = rowA.original.getValue() ?? 0;
      const valueB = rowB.original.getValue() ?? 0;
      return valueA - valueB;
    },
  },

  // ============================================
  // 📋 Global Default 컬럼 (전역 기본값 여부, 150px)
  // ============================================
  {
    id: "global-default",
    size: 150,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Global Default
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pc = row.original;
      const isGlobalDefault = pc.getGlobalDefault();
      return (
        <div className="px-3">
          {isGlobalDefault ? <Badge variant="default">Yes</Badge> : <span className="text-muted-foreground">No</span>}
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const defaultA = rowA.original.getGlobalDefault() ? 1 : 0;
      const defaultB = rowB.original.getGlobalDefault() ? 1 : 0;
      return defaultA - defaultB;
    },
  },

  // ============================================
  // 📋 Age 컬럼 (생성 시간, 120px 기본 너비)
  // ============================================
  {
    id: "age",
    size: 120,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Age
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pc = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={pc} />
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      // 최신 생성 시간이 더 작은 값
      const ageA = -rowA.original.getCreationTimestamp();
      const ageB = -rowB.original.getCreationTimestamp();
      return ageA - ageB;
    },
  },
];
