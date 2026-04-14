/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CustomResource 테이블의 동적 TanStack Table 컬럼 정의 생성
 *
 * @remarks
 * - CRD마다 컬럼이 다르므로 상수가 아닌 함수로 컬럼 생성
 * - 기본 컬럼: Checkbox, Name, Namespace(조건부), Age
 * - 동적 컬럼: CRD의 getPrinterColumns() 기반
 * - shadcn 디자인 토큰 사용으로 테마 전환 자동 대응
 *
 * 🔄 변경이력:
 * - 2025-12-17: 초기 생성 (CustomResourceDefinitions 패턴 기반)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { formatJSONValue, safeJSONPathValue } from "@skuberplus/utilities";
import { startCase } from "lodash/fp";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shadcn-ui/tooltip";
import { KubeObjectAge } from "../kube-object/age";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { AdditionalPrinterColumnsV1, CustomResourceDefinition, KubeObject } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: CustomResource 테이블의 동적 컬럼 정의 생성
 *
 * @param crd - CustomResourceDefinition 객체
 * @returns ColumnDef<KubeObject>[] - TanStack Table 컬럼 정의 배열
 *
 * 📝 주의사항:
 * - CRD마다 컬럼이 다르므로 상수가 아닌 함수로 생성
 * - getPrinterColumns(false)로 priority > 0인 컬럼 제외 (상세 페이지용)
 * - isNamespaced()로 Namespace 컬럼 조건부 추가
 */
export function createCustomResourceColumns(crd: CustomResourceDefinition): ColumnDef<KubeObject>[] {
  const isNamespaced = crd.isNamespaced();
  const extraColumns = crd.getPrinterColumns(false); // priority > 0인 컬럼 제외

  const columns: ColumnDef<KubeObject>[] = [];

  // ============================================
  // 🔲 Checkbox 컬럼 (행 선택)
  // ============================================
  columns.push({
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
  });

  // ============================================
  // 📛 Name 컬럼 (항상 표시, 정렬 가능)
  // ============================================
  columns.push({
    accessorKey: "name",
    id: "name",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const resource = row.original;
      return (
        <div className="px-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium cursor-help">{resource.getName()}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">{resource.getName()}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getName().localeCompare(rowB.original.getName());
    },
  });

  // ============================================
  // 📁 Namespace 컬럼 (조건부 - namespaced CRD만)
  // ============================================
  if (isNamespaced) {
    columns.push({
      accessorKey: "namespace",
      id: "namespace",
      header: ({ column }) => (
        <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Namespace
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const resource = row.original;
        return (
          <div className="px-3">
            <NamespaceSelectBadge namespace={resource.getNs() as string} />
          </div>
        );
      },
      size: 150,
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        return (rowA.original.getNs() || "").localeCompare(rowB.original.getNs() || "");
      },
    });
  }

  // ============================================
  // 🔀 동적 추가 컬럼 (CRD의 printerColumns 기반)
  // ============================================
  for (const column of extraColumns) {
    columns.push(createDynamicColumn(column));
  }

  // ============================================
  // ⏱️ Age 컬럼 (항상 표시, 정렬 가능)
  // ============================================
  columns.push({
    accessorKey: "age",
    id: "age",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Age
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const resource = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={resource} />
        </div>
      );
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      // Age는 생성 시간 기준 (최신 것이 더 작은 값, 역순 정렬)
      return rowB.original.getCreationTimestamp() - rowA.original.getCreationTimestamp();
    },
  });

  return columns;
}

/**
 * 🎯 목적: 단일 동적 컬럼 생성 (printerColumn 기반)
 *
 * @param column - AdditionalPrinterColumnsV1 객체
 * @returns ColumnDef<KubeObject>
 *
 * 📝 주의사항:
 * - jsonPath로 리소스에서 값 추출
 * - type에 따라 정렬 로직 다르게 적용 (number, date, string)
 */
function createDynamicColumn(column: AdditionalPrinterColumnsV1): ColumnDef<KubeObject> {
  const { name, jsonPath, type } = column;
  const columnId = name.toLowerCase().replace(/\s+/g, "-");

  return {
    accessorKey: columnId,
    id: columnId,
    header: ({ column: col }) => (
      <Button data-slot="button" variant="ghost" onClick={() => col.toggleSorting(col.getIsSorted() === "asc")}>
        {startCase(name)}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const resource = row.original;
      const value = formatJSONValue(safeJSONPathValue(resource, jsonPath));

      return (
        <div className="px-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-sm">{value || "-"}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">{value || "-"}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const valueA = formatJSONValue(safeJSONPathValue(rowA.original, jsonPath));
      const valueB = formatJSONValue(safeJSONPathValue(rowB.original, jsonPath));

      // 🎯 타입에 따른 정렬 로직
      if (type === "integer" || type === "number") {
        return Number(valueA || 0) - Number(valueB || 0);
      }
      if (type === "date") {
        return new Date(valueA || 0).getTime() - new Date(valueB || 0).getTime();
      }
      // 기본: 문자열 정렬
      return String(valueA || "").localeCompare(String(valueB || ""));
    },
  };
}
