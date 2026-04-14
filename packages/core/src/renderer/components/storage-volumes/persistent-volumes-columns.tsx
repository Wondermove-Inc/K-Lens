/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Persistent Volume 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 PV 전용 컬럼 정의
 * - 기존 컴포넌트 재사용 (KubeObjectStatusIcon, KubeObjectAge, WithTooltip)
 * - 정렬 가능한 컬럼: Name, Storage Class, Capacity, Status, Age
 * - StorageClass 및 Claim 링크 셀 구현
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

import type { PersistentVolume } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Persistent Volume 테이블 컬럼 정의 배열
 *
 * @remarks
 * 8개 컬럼: Checkbox, Name, Status Icon, Storage Class, Capacity, Claim, Age, Status
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const persistentVolumeColumns: ColumnDef<PersistentVolume>[] = [
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
      const pv = row.original;
      return (
        <div className="px-3">
          <WithTooltip>
            <div className="font-medium">{pv.getName()}</div>
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
      const pv = row.original;
      return (
        <div className="px-3">
          <KubeObjectStatusIcon object={pv} />
        </div>
      );
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
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
      const pv = row.original;
      const { storageClassName } = pv.spec;
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
      const classA = rowA.original.getStorageClass();
      const classB = rowB.original.getStorageClass();
      return classA.localeCompare(classB);
    },
  },

  // ============================================
  // 💾 Capacity 컬럼 (정렬 가능)
  // ============================================
  {
    accessorKey: "capacity",
    id: "capacity",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Capacity
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const pv = row.original;
      return (
        <div className="px-3">
          <WithTooltip>{pv.getCapacity()}</WithTooltip>
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const capacityA = rowA.original.getCapacity(true);
      const capacityB = rowB.original.getCapacity(true);
      // getCapacity(true)는 문자열을 반환하므로 localeCompare 사용 가능
      if (typeof capacityA === "string" && typeof capacityB === "string") {
        return capacityA.localeCompare(capacityB);
      }
      // 만약 숫자라면 숫자 비교
      return Number(capacityA) - Number(capacityB);
    },
  },

  // ============================================
  // 🔗 Claim 컬럼 (정렬 비활성화, 링크 또는 null)
  // ============================================
  {
    id: "claim",
    header: () => <div className="px-3">Claim</div>,
    cell: ({ row }) => {
      const pv = row.original;
      const { claimRef } = pv.spec;

      if (!claimRef) {
        return <div className="px-3" />;
      }

      return (
        <div className="px-3">
          <WithTooltip>{claimRef.name}</WithTooltip>
        </div>
      );
    },
    size: 150,
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
      const pv = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={pv} />
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
      const pv = row.original;
      const status = pv.getStatus();
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
