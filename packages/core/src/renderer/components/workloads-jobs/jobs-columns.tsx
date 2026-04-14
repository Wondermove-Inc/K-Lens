/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Job 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Job 전용 컬럼 정의
 * - 기존 Cell 컴포넌트 재사용 (status-cell, namespace-cell, resumed-cell, duration-cell)
 * - 정렬 가능한 컬럼: Name, Namespace, Resumed, Status, Succeeded, Completions, Parallelism, Duration, Age
 * - 10개 컬럼: Checkbox, Name, Namespace, Status Icon, Resumed, Status, Succeeded, Completions, Parallelism, Duration, Age
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의, Pod 패턴 참조)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { DurationCell } from "./job-table-cells/duration-cell";
import { NamespaceCell } from "./job-table-cells/namespace-cell";
import { ResumedCell } from "./job-table-cells/resumed-cell";
// Cell 컴포넌트 imports
import { StatusCell } from "./job-table-cells/status-cell";
// Status 로직 재사용
import { getStatusText } from "./job-utils";

import type { Job } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Job 테이블 컬럼 정의 배열
 *
 * @remarks
 * 11개 컬럼: Checkbox, Name, Namespace, Status Icon, Resumed, Status, Succeeded, Completions, Parallelism, Duration, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const jobColumns: ColumnDef<Job>[] = [
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
      const job = row.original;
      return <div className="px-3 font-medium">{job.getName()}</div>;
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
      const job = row.original;
      return (
        <div className="px-3">
          <NamespaceCell job={job} />
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
  // ⚠️ Status Icon 컬럼 (상태 아이콘, 24px 고정)
  // ============================================
  {
    accessorKey: "statusIcon",
    id: "statusIcon",
    header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
    cell: ({ row }) => {
      const job = row.original;
      return (
        <div className="px-3">
          <KubeObjectStatusIcon object={job} />
        </div>
      );
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
  },

  // ============================================
  // ▶️ Resumed 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "resumed",
    id: "resumed",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Resumed
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const job = row.original;
      return (
        <div className="px-3">
          <ResumedCell job={job} />
        </div>
      );
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const resumedA = !rowA.original.spec.suspend;
      const resumedB = !rowB.original.spec.suspend;
      return Number(resumedA) - Number(resumedB);
    },
  },

  // ============================================
  // 🔄 Status 컬럼 (정렬 가능, 리사이징 가능)
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
      const job = row.original;
      return (
        <div className="px-3">
          <StatusCell job={job} />
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const statusA = getStatusText(rowA.original);
      const statusB = getStatusText(rowB.original);
      return statusA.localeCompare(statusB);
    },
  },

  // ============================================
  // ✅ Succeeded 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "succeeded",
    id: "succeeded",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Succeeded
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const job = row.original;
      return <div className="px-3">{job.getCompletions()}</div>;
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getCompletions() - rowB.original.getCompletions();
    },
  },

  // ============================================
  // 📊 Completions 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "completions",
    id: "completions",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Completions
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const job = row.original;
      return <div className="px-3">{job.getDesiredCompletions()}</div>;
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getDesiredCompletions() - rowB.original.getDesiredCompletions();
    },
  },

  // ============================================
  // 🔀 Parallelism 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "parallelism",
    id: "parallelism",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Parallelism
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const job = row.original;
      return <div className="px-3">{job.getParallelism()}</div>;
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const parallelismA = rowA.original.getParallelism() ?? 0;
      const parallelismB = rowB.original.getParallelism() ?? 0;
      return parallelismA - parallelismB;
    },
  },

  // ============================================
  // ⏱️ Duration 컬럼 (정렬 가능, 리사이징 가능, Tooltip)
  // ============================================
  {
    accessorKey: "duration",
    id: "duration",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Duration
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const job = row.original;
      return (
        <div className="px-3">
          <DurationCell job={job} />
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getJobDuration() - rowB.original.getJobDuration();
    },
  },

  // ============================================
  // 📅 Age 컬럼 (정렬 가능, 리사이징 가능)
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
      const job = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={job} />
        </div>
      );
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const ageA = rowA.original.getTimeDiffFromNow();
      const ageB = rowB.original.getTimeDiffFromNow();
      return ageA - ageB; // 오래된 것부터 (오름차순)
    },
  },
];
