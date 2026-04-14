/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Secret 테이블 컬럼 정의
 *
 * 컬럼 구성:
 * - Name: Secret 이름
 * - Namespace: 네임스페이스
 * - Keys: Secret에 포함된 키 목록 (배열 → 문자열 join)
 * - Type: Secret 타입 (Opaque, kubernetes.io/service-account-token 등)
 * - Age: 생성 시간
 *
 * 📝 주의사항:
 * - ColumnDef<Secret>[] 타입 사용
 * - accessorFn으로 Secret 객체 메서드 호출
 * - Keys는 배열을 ", "로 join하여 표시
 * - 모바일에서 Keys/Type 컬럼 숨김 (반응형)
 *
 * 🔄 변경이력:
 * - 2025-10-30: shadcn UI 마이그레이션 (CommonTable 패턴)
 */

import { Checkbox } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { Secret } from "@skuberplus/kube-object";

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
 * 🎯 목적: Secret 테이블 컬럼 정의
 */
export const secretColumns: ColumnDef<Secret>[] = [
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
    accessorFn: (secret) => secret.getName(),
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
    size: 200,
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
    accessorFn: (secret) => secret.getNs(),
    cell: ({ row }) => {
      const secret = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={secret.getNs()} />
        </div>
      );
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getNs().localeCompare(rowB.original.getNs());
    },
    size: 150,
  },
  {
    accessorKey: "keys",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Keys
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (secret) => secret.getKeys().join(", "),
    cell: ({ row }) => {
      const keys = row.original.getKeys();
      const keysText = keys.join(", ");
      return (
        <div className="px-3 text-sm text-muted-foreground truncate hidden sm:block" title={keysText}>
          {keysText || "-"}
        </div>
      );
    },
    size: 180,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const keysA = rowA.original.getKeys().join(", ");
      const keysB = rowB.original.getKeys().join(", ");
      return keysA.localeCompare(keysB);
    },
  },
  // ============================================
  // 📝 Type 컬럼 (정렬 가능)
  // ============================================
  {
    accessorKey: "type",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Type
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (secret) => secret.type,
    cell: ({ row }) => {
      const type = row.original.type;
      // Type을 짧은 형태로 변환 (예: kubernetes.io/service-account-token → service-account)
      const shortType = type?.replace("kubernetes.io/", "") || "Opaque";
      return (
        <div className="px-3">
          <Badge variant="secondary" className="text-xs font-mono hidden sm:inline-flex">
            {shortType}
          </Badge>
        </div>
      );
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const typeA = rowA.original.type || "";
      const typeB = rowB.original.type || "";
      return typeA.localeCompare(typeB);
    },
    size: 180,
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
    accessorFn: (secret) => secret.metadata.creationTimestamp,
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
    size: 120,
  },
];
