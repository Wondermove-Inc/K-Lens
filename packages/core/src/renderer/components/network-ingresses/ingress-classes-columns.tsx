/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Ingress Class 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Ingress Class 전용 컬럼 정의
 * - 정렬 가능한 컬럼: Name, Controller, API Group, Scope, Kind, Age
 * - Default Ingress Class 아이콘 표시 (별 아이콘)
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (TanStack Table 컬럼 정의)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { ArrowUpDown, Star } from "lucide-react";
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shadcn-ui/tooltip";
import { KubeObjectAge } from "../kube-object/age";

import type { IngressClass } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: Ingress Class 테이블 컬럼 정의 배열
 *
 * @remarks
 * 6개 컬럼: Checkbox, Name, Controller, API Group, Scope, Kind, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 * - Default Ingress Class는 별 아이콘으로 표시
 */
export const ingressClassColumns: ColumnDef<IngressClass>[] = [
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
  // 📝 Name 컬럼 (정렬 가능, 리사이징 가능, Default 아이콘 포함)
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
      const ingressClass = row.original;
      const isDefault = ingressClass.isDefault;

      return (
        <div className="px-3 flex items-center gap-2">
          <span className="font-medium">{ingressClass.getName()}</span>
          {isDefault && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* 🎯 THEME-024: Semantic color for default ingress class indicator */}
                  <Star className="h-4 w-4 text-status-warning fill-status-warning" />
                </TooltipTrigger>
                <TooltipContent>
                  <span className="text-xs">Is default class for ingresses (when not specified)</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      );
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return (rowA.original.getCtrlName() ?? "").localeCompare(rowB.original.getCtrlName() ?? "");
    },
  },

  // ============================================
  // 🔧 Controller 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "controller",
    id: "controller",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Controller
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const ingressClass = row.original;
      return <div className="px-3 text-sm">{ingressClass.getController()}</div>;
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getController().localeCompare(rowB.original.getController());
    },
  },

  // ============================================
  // 🏷️ API Group 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "apiGroup",
    id: "apiGroup",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        API Group
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const ingressClass = row.original;
      return <div className="px-3 text-sm">{ingressClass.getCtrlApiGroup()}</div>;
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return (rowA.original.getCtrlApiGroup() ?? "").localeCompare(rowB.original.getCtrlApiGroup() ?? "");
    },
  },

  // ============================================
  // 🌐 Scope 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "scope",
    id: "scope",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Scope
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const ingressClass = row.original;
      return (
        <div className="px-3">
          <Badge variant="outline" className="font-normal">
            {ingressClass.getCtrlScope()}
          </Badge>
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return (rowA.original.getCtrlScope() ?? "").localeCompare(rowB.original.getCtrlScope() ?? "");
    },
  },

  // ============================================
  // 🔖 Kind 컬럼 (정렬 가능, 리사이징 가능)
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
      const ingressClass = row.original;
      return <div className="px-3 text-sm">{ingressClass.getCtrlKind()}</div>;
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return (rowA.original.getCtrlKind() ?? "").localeCompare(rowB.original.getCtrlKind() ?? "");
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
      const ingressClass = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={ingressClass} />
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
