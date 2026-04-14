/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: PDB 테이블의 컬럼 정의 (TanStack Table 사용)
 *
 * 📊 컬럼 구성 (9개):
 * 1. Checkbox - 행 선택용
 * 2. Name - PDB 이름 (정렬 가능)
 * 3. Status Icon - 상태 아이콘
 * 4. Namespace - 네임스페이스 (Badge 표시)
 * 5. Min Available - 최소 가용 Pod 수
 * 6. Max Unavailable - 최대 사용 불가 Pod 수
 * 7. Current Healthy - 현재 정상 Pod 수
 * 8. Desired Healthy - 원하는 정상 Pod 수
 * 9. Age - 생성된 지 얼마나 지났는지
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

import type { PodDisruptionBudget } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

export const podDisruptionBudgetColumns: ColumnDef<PodDisruptionBudget>[] = [
  // ============================================
  // 📋 Checkbox 컬럼 (선택용, 48px 고정 너비)
  // ============================================
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
      const pdb = row.original;
      return <div className="px-3 font-medium">{pdb.getName()}</div>;
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
      const pdb = row.original;
      return (
        <div className="flex items-center justify-center">
          <KubeObjectStatusIcon object={pdb} />
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
      const pdb = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={pdb.getNs()} />
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
  // 📋 Min Available 컬럼 (최소 가용 Pod 수, 150px)
  // ============================================
  {
    id: "min-available",
    size: 150,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Min Available
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pdb = row.original;
      const minAvailable = pdb.getMinAvailable();
      return <div className="px-3">{minAvailable ?? "-"}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const minA = Number(rowA.original.getMinAvailable() ?? 0);
      const minB = Number(rowB.original.getMinAvailable() ?? 0);
      return minA - minB;
    },
  },

  // ============================================
  // 📋 Max Unavailable 컬럼 (최대 사용 불가 Pod 수, 150px)
  // ============================================
  {
    id: "max-unavailable",
    size: 150,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Max Unavailable
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pdb = row.original;
      const maxUnavailable = pdb.getMaxUnavailable();
      return <div className="px-3">{maxUnavailable ?? "-"}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const maxA = Number(rowA.original.getMaxUnavailable() ?? 0);
      const maxB = Number(rowB.original.getMaxUnavailable() ?? 0);
      return maxA - maxB;
    },
  },

  // ============================================
  // 📋 Current Healthy 컬럼 (현재 정상 Pod 수, 150px)
  // ============================================
  {
    id: "current-healthy",
    size: 150,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Current Healthy
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pdb = row.original;
      const currentHealthy = pdb.getCurrentHealthy();
      return <div className="px-3">{currentHealthy ?? "-"}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const currentA = rowA.original.getCurrentHealthy() ?? 0;
      const currentB = rowB.original.getCurrentHealthy() ?? 0;
      return currentA - currentB;
    },
  },

  // ============================================
  // 📋 Desired Healthy 컬럼 (원하는 정상 Pod 수, 150px)
  // ============================================
  {
    id: "desired-healthy",
    size: 150,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Desired Healthy
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pdb = row.original;
      const desiredHealthy = pdb.getDesiredHealthy();
      return <div className="px-3">{desiredHealthy ?? "-"}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const desiredA = rowA.original.getDesiredHealthy() ?? 0;
      const desiredB = rowB.original.getDesiredHealthy() ?? 0;
      return desiredA - desiredB;
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
      const pdb = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={pdb} />
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
