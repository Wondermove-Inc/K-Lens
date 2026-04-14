/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Helm Release 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Helm Release 전용 컬럼 정의
 * - 기존 Cell 컴포넌트 재사용 (NamespaceSelectBadge, WithTooltip)
 * - 정렬 가능한 컬럼: Name, Namespace, Chart, Revision, Status, Updated
 * - 체크박스 선택 기능 포함
 *
 * 🔄 변경이력:
 * - 2025-10-31: 초기 생성 (Pod 패턴 적용, 9개 컬럼)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { kebabCase } from "lodash/fp";
import { ArrowUpDown } from "lucide-react";
import moment from "moment-timezone";
import React from "react";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";
import { WithTooltip } from "../with-tooltip";

import type { ColumnDef } from "@tanstack/react-table";

import type { RemovableHelmRelease } from "./removable-releases";

/**
 * 🎯 목적: Helm Release 테이블 컬럼 정의 배열
 *
 * @remarks
 * 9개 컬럼: Checkbox, Name, Namespace, Chart, Revision, Version, App Version, Status, Updated
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 */
export const releaseColumns: ColumnDef<RemovableHelmRelease>[] = [
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
    cell: ({ row }) => (
      <div className="px-3">
        <WithTooltip>{row.original.getName()}</WithTooltip>
      </div>
    ),
    accessorFn: (release) => release.getName(),
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
    cell: ({ row }) => (
      <div className="px-3">
        <NamespaceSelectBadge namespace={row.original.getNs()} />
      </div>
    ),
    accessorFn: (release) => release.getNs(),
    size: 150,
    enableSorting: true,
    enableResizing: true,
  },

  // ============================================
  // 📦 Chart 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "chart",
    id: "chart",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Chart
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="px-3">
        <WithTooltip>{row.original.getChart()}</WithTooltip>
      </div>
    ),
    accessorFn: (release) => release.getChart(),
    size: 180,
    enableSorting: true,
    enableResizing: true,
  },

  // ============================================
  // 🔢 Revision 컬럼 (정렬 가능)
  // ============================================
  {
    accessorKey: "revision",
    id: "revision",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Revision
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="px-3">
        <WithTooltip>{row.original.getRevision()}</WithTooltip>
      </div>
    ),
    accessorFn: (release) => release.getRevision(),
    size: 100,
    enableSorting: true,
    enableResizing: true,
  },

  // ============================================
  // 🏷️ Version 컬럼
  // ============================================
  {
    accessorKey: "version",
    id: "version",
    header: () => <div className="px-3">Version</div>,
    cell: ({ row }) => (
      <div className="px-3">
        <WithTooltip>{row.original.getVersion()}</WithTooltip>
      </div>
    ),
    accessorFn: (release) => release.getVersion(),
    size: 120,
    enableSorting: false,
    enableResizing: true,
  },

  // ============================================
  // 📱 App Version 컬럼
  // ============================================
  {
    accessorKey: "appVersion",
    id: "appVersion",
    header: () => <div className="px-3">App Version</div>,
    cell: ({ row }) => (
      <div className="px-3">
        <WithTooltip>{row.original.appVersion || "-"}</WithTooltip>
      </div>
    ),
    accessorFn: (release) => release.appVersion || "",
    size: 130,
    enableSorting: false,
    enableResizing: true,
  },

  // ============================================
  // ✅ Status 컬럼 (정렬 가능, kebabCase 클래스명)
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
      return (
        <div className="px-3">
          <span className={kebabCase(status)}>{status}</span>
        </div>
      );
    },
    accessorFn: (release) => release.getStatus(),
    size: 120,
    enableSorting: true,
    enableResizing: true,
  },

  // ============================================
  // 🕒 Updated 컬럼 (정렬 가능, moment 포맷 + tooltip)
  // ============================================
  {
    accessorKey: "updated",
    id: "updated",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Updated
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const updated = row.original.updated;
      const tooltip = updated ? moment(updated.replace(/\s\w*$/, "")).toDate() : undefined;
      return (
        <div className="px-3">
          <WithTooltip tooltip={tooltip}>{row.original.getUpdated()}</WithTooltip>
        </div>
      );
    },
    accessorFn: (release) => release.getUpdated(false, false),
    size: 150,
    enableSorting: true,
    enableResizing: true,
  },
];
