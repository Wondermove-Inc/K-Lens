/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: HPA 테이블의 컬럼 정의 (TanStack Table 사용)
 *
 * 📊 컬럼 구성 (9개):
 * 1. Checkbox - 행 선택용
 * 2. Name - HPA 이름 (정렬 가능)
 * 3. Status Icon - 상태 아이콘
 * 4. Namespace - 네임스페이스 (Badge 표시)
 * 5. Metrics - 타겟 메트릭 정보
 * 6. Min Pods - 최소 Pod 수
 * 7. Max Pods - 최대 Pod 수
 * 8. Replicas - 현재 Replica 수
 * 9. Age - 생성된 지 얼마나 지났는지
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 *   - 2025-11-19: Pod 패턴으로 전환 (상수 columns, 메트릭 전처리)
 */

import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";

import type { HorizontalPodAutoscaler } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: 메트릭 전처리를 위한 HPA 확장 인터페이스
 *
 * @property formattedMetrics - 포맷팅된 메트릭 문자열 (common-table에서 계산)
 */
export interface HorizontalPodAutoscalerWithMetrics extends HorizontalPodAutoscaler {
  formattedMetrics: string;
}

/**
 * 🎯 목적: HPA 테이블 컬럼 정의 (상수)
 *
 * 📝 주의사항:
 *   - Pod 패턴과 동일하게 상수로 정의
 *   - formattedMetrics는 common-table에서 전처리됨
 *   - TanStack Table 상태 안정성 확보
 *
 * 🔄 변경이력:
 *   - 2025-11-19: 함수 패턴 → 상수 패턴 전환
 */
export const horizontalPodAutoscalerColumns: ColumnDef<HorizontalPodAutoscalerWithMetrics>[] = [
  // ============================================
  // 📋 Checkbox 컬럼 (선택용, 48px 고정 너비)
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
  // 📋 Name 컬럼 (정렬 가능, 200px 기본 너비)
  // ============================================
  {
    accessorKey: "name",
    id: "name",
    size: 200,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const hpa = row.original;
      return <div className="px-3 font-medium">{hpa.getName()}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const nameA = rowA.original.getName();
      const nameB = rowB.original.getName();
      return nameA.localeCompare(nameB);
    },
  },

  // ============================================
  // 📋 Status Icon 컬럼 (상태 아이콘, 24px 고정)
  // ============================================
  {
    id: "status-icon",
    size: 24,
    enableSorting: false,
    enableResizing: false,
    header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
    cell: ({ row }) => {
      const hpa = row.original;
      return (
        <div className="flex items-center justify-center">
          <KubeObjectStatusIcon object={hpa} />
        </div>
      );
    },
    meta: {
      cellClassName: "text-center",
    },
  },

  // ============================================
  // 📋 Namespace 컬럼 (Badge 표시, 150px 기본 너비)
  // ============================================
  {
    id: "namespace",
    size: 150,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Namespace
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const hpa = row.original;
      return (
        <div className="px-3">
          <NamespaceSelectBadge namespace={hpa.getNs()} />
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const nsA = rowA.original.getNs();
      const nsB = rowB.original.getNs();
      return nsA.localeCompare(nsB);
    },
  },

  // ============================================
  // 📋 Metrics 컬럼 (타겟 메트릭, 200px 기본 너비)
  // ============================================
  {
    id: "metrics",
    size: 200,
    enableSorting: false,
    header: () => <div className="text-left">Metrics</div>,
    cell: ({ row }) => {
      const { formattedMetrics } = row.original;
      return <div className="px-3 text-sm">{formattedMetrics}</div>;
    },
  },

  // ============================================
  // 📋 Min Pods 컬럼 (최소 Pod 수, 100px)
  // ============================================
  {
    id: "min-pods",
    size: 100,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Min Pods
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const hpa = row.original;
      return <div className="px-3">{hpa.getMinPods()}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const minA = rowA.original.getMinPods();
      const minB = rowB.original.getMinPods();
      return minA - minB;
    },
  },

  // ============================================
  // 📋 Max Pods 컬럼 (최대 Pod 수, 100px)
  // ============================================
  {
    id: "max-pods",
    size: 100,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Max Pods
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const hpa = row.original;
      return <div className="px-3">{hpa.getMaxPods()}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const maxA = rowA.original.getMaxPods();
      const maxB = rowB.original.getMaxPods();
      return maxA - maxB;
    },
  },

  // ============================================
  // 📋 Replicas 컬럼 (현재 Replica 수, 100px)
  // ============================================
  {
    id: "replicas",
    size: 100,
    enableSorting: true,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Replicas
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const hpa = row.original;
      return <div className="px-3">{hpa.getReplicas()}</div>;
    },
    sortingFn: (rowA, rowB) => {
      const replicasA = rowA.original.getReplicas();
      const replicasB = rowB.original.getReplicas();
      return replicasA - replicasB;
    },
  },

  // ============================================
  // 📋 Age 컬럼 (생성 시간, 120px 기본 너비)
  // ============================================
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
    cell: ({ row }) => {
      const hpa = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={hpa} />
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      // 최신 생성 시간이 더 작은 값
      const ageA = -rowA.original.getCreationTimestamp();
      const ageB = -rowB.original.getCreationTimestamp();
      return ageA - ageB;
    },
  },
];
