/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterRoleBinding 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 ClusterRoleBinding 전용 컬럼 정의
 * - 정렬 가능한 컬럼: Name, Cluster Role, Types, Bindings, Age
 * - shadcn 디자인 토큰 사용으로 테마 전환 자동 대응
 *
 * 🔄 변경이력:
 * - 2025-11-05: 초기 생성 (RoleBindings 패턴 기반)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shadcn-ui/tooltip";
import { KubeObjectAge } from "../../kube-object/age";
import { LinkToClusterRole } from "../../kube-object-link";
import { KubeObjectStatusIcon } from "../../kube-object-status-icon";

import type { ClusterRoleBinding } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: ClusterRoleBinding 테이블 컬럼 정의 배열
 *
 * @remarks
 * 7개 컬럼: Checkbox, Name, Status Icon, Cluster Role, Types, Bindings, Age
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 * - Tooltip은 긴 텍스트에만 적용 (Types, Bindings)
 * - ClusterRoleBinding은 cluster-scoped 리소스이므로 Namespace 컬럼 없음
 */
export const clusterRoleBindingColumns: ColumnDef<ClusterRoleBinding>[] = [
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
      const clusterRoleBinding = row.original;

      return (
        <div className="px-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium cursor-help">{clusterRoleBinding.getName()}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">{clusterRoleBinding.getName()}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
  // ⚠️ Status Icon 컬럼 (상태 아이콘, 24px 고정)
  // ============================================
  {
    id: "status-icon",
    header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
    cell: ({ row }) => {
      const clusterRoleBinding = row.original;
      return <KubeObjectStatusIcon object={clusterRoleBinding} />;
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
  },

  // ============================================
  // 🔑 Cluster Role 컬럼 (LinkToClusterRole 컴포넌트 사용, 정렬 가능)
  // ============================================
  {
    accessorKey: "clusterRole",
    id: "clusterRole",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Cluster Role
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const clusterRoleBinding = row.original;
      return (
        <div className="px-3">
          <LinkToClusterRole name={clusterRoleBinding.roleRef.name} />
        </div>
      );
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.roleRef.name.localeCompare(rowB.original.roleRef.name);
    },
  },

  // ============================================
  // 👥 Types 컬럼 (Subject Types, 정렬 가능, 툴팁)
  // ============================================
  {
    accessorKey: "types",
    id: "types",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Types
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const clusterRoleBinding = row.original;
      const types = clusterRoleBinding.getSubjectTypes();

      if (!types) {
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
                <span className="cursor-help text-sm">{types}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">{types}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const typesA = rowA.original.getSubjectTypes() || "";
      const typesB = rowB.original.getSubjectTypes() || "";
      return typesA.localeCompare(typesB);
    },
  },

  // ============================================
  // 🔗 Bindings 컬럼 (Subject Names, 정렬 가능, 툴팁)
  // ============================================
  {
    accessorKey: "bindings",
    id: "bindings",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Bindings
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const clusterRoleBinding = row.original;
      const bindings = clusterRoleBinding.getSubjectNames();

      if (!bindings) {
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
                <span className="cursor-help text-sm">{bindings}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs max-w-md">{bindings}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const bindingsA = rowA.original.getSubjectNames() || "";
      const bindingsB = rowB.original.getSubjectNames() || "";
      return bindingsA.localeCompare(bindingsB);
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
      const clusterRoleBinding = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={clusterRoleBinding} />
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
