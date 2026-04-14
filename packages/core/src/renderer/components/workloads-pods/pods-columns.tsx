/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Pod 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Pod 전용 컬럼 정의
 * - 기존 Cell 컴포넌트 재사용 (containers-cell, namespace-cell, owners-cell, status-cell)
 * - 정렬 가능한 컬럼: Name, Namespace, Status, CPU, Memory, Restarts, Age
 * - 메트릭 데이터는 전처리된 PodWithMetrics 타입 사용
 *
 * 🔄 변경이력:
 * - 2025-10-29: 초기 생성 (TanStack Table 컬럼 정의)
 * - 2025-10-29: 메트릭 전처리 방식으로 변경 (성능 최적화)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { bytesToUnits } from "@skuberplus/utilities";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
// Cell 컴포넌트 imports
import { ContainersCell } from "./pod-table-cells/containers-cell";
import { NamespaceCell } from "./pod-table-cells/namespace-cell";
import { StatusCell } from "./pod-table-cells/status-cell";

import type { Pod } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: 메트릭 데이터가 포함된 Pod 타입
 *
 * @remarks
 * pods-common-table.tsx에서 전처리하여 메트릭 데이터를 추가한 타입
 */
export interface PodWithMetrics extends Pod {
  metrics: {
    cpu: number;
    memory: number;
  };
}

/**
 * 🎯 목적: Pod 테이블 컬럼 정의 배열
 *
 * @remarks
 * 10개 컬럼: Checkbox, Name, Namespace, Status, Containers, CPU, Memory, Restarts, Controlled By, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 * - PodWithMetrics 타입 사용: 전처리된 메트릭 데이터 포함
 */
