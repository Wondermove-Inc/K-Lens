/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Port Forward 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Port Forward 전용 컬럼 정의
 * - 8개 컬럼: Name, Namespace, Kind, Pod Port, Local Port, Protocol, Address, Status
 * - 정렬 가능한 컬럼: Name, Namespace, Kind, Pod Port, Local Port, Protocol, Status
 * - PortForwardItem은 ItemObject 타입 (KubeObject 아님)
 *
 * 🔄 변경이력:
 * - 2025-10-31: 초기 생성 (shadcn UI 마이그레이션)
 */

import { Button } from "@skuberplus/storybook-shadcn";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { ColumnDef } from "@tanstack/react-table";

import type { PortForwardItem } from "../../port-forward";

/**
 * 🎯 목적: Port Forward 테이블 컬럼 정의 배열
 *
 * @remarks
 * 8개 컬럼: Name, Namespace, Kind, Pod Port, Local Port, Protocol, Address, Status
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const portForwardColumns: ColumnDef<PortForwardItem>[] = [
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
      const name = row.original.getName();
      return <div className="px-3 font-medium">{name}</div>;
    },
    size: 200,
    enableSorting: true,
    enableResizing: true,
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
      const portForward = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={portForward.getNs()} />
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    enableResizing: true,
  },

  // ============================================
  // 📦 Kind 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "kind",
    id: "kind",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Kind
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const kind = row.original.getKind();
      return <div className="px-3">{kind}</div>;
    },
    size: 120,
    enableSorting: true,
    enableResizing: true,
  },

  // ============================================
  // 🔌 Pod Port 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "port",
    id: "port",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Pod Port
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const port = row.original.getPort();
      return <div className="px-3">{port}</div>;
    },
    size: 100,
    enableSorting: true,
    enableResizing: true,
  },

  // ============================================
  // 🔌 Local Port 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "forwardPort",
    id: "forwardPort",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Local Port
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const forwardPort = row.original.getForwardPort();
      return <div className="px-3">{forwardPort}</div>;
    },
    size: 100,
    enableSorting: true,
    enableResizing: true,
  },

  // ============================================
  // 📡 Protocol 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "protocol",
    id: "protocol",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Protocol
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const protocol = row.original.getProtocol();
      return <div className="px-3">{protocol}</div>;
    },
    size: 100,
    enableSorting: true,
    enableResizing: true,
  },

  // ============================================
  // 🌐 Address 컬럼 (리사이징 가능)
  // ============================================
  {
    accessorKey: "address",
    id: "address",
    header: () => <div className="px-3">Address</div>,
    cell: ({ row }) => {
      const address = row.original.getAddress();
      return <div className="px-3">{address}</div>;
    },
    size: 150,
    enableSorting: false,
    enableResizing: true,
  },

  // ============================================
  // 🟢 Status 컬럼 (정렬 가능, 리사이징 가능)
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
      const status = row.original.getStatus();
      // 🎯 THEME-024: Semantic color for port forward status
      const colorClass = status === "Active" ? "text-status-success" : "text-muted-foreground";
      return <div className={`px-3 ${colorClass}`}>{status}</div>;
    },
    size: 100,
    enableSorting: true,
    enableResizing: true,
  },
];
