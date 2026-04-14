/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: VPA 테이블의 컬럼 정의 (TanStack Table 사용)
 *
 * 📊 컬럼 구성 (6개):
 * 1. Checkbox - 행 선택용
 * 2. Name - VPA 이름 (정렬 가능)
 * 3. Status Icon - 상태 아이콘
 * 4. Namespace - 네임스페이스 (Badge 표시)
 * 5. Mode - VPA 모드 (Off, Auto, Recreate, Initial)
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
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { VerticalPodAutoscaler } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

export const verticalPodAutoscalerColumns: ColumnDef<VerticalPodAutoscaler>[] = [
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
  // 📋 Name 컬럼 (정렬 가능, 200px 기본 너비)
  // ============================================
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
    cell: ({ row }) => {
      const vpa = row.original;
      return <div className="px-3 font-medium">{vpa.getName()}</div>;
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
      const vpa = row.original as any;
      return (
        <div className="flex items-center justify-center">
          <KubeObjectStatusIcon object={vpa} />
        </div>
      );
    },
    meta: {
      cellClassName: "text-center",
    },
  },

  // ============================================
  // 📋 Namespace 컬럼 (Badge 표시, 150px 기본 너비)
  // ============================================
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
      const vpa = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={vpa.getNs()} />
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const nsA = rowA.original.getNs();
      const nsB = rowB.original.getNs();
      return nsA.localeCompare(nsB);
    },
  },

  // ============================================
  // 📋 Mode 컬럼 (VPA 모드, 150px)
  // ============================================
  {
    id: "mode",
    size: 150,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Mode
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const vpa = row.original;
      const mode = vpa.getMode();
      return (
        <div className="px-3">
          <Badge variant={mode === "Auto" ? "default" : "outline"}>{mode}</Badge>
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const modeA = rowA.original.getMode();
      const modeB = rowB.original.getMode();
      return modeA.localeCompare(modeB);
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
      const vpa = row.original as any;
      return (
        <div className="px-3">
          <KubeObjectAge object={vpa} />
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
