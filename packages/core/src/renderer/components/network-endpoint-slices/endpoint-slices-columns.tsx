/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Endpoint Slice 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Endpoint Slice 전용 컬럼 정의
 * - 정렬 가능한 컬럼: Name, Namespace, Address Type, Ports, Endpoints, Age
 * - Ports와 Endpoints는 getPortsString(), getEndpointsString() 사용
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { EndpointSlice } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Endpoint Slice 테이블 컬럼 정의 배열
 *
 * @remarks
 * 6개 컬럼: Checkbox, Name, Namespace, Address Type, Ports, Endpoints, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const endpointSliceColumns: ColumnDef<EndpointSlice>[] = [
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
      const endpointSlice = row.original;
      return <div className="px-3 font-medium">{endpointSlice.getName()}</div>;
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
      const endpointSlice = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={endpointSlice.getNs()} />
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
  // 🌐 Address Type 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "addressType",
    id: "addressType",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Address Type
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const endpointSlice = row.original;
      return <div className="px-3">{endpointSlice.addressType}</div>;
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return (rowA.original.addressType ?? "").localeCompare(rowB.original.addressType ?? "");
    },
  },

  // ============================================
  // 🔌 Ports 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "ports",
    id: "ports",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Ports
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const endpointSlice = row.original;
      return <div className="px-3">{endpointSlice.getPortsString()}</div>;
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getPortsString().localeCompare(rowB.original.getPortsString());
    },
  },

  // ============================================
  // 📍 Endpoints 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "endpoints",
    id: "endpoints",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Endpoints
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const endpointSlice = row.original;
      return <div className="px-3">{endpointSlice.getEndpointsString()}</div>;
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getEndpointsString().localeCompare(rowB.original.getEndpointsString());
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
      const endpointSlice = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={endpointSlice} />
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
