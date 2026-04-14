/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Deployment 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Deployment 전용 컬럼 정의
 * - Pod 컬럼 패턴을 따르되 Deployment 특성 반영
 * - 정렬 가능한 컬럼: Name, Namespace, Ready, Desired, Updated, Available, Age
 * - Conditions는 shadcn Badge 배열로 표시
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (Pod 컬럼 패턴 기반, Deployment 적용)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { ArrowUpDown } from "lucide-react";
import React from "react";
// Cell 컴포넌트 imports
import { KubeObjectAge } from "../kube-object/age";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { Deployment } from "@skuberplus/kube-object";

import type { ColumnDef, Row } from "@tanstack/react-table";

/**
 * 🎯 목적: Deployment 테이블 컬럼 정의 배열
 *
 * @remarks
 * 10개 컬럼: Checkbox, Name, Namespace, Replicas, Ready, Desired, Updated, Available, Age, Conditions
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 * - Conditions는 shadcn Badge 컴포넌트로 표시
 */
export const deploymentColumns: ColumnDef<Deployment>[] = [
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
      const deployment = row.original;
      return <div className="px-3 font-medium">{deployment.getName()}</div>;
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA: Row<Deployment>, rowB: Row<Deployment>) => {
      return rowA.original.getName().localeCompare(rowB.original.getName());
    },
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
      const deployment = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={deployment.getNs()} />
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA: Row<Deployment>, rowB: Row<Deployment>) => {
      return rowA.original.getNs().localeCompare(rowB.original.getNs());
    },
  },

  // ============================================
  // 📊 Replicas 컬럼 (텍스트 표시, 정렬 가능)
  // ============================================
  {
    accessorKey: "replicas",
    id: "replicas",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Replicas
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const deployment = row.original;
      const replicas = deployment.status?.replicas || 0;
      const availableReplicas = deployment.status?.availableReplicas || 0;
      return <div className="px-3">{`${availableReplicas}/${replicas}`}</div>;
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA: Row<Deployment>, rowB: Row<Deployment>) => {
      // Available 우선, 전체 Replicas는 부차적 정렬
      const availableA = rowA.original.status?.availableReplicas || 0;
      const availableB = rowB.original.status?.availableReplicas || 0;
      const replicasA = rowA.original.status?.replicas || 0;
      const replicasB = rowB.original.status?.replicas || 0;
      return availableA * 1000000 + replicasA - (availableB * 1000000 + replicasB);
    },
  },

  // ============================================
  // ✅ Ready 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "ready",
    id: "ready",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Ready
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const deployment = row.original;
      return <div className="px-3">{deployment.status?.readyReplicas || 0}</div>;
    },
    size: 80,
    enableSorting: true,
    sortingFn: (rowA: Row<Deployment>, rowB: Row<Deployment>) => {
      const readyA = rowA.original.status?.readyReplicas || 0;
      const readyB = rowB.original.status?.readyReplicas || 0;
      return readyA - readyB;
    },
  },

  // ============================================
  // 🎯 Desired 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "desired",
    id: "desired",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Desired
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const deployment = row.original;
      return <div className="px-3">{deployment.getReplicas()}</div>;
    },
    size: 80,
    enableSorting: true,
    sortingFn: (rowA: Row<Deployment>, rowB: Row<Deployment>) => {
      const desiredA = rowA.original.getReplicas();
      const desiredB = rowB.original.getReplicas();
      return desiredA - desiredB;
    },
  },

  // ============================================
  // 🔄 Updated 컬럼 (정렬 가능, 리사이징 가능)
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
      const deployment = row.original;
      return <div className="px-3">{deployment.status?.updatedReplicas || 0}</div>;
    },
    size: 80,
    enableSorting: true,
    sortingFn: (rowA: Row<Deployment>, rowB: Row<Deployment>) => {
      const updatedA = rowA.original.status?.updatedReplicas || 0;
      const updatedB = rowB.original.status?.updatedReplicas || 0;
      return updatedA - updatedB;
    },
  },

  // ============================================
  // 💚 Available 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "available",
    id: "available",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Available
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const deployment = row.original;
      return <div className="px-3">{deployment.status?.availableReplicas || 0}</div>;
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA: Row<Deployment>, rowB: Row<Deployment>) => {
      const availableA = rowA.original.status?.availableReplicas || 0;
      const availableB = rowB.original.status?.availableReplicas || 0;
      return availableA - availableB;
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
      const deployment = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={deployment} />
        </div>
      );
    },
    size: 100,
    enableSorting: true,
    sortingFn: (rowA: Row<Deployment>, rowB: Row<Deployment>) => {
      const ageA = rowA.original.getTimeDiffFromNow();
      const ageB = rowB.original.getTimeDiffFromNow();
      return ageA - ageB; // 오래된 것부터 (오름차순)
    },
  },

  // ============================================
  // 🏷️ Conditions 컬럼 (shadcn Badge 배열, 정렬 가능)
  // ============================================
  {
    accessorKey: "conditions",
    id: "conditions",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Conditions
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const deployment = row.original;

      // 🎯 중요도 순서로 정렬: Available → Progressing → ReplicaFailure
      const conditionPriority: Record<string, number> = {
        Available: 1,
        Progressing: 2,
        ReplicaFailure: 3,
      };

      const conditions = [...(deployment.status?.conditions || [])].sort(
        (a, b) => (conditionPriority[a.type] || 999) - (conditionPriority[b.type] || 999),
      );

      if (conditions.length === 0) {
        return <div className="px-3 text-muted-foreground">-</div>;
      }

      return (
        <div className="flex flex-wrap gap-1 px-3">
          {conditions.map((condition, index) => {
            // 🎯 Condition 상태에 따라 Badge variant 결정
            let variant: "default" | "secondary" | "destructive" | "outline" = "default";

            if (condition.type === "Available" && condition.status === "True") {
              variant = "default"; // 진한 회색 (bg-primary, Available)
            } else if (condition.type === "Progressing" && condition.status === "True") {
              variant = "secondary"; // 연한 회색 (bg-secondary, Progressing)
            } else if (condition.status === "False") {
              variant = "destructive"; // 빨간색 (False)
            } else {
              variant = "outline"; // 기본 (기타)
            }

            // 🎯 THEME-024: CSS 변수 기반 색상 적용
            // 🔄 THEME-040: !text-white → CSS 변수 참조
            return (
              <Badge
                key={index}
                variant={variant}
                className={`text-xs ${
                  condition.type === "Available" && condition.status === "True"
                    ? "!bg-[var(--status-success)] !text-[var(--badge-succeeded-fg)]"
                    : condition.type === "Progressing" && condition.status === "True"
                      ? "!bg-[var(--status-info)] !text-[var(--badge-running-fg)]"
                      : ""
                }`}
              >
                {condition.type}
              </Badge>
            );
          })}
        </div>
      );
    },
    size: 250,
    enableSorting: true,
    sortingFn: (rowA: Row<Deployment>, rowB: Row<Deployment>) => {
      const conditionsA = rowA.original.getConditionsText();
      const conditionsB = rowB.original.getConditionsText();
      return conditionsA.localeCompare(conditionsB);
    },
  },
];
