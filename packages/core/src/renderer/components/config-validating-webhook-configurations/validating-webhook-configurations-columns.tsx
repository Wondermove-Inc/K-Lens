/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Validating Webhook Configurations 테이블의 컬럼 정의 (TanStack Table 사용)
 *
 * 📊 컬럼 구성 (4개):
 * 1. Checkbox - 행 선택용
 * 2. Name - Validating Webhook Configuration 이름 (정렬 가능)
 * 3. Webhooks - 웹훅 개수
 * 4. Age - 생성된 지 얼마나 지났는지
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";

import type { ValidatingWebhookConfiguration } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

export const validatingWebhookConfigurationColumns: ColumnDef<ValidatingWebhookConfiguration>[] = [
  {
    id: "select",
    size: 64,
    enableSorting: false,
    enableResizing: false,
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    meta: {
      cellClassName: "text-center",
    },
  },
  {
    accessorKey: "name",
    id: "name",
    size: 300,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="px-3 font-medium">{row.original.getName()}</div>,
    sortingFn: (rowA, rowB) => rowA.original.getName().localeCompare(rowB.original.getName()),
  },
  {
    id: "webhooks",
    size: 150,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Webhooks
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="px-3">{row.original.getWebhooks().length}</div>,
    sortingFn: (rowA, rowB) => {
      const webhooksA = rowA.original.getWebhooks().length;
      const webhooksB = rowB.original.getWebhooks().length;
      return webhooksA - webhooksB;
    },
  },
  {
    id: "age",
    size: 120,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Age
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="px-3">
        <KubeObjectAge object={row.original as any} />
      </div>
    ),
    sortingFn: (rowA, rowB) => {
      const ageA = -rowA.original.getCreationTimestamp();
      const ageB = -rowB.original.getCreationTimestamp();
      return ageA - ageB;
    },
  },
];
