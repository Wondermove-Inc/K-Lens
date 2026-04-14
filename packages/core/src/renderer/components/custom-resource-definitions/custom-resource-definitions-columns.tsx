/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CustomResourceDefinition 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 CustomResourceDefinition 전용 컬럼 정의
 * - 정렬 가능한 컬럼: Resource, Group, Version, Short Names, Scope, Age
 * - shadcn 디자인 토큰 사용으로 테마 전환 자동 대응
 *
 * 🔄 변경이력:
 * - 2025-11-05: 초기 생성 (RoleBindings 패턴 기반)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { stopPropagation } from "@skuberplus/utilities";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shadcn-ui/tooltip";
import { KubeObjectAge } from "../kube-object/age";

import type { CustomResourceDefinition } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: CustomResourceDefinition 테이블 컬럼 정의 배열
 *
 * @remarks
 * 7개 컬럼: Checkbox, Resource, Group, Version, Short Names, Scope, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 * - Resource 컬럼은 Link로 상세 페이지 이동
 */
export const customResourceDefinitionColumns: ColumnDef<CustomResourceDefinition>[] = [
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
  // 📦 Resource 컬럼 (Link, 정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "kind",
    id: "kind",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Resource
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const crd = row.original;

      return (
        <div className="px-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to={crd.getResourceUrl()}
                  onClick={stopPropagation}
                  className="font-medium text-primary hover:underline cursor-pointer"
                >
                  {crd.getResourceKind()}
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">{crd.getResourceKind()}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getResourceKind().localeCompare(rowB.original.getResourceKind());
    },
  },

  // ============================================
  // 📁 Group 컬럼 (정렬 가능, 리사이징 가능, 툴팁)
  // ============================================
  {
    accessorKey: "group",
    id: "group",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Group
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const crd = row.original;
      const group = crd.getGroup();

      return (
        <div className="px-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-sm">{group}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">{group}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    size: 180,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getGroup().localeCompare(rowB.original.getGroup());
    },
  },

  // ============================================
  // 🔢 Version 컬럼 (정렬 가능, 리사이징 가능, 툴팁)
  // ============================================
  {
    accessorKey: "version",
    id: "version",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Version
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const crd = row.original;
      const version = crd.getVersion();

      return (
        <div className="px-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-sm">{version}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">{version}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getVersion().localeCompare(rowB.original.getVersion());
    },
  },

  // ============================================
  // 🏷️ Short Names 컬럼 (정렬 가능, 리사이징 가능, 툴팁)
  // ============================================
  {
    accessorKey: "shortNames",
    id: "shortNames",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Short Names
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const crd = row.original;
      const shortNames = crd.getNames().shortNames?.join(", ");

      if (!shortNames) {
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
                <span className="cursor-help text-sm">{shortNames}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">{shortNames}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const shortNamesA = rowA.original.getNames().shortNames?.join(" ") || "";
      const shortNamesB = rowB.original.getNames().shortNames?.join(" ") || "";
      return shortNamesA.localeCompare(shortNamesB);
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
      const crd = row.original;
      return (
        <div className="px-3">
          <span className="text-sm">{crd.getScope()}</span>
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getScope().localeCompare(rowB.original.getScope());
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
      const crd = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={crd} />
        </div>
      );
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      // Age는 생성 시간 기준 (최신 것이 더 작은 값, 역순 정렬)
      return rowB.original.getCreationTimestamp() - rowA.original.getCreationTimestamp();
    },
  },
];
