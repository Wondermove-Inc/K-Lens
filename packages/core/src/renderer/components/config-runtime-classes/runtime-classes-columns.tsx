/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Runtime Classes 테이블의 컬럼 정의 (TanStack Table 사용)
 *
 * 📊 컬럼 구성 (5개):
 * 1. Checkbox - 행 선택용
 * 2. Name - Runtime Class 이름 (정렬 가능)
 * 3. Status Icon - 상태 아이콘
 * 4. Handler - 런타임 핸들러
 * 5. Age - 생성된 지 얼마나 지났는지
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";

import type { RuntimeClass } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

export const runtimeClassColumns: ColumnDef<RuntimeClass>[] = [
  {
    id: "select",
    size: 64,
    enableSorting: false,
    enableResizing: false,
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    meta: {
      cellClassName: "text-center",
    },
  },
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
    cell: ({ row }) => <div className="px-3 font-medium">{row.original.getName()}</div>,
    sortingFn: (rowA, rowB) => {
      const nameA = rowA.original.getName();
      const nameB = rowB.original.getName();
      return nameA.localeCompare(nameB);
    },
  },
  {
    id: "status-icon",
    size: 24,
    enableSorting: false,
    enableResizing: false,
    header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <KubeObjectStatusIcon object={row.original} />
      </div>
    ),
    meta: {
      cellClassName: "text-center",
    },
  },
  {
    id: "handler",
    size: 250,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Handler
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="px-3 font-mono text-sm">{row.original.getHandler()}</div>,
    sortingFn: (rowA, rowB) => {
      const handlerA = rowA.original.getHandler();
      const handlerB = rowB.original.getHandler();
      return handlerA.localeCompare(handlerB);
    },
  },
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
    cell: ({ row }) => (
      <div className="px-3">
        <KubeObjectAge object={row.original} />
      </div>
    ),
    sortingFn: (rowA, rowB) => {
      const ageA = -rowA.original.getCreationTimestamp();
      const ageB = -rowB.original.getCreationTimestamp();
      return ageA - ageB;
    },
  },
];