export const podColumns: ColumnDef<PodWithMetrics>[] = [
  // ============================================
  // 🔲 Checkbox 컬럼 (행 선택) - 스토리북 스타일 (가운데 정렬)
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
  // 📝 Name 컬럼 (정렬 가능, 리사이징 가능) - 스토리북 스타일
  // ============================================
  {
    accessorKey: "name",
    id: "name",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Name
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const pod = row.original;
      return <div className="px-3 font-medium">{pod.getName()}</div>;
    },
    size: 200,
    minSize: 100,
    maxSize: 300,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getName().localeCompare(rowB.original.getName());
    },
  },

  // ============================================
  // 🏷️ Namespace 컬럼 (정렬 가능, 리사이징 가능) - 스토리북 스타일
  // ============================================
  {
    accessorKey: "namespace",
    id: "namespace",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Namespace
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const pod = row.original;
      return (
        <div className="px-3">
          <NamespaceCell pod={pod} />
        </div>
      );
    },
    size: 150,
    minSize: 100,
    maxSize: 300,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getNs().localeCompare(rowB.original.getNs());
    },
  },

  // ============================================
  // 🔄 Status 컬럼 (정렬 가능, 리사이징 가능) - 스토리북 스타일
  // ============================================
  {
    accessorKey: "status",
    id: "status",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Status
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const pod = row.original;
      return (
        <div className="px-3">
          <StatusCell pod={pod} />
        </div>
      );
    },
    size: 150,
    minSize: 100,
    maxSize: 250,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const statusA = rowA.original.getStatus();
      const statusB = rowB.original.getStatus();
      return statusA.localeCompare(statusB);
    },
  },

  // ============================================
  // 📦 Containers 컬럼 (리사이징 가능) - 스토리북 스타일
  // ============================================
  {
    accessorKey: "containers",
    id: "containers",
    header: "Containers",
    cell: ({ row }) => {
      const pod = row.original;
      return (
        <div className="px-3">
          <ContainersCell pod={pod} />
        </div>
      );
    },
    size: 154,
    minSize: 150,
    maxSize: 500,
    enableSorting: false,
    enableResizing: true,
  },

  // ============================================
  // 💻 CPU 컬럼 (정렬 가능, 리사이징 가능) - 스토리북 스타일
  // ============================================
  {
    accessorKey: "cpu",
    id: "cpu",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        CPU
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const pod = row.original;
      const metrics = pod.metrics;

      // N/A 표시 (메트릭 없거나 NaN일 때)
      if (!metrics || Number.isNaN(metrics.cpu)) {
        return <div className="px-3">N/A</div>;
      }

      const cpuUsage = Number(metrics.cpu);
      return <div className="px-3">{cpuUsage.toFixed(3)}m</div>;
    },
    size: 100,
    minSize: 80,
    maxSize: 200,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const cpuA = Number(rowA.original.metrics?.cpu || 0);
      const cpuB = Number(rowB.original.metrics?.cpu || 0);
      return cpuA - cpuB;
    },
  },

  // ============================================
  // 💾 Memory 컬럼 (정렬 가능, 리사이징 가능) - 스토리북 스타일
  // ============================================
  {
    accessorKey: "memory",
    id: "memory",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Memory
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const pod = row.original;
      const metrics = pod.metrics;

      // N/A 표시 (메트릭 없거나 NaN일 때)
      if (!metrics || Number.isNaN(metrics.memory)) {
        return <div className="px-3">N/A</div>;
      }

      const memoryBytes = Number(metrics.memory);
      return <div className="px-3">{bytesToUnits(memoryBytes, { precision: 3 })}</div>;
    },
    size: 100,
    minSize: 80,
    maxSize: 200,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const memA = Number(rowA.original.metrics?.memory || 0);
      const memB = Number(rowB.original.metrics?.memory || 0);
      return memA - memB;
    },
  },

  // ============================================
  // 🔄 Restarts 컬럼 (정렬 가능, 리사이징 가능) - 스토리북 스타일
  // ============================================
  {
    accessorKey: "restarts",
    id: "restarts",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Restarts
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const pod = row.original;
      const containerStatuses = pod.status?.containerStatuses || [];
      const totalRestarts = containerStatuses.reduce((sum, status) => sum + (status.restartCount || 0), 0);
      return <div className="px-3">{totalRestarts}</div>;
    },
    size: 100,
    minSize: 80,
    maxSize: 200,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const getRestarts = (pod: Pod) => {
        const statuses = pod.status?.containerStatuses || [];
        return statuses.reduce((sum, status) => sum + (status.restartCount || 0), 0);
      };
      return getRestarts(rowA.original) - getRestarts(rowB.original);
    },
  },

  // ============================================
  // 👥 Controlled By 컬럼 (정렬 가능, 리사이징 가능) - 스토리북 스타일
  // ============================================
  {
    accessorKey: "controlledBy",
    id: "controlledBy",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Controlled By
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const pod = row.original;
      const owners = pod.getOwnerRefs();

      if (!owners || owners.length === 0) {
        return <div className="text-muted-foreground px-3">-</div>;
      }

      return (
        <div className="flex flex-wrap gap-1 px-3">
          {owners.map((owner, index) => (
            <span key={index} className="text-sm">
              {owner.kind}/{owner.name}
            </span>
          ))}
        </div>
      );
    },
    size: 200,
    minSize: 120,
    maxSize: 350,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const ownersA = rowA.original.getOwnerRefs();
      const ownersB = rowB.original.getOwnerRefs();
      const strA = ownersA.map((o) => `${o.kind}/${o.name}`).join(",");
      const strB = ownersB.map((o) => `${o.kind}/${o.name}`).join(",");
      return strA.localeCompare(strB);
    },
  },

  // ============================================
  // ⏱️ Age 컬럼 (정렬 가능, 리사이징 가능) - 스토리북 스타일
  // ============================================
  {
    accessorKey: "age",
    id: "age",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Age
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => {
      const pod = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={pod} />
        </div>
      );
    },
    size: 100,
    minSize: 80,
    maxSize: 200,
    enableSorting: true,
    enableResizing: true,
    sortingFn: (rowA, rowB) => {
      const ageA = rowA.original.getTimeDiffFromNow();
      const ageB = rowB.original.getTimeDiffFromNow();
      return ageA - ageB; // 오래된 것부터 (오름차순)
    },
  },
];
