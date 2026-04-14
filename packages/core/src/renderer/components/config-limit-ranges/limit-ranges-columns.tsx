/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: LimitRange 테이블 컬럼 정의
 *
 * 컬럼 구성:
 * - Name: LimitRange 이름
 * - Namespace: 네임스페이스
 * - Age: 생성 시간
 *
 * 📝 주의사항:
 * - ColumnDef<LimitRange>[] 타입 사용
 * - accessorFn으로 LimitRange 객체 메서드 호출
 * - 모든 컬럼 항상 표시 (컬럼 수 적음)
 *
 * 🔄 변경이력:
 * - 2025-10-30: shadcn UI 마이그레이션 (CommonTable 패턴)
 */

import { Checkbox } from "@skuberplus/storybook-shadcn";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { LimitRange } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Age 포맷팅 헬퍼 함수
 *
 * @param creationTimestamp - 생성 시간 (ISO 문자열 또는 Date)
 * @returns 사람이 읽기 쉬운 형식 (예: "2d", "5h", "30m")
 */
function formatAge(creationTimestamp: string | Date | undefined): string {
  if (!creationTimestamp) return "Unknown";

  const created = typeof creationTimestamp === "string" ? new Date(creationTimestamp) : creationTimestamp;
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMinutes > 0) return `${diffMinutes}m`;
  return `${diffSeconds}s`;
}

/**
 * 🎯 목적: LimitRange 테이블 컬럼 정의
 */
export const limitRangeColumns: ColumnDef<LimitRange>[] = [
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
  // 📝 Name 컬럼 (정렬 가능)
  // ============================================
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (limitRange) => limitRange.getName(),
    cell: ({ row }) => {
      const name = row.original.getName();
      return (
        <div className="px-3 font-medium text-foreground hover:text-primary transition-colors cursor-pointer">
          {name}
        </div>
      );
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getName().localeCompare(rowB.original.getName());
    },
    size: 300,
  },
  // ============================================
  // 📝 Namespace 컬럼 (정렬 가능)
  // ============================================
  {
    accessorKey: "namespace",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Namespace
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (limitRange) => limitRange.getNs(),
    cell: ({ row }) => {
      const limitRange = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={limitRange.getNs()} />
        </div>
      );
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getNs().localeCompare(rowB.original.getNs());
    },
    size: 200,
  },
  // ============================================
  // 📝 Age 컬럼 (정렬 가능)
  // ============================================
  {
    accessorKey: "age",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Age
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (limitRange) => limitRange.metadata.creationTimestamp,
    cell: ({ row }) => {
      const age = formatAge(row.original.metadata.creationTimestamp);
      return <div className="px-3 text-muted-foreground">{age}</div>;
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const timeA = new Date(rowA.original.metadata.creationTimestamp || 0).getTime();
      const timeB = new Date(rowB.original.metadata.creationTimestamp || 0).getTime();
      return timeA - timeB;
    },
    size: 150,
  },
];
