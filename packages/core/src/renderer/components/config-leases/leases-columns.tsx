/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Leases 테이블의 컬럼 정의 (TanStack Table 사용)
 *
 * 📊 컬럼 구성 (6개):
 * 1. Checkbox - 행 선택용
 * 2. Name - Lease 이름 (정렬 가능)
 * 3. Status Icon - 상태 아이콘
 * 4. Namespace - 네임스페이스 (Badge 표시)
 * 5. Holder - 임대 홀더
 * 6. Age - 생성된 지 얼마나 지났는지
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { Lease } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

export const leaseColumns: ColumnDef<Lease>[] = [
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
  {
    accessorKey: "name",
    id: "name",
    size: 200,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="px-3 font-medium">{row.original.getName()}</div>,
    sortingFn: (rowA, rowB) => rowA.original.getName().localeCompare(rowB.original.getName()),
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
    id: "namespace",
    size: 150,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Namespace
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const lease = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={lease.getNs()} />
        </div>
      );
    },
    sortingFn: (rowA, rowB) => rowA.original.getNs().localeCompare(rowB.original.getNs()),
  },
  {
    id: "holder",
    size: 250,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Holder
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="px-3 font-mono text-sm">{row.original.getHolderIdentity()}</div>,
    sortingFn: (rowA, rowB) => rowA.original.getHolderIdentity().localeCompare(rowB.original.getHolderIdentity()),
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
