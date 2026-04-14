/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CronJob 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 CronJob 전용 컬럼 정의
 * - Deployment 컬럼 패턴을 따르되 CronJob 특성 반영
 * - 정렬 가능한 컬럼: Name, Namespace, Timezone, Suspend, Active, Last Schedule, Age
 * - Schedule은 cronstrue 휴먼라이징 표시
 * - Suspend 상태는 shadcn Badge로 표시
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (Deployment 컬럼 패턴 기반, CronJob 적용)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { ArrowUpDown } from "lucide-react";
import React from "react";
// Cell 컴포넌트 imports
import { KubeObjectAge } from "../kube-object/age";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";
import { WithTooltip } from "../with-tooltip";
import { humanizeSchedule } from "./utils";

import type { CronJob } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: CronJob 테이블 컬럼 정의 배열
 *
 * @remarks
 * 9개 컬럼: Checkbox, Name, Namespace, Schedule, Timezone, Suspend, Active, Last Schedule, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 * - Schedule은 cronstrue로 휴먼라이징 (Tooltip 표시)
 * - Suspend는 shadcn Badge로 표시 (Active=green, Suspended=red)
 */
export const cronJobColumns: ColumnDef<CronJob>[] = [
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
      const cronJob = row.original;
      return <div className="px-3 font-medium">{cronJob.getName()}</div>;
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
      const cronJob = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={cronJob.getNs()} />
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
  // 📅 Schedule 컬럼 (cronstrue 휴먼라이징, 정렬 가능)
  // ============================================
  {
    accessorKey: "schedule",
    id: "schedule",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Schedule
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const cronJob = row.original;
      const schedule = cronJob.getSchedule();
      const humanized = humanizeSchedule(schedule);
      const neverRan = cronJob.isNeverRun();

      return (
        <div className="px-3">
          <WithTooltip tooltip={`${humanized}${neverRan ? " (never ran)" : ""}`}>
            <span className="text-sm">{schedule}</span>
          </WithTooltip>
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getSchedule().localeCompare(rowB.original.getSchedule());
    },
  },

  // ============================================
  // 🌍 Timezone 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "timezone",
    id: "timezone",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Timezone
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const cronJob = row.original;
      const timezone = cronJob.spec.timeZone || "-";
      return (
        <div className="px-3">
          <WithTooltip tooltip={timezone === "-" ? "No timezone specified" : timezone}>
            <span className="text-sm">{timezone}</span>
          </WithTooltip>
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const tzA = rowA.original.spec.timeZone || "";
      const tzB = rowB.original.spec.timeZone || "";
      return tzA.localeCompare(tzB);
    },
  },

  // ============================================
  // ⏸️ Suspend 컬럼 (Badge, 정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "suspend",
    id: "suspend",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Suspend
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const cronJob = row.original;
      const suspended = cronJob.isSuspend();

      return (
        <div className="px-3">
          <Badge variant={suspended ? "destructive" : "default"} className="text-xs">
            {suspended ? "Suspended" : "Active"}
          </Badge>
        </div>
      );
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const suspendedA = rowA.original.isSuspend() ? 1 : 0;
      const suspendedB = rowB.original.isSuspend() ? 1 : 0;
      return suspendedA - suspendedB;
    },
  },

  // ============================================
  // 🏃 Active 컬럼 (실행 중인 Job 개수, 정렬 가능)
  // ============================================
  {
    accessorKey: "active",
    id: "active",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Active
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const cronJob = row.original;
      const activeJobs = cronJob.status?.active?.length || 0;
      return <div className="px-3 text-sm">{activeJobs}</div>;
    },
    size: 80,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const activeA = rowA.original.status?.active?.length || 0;
      const activeB = rowB.original.status?.active?.length || 0;
      return activeA - activeB;
    },
  },

  // ============================================
  // 📆 Last Schedule 컬럼 (마지막 실행 시간, 정렬 가능)
  // ============================================
  {
    accessorKey: "lastSchedule",
    id: "lastSchedule",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Last Schedule
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const cronJob = row.original;
      const lastScheduleTime = cronJob.status?.lastScheduleTime;

      if (!lastScheduleTime) {
        return <span className="px-3 text-muted-foreground">-</span>;
      }

      return (
        <div className="px-3">
          <WithTooltip tooltip={lastScheduleTime}>
            <span className="text-sm">{cronJob.getLastScheduleTime()}</span>
          </WithTooltip>
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const timeA = rowA.original.status?.lastScheduleTime || "";
      const timeB = rowB.original.status?.lastScheduleTime || "";
      return timeA.localeCompare(timeB);
    },
  },

  // ============================================
  // ⏱️ Age 컬럼 (정렬 가능, 리사이징 가능)
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
      const cronJob = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={cronJob} />
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
