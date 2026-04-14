/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Endpoint 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Endpoint 전용 컬럼 정의
 * - 정렬 가능한 컬럼: Name, Namespace, Age
 * - Endpoints는 toString() 메서드로 복잡한 포맷팅
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { Endpoints } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Endpoint 테이블 컬럼 정의 배열
 *
 * @remarks
 * 5개 컬럼: Checkbox, Name, Namespace, Endpoints, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 * - Endpoints는 toString() 사용하여 복잡한 포맷팅
 */
export const endpointColumns: ColumnDef<Endpoints>[] = [
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
      const endpoint = row.original;
      return <div className="px-3 font-medium">{endpoint.getName()}</div>;
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
      const endpoint = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={endpoint.getNs()} />
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
  // 📍 Endpoints 컬럼 (toString() 복잡한 포맷팅)
  // ============================================
  {
    accessorKey: "endpoints",
    id: "endpoints",
    header: () => <div className="px-3">Endpoints</div>,
    cell: ({ row }) => {
      const endpoint = row.original;
      const endpointsStr = endpoint.toString();

      // 줄바꿈으로 구분된 엔드포인트들을 표시
      const lines = endpointsStr.split("\n").filter((line) => line.trim());

      return (
        <div className="px-3 space-y-1">
          {lines.map((line, index) => (
            <div key={index} className="text-sm">
              {line}
            </div>
          ))}
        </div>
      );
    },
    size: 300,
    enableSorting: false,
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
      const endpoint = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={endpoint} />
        </div>
      );
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      // Age는 생성 시간 기준 (최신 것이 더 작은 값)
      return rowB.original.getCreationTimestamp() - rowA.original.getCreationTimestamp();
    },
  },
];
