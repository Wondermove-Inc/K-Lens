/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Service 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Service 전용 컬럼 정의
 * - 정렬 가능한 컬럼: Name, Namespace, Type, Cluster IP, Ports, Age, Status
 * - External IP는 formatExternalIps() 함수로 복잡한 포맷팅
 * - Status Icon 표시 필요
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { Service } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: External IP 포맷팅 헬퍼 함수
 *
 * @param service - Service 객체
 * @returns 포맷팅된 External IP 문자열
 *
 * 📝 주의사항:
 * - getExternalIps()가 있으면 쉼표로 조인
 * - 없으면 spec.externalName 사용
 * - 둘 다 없으면 "-" 반환
 */
const formatExternalIps = (service: Service): string => {
  const externalIps = service.getExternalIps();

  if (externalIps.length > 0) {
    return externalIps.join(", ");
  }

  if (service.spec?.externalName) {
    return service.spec.externalName;
  }

  return "-";
};

/**
 * 🎯 목적: Service 테이블 컬럼 정의 배열
 *
 * @remarks
 * 9개 컬럼: Checkbox, Name, Status Icon, Namespace, Type, Cluster IP, External IP, Ports, Age, Status
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const serviceColumns: ColumnDef<Service>[] = [
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
      const service = row.original;
      return <div className="px-3 font-medium">{service.getName()}</div>;
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getName().localeCompare(rowB.original.getName());
    },
  },

  // ============================================
  // ⚠️ Status Icon 컬럼 (상태 아이콘, 24px 고정)
  // ============================================
  {
    id: "status-icon",
    header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
    cell: ({ row }) => {
      const service = row.original;
      return (
        <div className="px-3">
          <KubeObjectStatusIcon object={service} />
        </div>
      );
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
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
      const service = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={service.getNs()} />
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
  // 🔖 Type 컬럼 (정렬 가능, 리사이징 가능)
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
      const service = row.original;
      return <div className="px-3">{service.getType()}</div>;
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getType().localeCompare(rowB.original.getType());
    },
  },

  // ============================================
  // 🌐 Cluster IP 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "clusterIp",
    id: "clusterIp",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Cluster IP
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const service = row.original;
      return <div className="px-3">{service.getClusterIp()}</div>;
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getClusterIp().localeCompare(rowB.original.getClusterIp());
    },
  },

  // ============================================
  // 🌍 External IP 컬럼 (formatExternalIps 사용)
  // ============================================
  {
    accessorKey: "externalIp",
    id: "externalIp",
    header: () => <div className="px-3">External IP</div>,
    cell: ({ row }) => {
      const service = row.original;
      return <div className="px-3">{formatExternalIps(service)}</div>;
    },
    size: 150,
    enableSorting: false,
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
      const service = row.original;
      return <div className="px-3">{service.getPorts().join(", ")}</div>;
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const portsA = (rowA.original.spec.ports || []).map(({ port }) => port)[0] || 0;
      const portsB = (rowB.original.spec.ports || []).map(({ port }) => port)[0] || 0;
      return portsA - portsB;
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
      const service = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={service} />
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

  // ============================================
  // 📊 Status 컬럼 (정렬 가능, 리사이징 가능)
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
      const service = row.original;
      const status = service.getStatus();
      return (
        <div className="px-3">
          <Badge variant="outline">{status}</Badge>
        </div>
      );
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getStatus().localeCompare(rowB.original.getStatus());
    },
  },
];
