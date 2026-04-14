/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Events 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Event 전용 컬럼 정의
 * - 정렬 가능한 컬럼: Type, Namespace, Involved Object, Count, Age, Last Seen
 * - 9개 컬럼: Checkbox, Type, Message, Namespace, Involved Object, Source, Count, Age, Last Seen
 *
 * 🔄 변경이력:
 * - 2025-11-03: 초기 생성 (KubeDataTable 마이그레이션)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { cssNames } from "@skuberplus/utilities";
import { ArrowUpDown } from "lucide-react";
import moment from "moment-timezone";
import React from "react";
import { ReactiveDuration } from "../duration/reactive-duration";
import { KubeObjectAge } from "../kube-object/age";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";
import { WithTooltip } from "../with-tooltip";

import type { KubeEvent } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Events 테이블 컬럼 정의 배열
 *
 * @remarks
 * 9개 컬럼: Checkbox, Type, Message, Namespace, Involved Object, Source, Count, Age, Last Seen
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - minSize: 최소 너비 (리사이징 제한)
 * - maxSize: 최대 너비 (리사이징 제한)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const eventColumns: ColumnDef<KubeEvent>[] = [
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
  // 📌 Type 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "type",
    id: "type",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Type
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const event = row.original;
      return (
        <div className="px-3">
          <WithTooltip>{event.type}</WithTooltip>
        </div>
      );
    },
    size: 100,
    minSize: 80,
    maxSize: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const typeA = rowA.original.type ?? "";
      const typeB = rowB.original.type ?? "";
      return typeA.localeCompare(typeB);
    },
  },

  // ============================================
  // 💬 Message 컬럼 (리사이징 가능)
  // ============================================
  {
    accessorKey: "message",
    id: "message",
    header: () => <div className="px-3">Message</div>,
    cell: ({ row }) => {
      const event = row.original;
      const isWarning = event.isWarning();

      return (
        <div className={cssNames("px-3", { "text-status-error": isWarning })}>
          <WithTooltip>{event.message}</WithTooltip>
        </div>
      );
    },
    size: 300,
    minSize: 150,
    maxSize: 600,
    enableSorting: false,
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
      const event = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge key="namespace" namespace={event.getNs()} />
        </div>
      );
    },
    size: 150,
    minSize: 100,
    maxSize: 250,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getNs().localeCompare(rowB.original.getNs());
    },
  },

  // ============================================
  // 🎯 Involved Object 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "object",
    id: "object",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Involved Object
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const event = row.original;
      const { involvedObject } = event;

      return (
        <div className="px-3">
          <WithTooltip>{`${involvedObject.kind}: ${involvedObject.name}`}</WithTooltip>
        </div>
      );
    },
    size: 200,
    minSize: 150,
    maxSize: 350,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const nameA = rowA.original.involvedObject.name;
      const nameB = rowB.original.involvedObject.name;
      return nameA.localeCompare(nameB);
    },
  },

  // ============================================
  // 📡 Source 컬럼 (리사이징 가능)
  // ============================================
  {
    accessorKey: "source",
    id: "source",
    header: () => <div className="px-3">Source</div>,
    cell: ({ row }) => {
      const event = row.original;
      return (
        <div className="px-3">
          <WithTooltip>{event.getSource()}</WithTooltip>
        </div>
      );
    },
    size: 150,
    minSize: 100,
    maxSize: 250,
    enableSorting: false,
  },

  // ============================================
  // 🔢 Count 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "count",
    id: "count",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Count
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const event = row.original;
      return <div className="px-3">{event.count}</div>;
    },
    size: 80,
    minSize: 60,
    maxSize: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const countA = rowA.original.count ?? 0;
      const countB = rowB.original.count ?? 0;
      return countA - countB;
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
      const event = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge key="age" object={event} />
        </div>
      );
    },
    size: 100,
    minSize: 80,
    maxSize: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const ageA = rowA.original.getTimeDiffFromNow();
      const ageB = rowB.original.getTimeDiffFromNow();
      return ageA - ageB; // 오래된 것부터 (오름차순)
    },
  },

  // ============================================
  // 🕒 Last Seen 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "lastSeen",
    id: "lastSeen",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Last Seen
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const event = row.original;
      return (
        <div className="px-3">
          <WithTooltip tooltip={event.lastTimestamp ? moment(event.lastTimestamp).toDate() : undefined}>
            <ReactiveDuration key="last-seen" timestamp={event.lastTimestamp} />
          </WithTooltip>
        </div>
      );
    },
    size: 120,
    minSize: 80,
    maxSize: 180,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const timeA = rowA.original.lastTimestamp ? new Date(rowA.original.lastTimestamp).getTime() : 0;
      const timeB = rowB.original.lastTimestamp ? new Date(rowB.original.lastTimestamp).getTime() : 0;
      return timeB - timeA; // 최근 것부터 (내림차순)
    },
  },
];
