/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Persistent Volume Claim 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 PVC 전용 컬럼 정의
 * - 기존 컴포넌트 재사용 (NamespaceSelectBadge, KubeObjectStatusIcon, KubeObjectAge, WithTooltip)
 * - 정렬 가능한 컬럼: Name, Namespace, Storage Class, Size, Pods, Age, Status
 * - StorageClass 및 Pods 링크 셀 구현
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의, StatefulSets 패턴 참조)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { unitsToBytes } from "@skuberplus/utilities";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";
import { WithTooltip } from "../with-tooltip";

import type { PersistentVolumeClaim } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Persistent Volume Claim 테이블 컬럼 정의 배열
 *
 * @remarks
 * 8개 컬럼: Checkbox, Name, Status Icon, Namespace, Storage Class, Size, Age, Status
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const persistentVolumeClaimColumns: ColumnDef<PersistentVolumeClaim>[] = [
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
      const pvc = row.original;
      return (
        <div className="px-3">
          <WithTooltip>
            <div className="font-medium">{pvc.getName()}</div>
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
      const pvc = row.original;
      return (
        <div className="px-3">
          <KubeObjectStatusIcon object={pvc} />
        </div>
      );
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
  },

  // ============================================
  // 🏷️ Namespace 컬럼 (정렬 가능, Badge 스타일)
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
      const pvc = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={pvc.getNs()} />
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const nsA = rowA.original.getNs();
      const nsB = rowB.original.getNs();
      return nsA.localeCompare(nsB);
    },
  },

  // ============================================
  // 🏷️ Storage Class 컬럼 (정렬 가능, 링크)
  // ============================================
  {
    accessorKey: "storageClass",
    id: "storageClass",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Storage Class
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pvc = row.original;
      const { storageClassName } = pvc.spec;
      return (
        <div className="px-3">
          <WithTooltip>{storageClassName}</WithTooltip>
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const classA = rowA.original.spec.storageClassName || "";
      const classB = rowB.original.spec.storageClassName || "";
      return classA.localeCompare(classB);
    },
  },

  // ============================================
  // 💾 Size 컬럼 (정렬 가능)
  // ============================================
  {
    accessorKey: "size",
    id: "size",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Size
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pvc = row.original;
      return (
        <div className="px-3">
          <WithTooltip>{pvc.getStorage()}</WithTooltip>
        </div>
      );
    },
    size: 100,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const sizeA = unitsToBytes(rowA.original.getStorage());
      const sizeB = unitsToBytes(rowB.original.getStorage());
      return sizeA - sizeB;
    },
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
      const pvc = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={pvc} />
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

  // ============================================
  // 📊 Status 컬럼 (정렬 가능, className 동적 적용)
  // ============================================
  {
    accessorKey: "status",
    id: "status",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Status
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pvc = row.original;
      const status = pvc.getStatus();
      return <div className={`px-3 ${status.toLowerCase()}`}>{status}</div>;
    },
    size: 120,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const statusA = rowA.original.getStatus();
      const statusB = rowB.original.getStatus();
      return statusA.localeCompare(statusB);
    },
  },
];
