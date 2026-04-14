/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Helm Charts 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Helm Chart 전용 컬럼 정의
 * - CronJobs/Events 컬럼 패턴 참조
 * - 정렬 가능한 컬럼: Name, Repository
 * - 7개 컬럼: Checkbox, Icon, Name, Description, Version, App Version, Repository
 *
 * 📝 주의사항:
 * - HelmChart는 KubeObject가 아닌 ItemObject 타입
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 *
 * 🔄 변경이력:
 * - 2025-11-07: 초기 생성 (CronJobs/Events 패턴 기반, Helm Charts 적용)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { WithTooltip } from "../with-tooltip";
import { HelmChartIcon } from "./icon";

import type { ColumnDef } from "@tanstack/react-table";

import type { HelmChart } from "../../../common/k8s-api/endpoints/helm-charts.api";

/**
 * 🎯 목적: Helm Charts 테이블 컬럼 정의 배열
 *
 * @remarks
 * 7개 컬럼: Checkbox, Icon, Name, Description, Version, App Version, Repository
 *
 * 📝 주의사항:
 * - Icon 컬럼: HelmChartIcon 컴포넌트 사용
 * - Name, Repository 컬럼만 정렬 가능
 * - Description 컬럼은 긴 텍스트를 WithTooltip으로 처리
 */
export const helmChartsColumns: ColumnDef<HelmChart>[] = [
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
  // 🖼️ Icon 컬럼 (차트 아이콘, 고정 너비)
  // ============================================
  {
    id: "icon",
    header: () => <div className="text-center">Charts</div>,
    cell: ({ row }) => {
      const chart = row.original;
      return (
        <figure className="flex items-center justify-center">
          <HelmChartIcon imageUrl={chart.getIcon()} className="h-9 w-9" />
        </figure>
      );
    },
    size: 48,
    minSize: 48,
    maxSize: 48,
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
      const chart = row.original;
      return (
        <div className="px-3">
          <WithTooltip tooltip={chart.getName()}>
            <div className="font-medium">{chart.getName()}</div>
          </WithTooltip>
        </div>
      );
    },
    size: 200,
    minSize: 150,
    maxSize: 300,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getName().localeCompare(rowB.original.getName());
    },
  },

  // ============================================
  // 📄 Description 컬럼 (리사이징 가능)
  // ============================================
  {
    accessorKey: "description",
    id: "description",
    header: () => <div className="px-3">Description</div>,
    cell: ({ row }) => {
      const chart = row.original;
      const description = chart.getDescription();

      return (
        <div className="px-3">
          <WithTooltip tooltip={description}>
            <div className="text-sm truncate">{description}</div>
          </WithTooltip>
        </div>
      );
    },
    size: 450,
    minSize: 250,
    maxSize: 700,
    enableSorting: false,
  },

  // ============================================
  // 🔢 Version 컬럼 (리사이징 가능)
  // ============================================
  {
    accessorKey: "version",
    id: "version",
    header: () => <div className="px-3">Version</div>,
    cell: ({ row }) => {
      const chart = row.original;
      return (
        <div className="px-3">
          <WithTooltip tooltip={chart.getVersion()}>
            <div className="text-sm">{chart.getVersion()}</div>
          </WithTooltip>
        </div>
      );
    },
    size: 80,
    minSize: 60,
    maxSize: 100,
    enableSorting: false,
  },

  // ============================================
  // 📱 App Version 컬럼 (리사이징 가능)
  // ============================================
  {
    accessorKey: "appVersion",
    id: "appVersion",
    header: () => <div className="px-3">App Version</div>,
    cell: ({ row }) => {
      const chart = row.original;
      return (
        <div className="px-3">
          <WithTooltip tooltip={chart.getAppVersion()}>
            <div className="text-sm">{chart.getAppVersion()}</div>
          </WithTooltip>
        </div>
      );
    },
    size: 90,
    minSize: 70,
    maxSize: 110,
    enableSorting: false,
  },

  // ============================================
  // 📦 Repository 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "repository",
    id: "repository",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Repository
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const chart = row.original;
      const repository = chart.getRepository();

      return (
        <div className="px-3">
          <WithTooltip tooltip={repository}>
            <div className={`text-sm ${repository.toLowerCase()}`}>{repository}</div>
          </WithTooltip>
        </div>
      );
    },
    size: 200,
    minSize: 150,
    maxSize: 300,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getRepository().localeCompare(rowB.original.getRepository());
    },
  },
];
