/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Namespace 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Namespace 전용 컬럼 정의
 * - 정렬 가능한 컬럼: Name, Labels, Age, Status
 * - Subnamespace 배지 표시 (HNC 지원)
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shadcn-ui/tooltip";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { SubnamespaceBadge } from "./subnamespace-badge";

import type { Namespace } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Namespace 테이블 컬럼 정의 배열
 *
 * @remarks
 * 6개 컬럼: Checkbox, Name, Status Icon, Labels, Age, Status
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 * - Subnamespace 배지는 조건부 렌더링 (isSubnamespace() 체크)
 */
export const namespaceColumns: ColumnDef<Namespace>[] = [
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
  // 📝 Name 컬럼 (정렬 가능, 리사이징 가능, Subnamespace 배지 포함)
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
      const namespace = row.original;
      const isSubnamespace = namespace.isSubnamespace();

      return (
        <div className="px-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">{namespace.getName()}</span>
            {isSubnamespace && (
              <SubnamespaceBadge className="subnamespaceBadge" id={`namespace-list-badge-for-${namespace.getId()}`} />
            )}
          </div>
        </div>
      );
    },
    size: 250,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getName().localeCompare(rowB.original.getName());
    },
  },

  // ============================================
  // 🚦 Status Icon 컬럼 (상태 아이콘, 24px 고정)
  // ============================================
  {
    id: "status-icon",
    header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
    cell: ({ row }) => {
      const namespace = row.original;
      return <KubeObjectStatusIcon object={namespace} />;
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
  },

  // ============================================
  // 🏷️ Labels 컬럼 (다중 Badge, 스크롤 가능, 툴팁)
  // ============================================
  {
    accessorKey: "labels",
    id: "labels",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Labels
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const namespace = row.original;
      const labels = namespace.getLabels();

      if (labels.length === 0) {
        return (
          <div className="px-3">
            <span className="text-muted-foreground text-sm">-</span>
          </div>
        );
      }

      return (
        <div className="px-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-wrap gap-1 max-w-[300px] overflow-x-auto cursor-help">
                  {labels.map((label) => (
                    <Badge key={label} variant="outline" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs max-w-md">{labels.join(", ")}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    size: 300,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      // Labels 배열을 join하여 문자열로 정렬
      return rowA.original.getLabels().join(",").localeCompare(rowB.original.getLabels().join(","));
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
      const namespace = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={namespace} />
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
  // 📊 Status 컬럼 (정렬 가능, 리사이징 가능, Badge 표시)
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
      const namespace = row.original;
      const status = namespace.getStatus();

      // 🎯 상태별 Badge variant 설정
      const getStatusVariant = (status: string) => {
        switch (status) {
          case "Active":
            return "default";
          case "Terminating":
            return "destructive";
          case "Finalizing":
            return "secondary";
          default:
            return "outline";
        }
      };

      return (
        <div className="px-3">
          <Badge variant={getStatusVariant(status)} className="font-normal">
            {status}
          </Badge>
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getStatus().localeCompare(rowB.original.getStatus());
    },
  },
];
