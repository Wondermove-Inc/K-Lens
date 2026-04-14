/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Node 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Node 전용 컬럼 정의
 * - 12개 컬럼: Checkbox, Name, Status Icon, CPU, Memory, Disk, Roles, Taints, Version, Internal IP, Age, Schedulable, Conditions
 * - 정렬 가능한 컬럼: Name, CPU, Memory, Disk, Roles, Taints, Version, Internal IP, Age, Schedulable, Conditions
 * - 메트릭 데이터는 전처리된 NodeWithMetrics 타입 사용
 *
 * 🔄 변경이력:
 * - 2025-11-04: 초기 생성 (TanStack Table 컬럼 정의, Pod 및 Namespace 패턴 참고)
 */

import { formatNodeTaint } from "@skuberplus/kube-object";
import { Button, Checkbox } from "@skuberplus/storybook-shadcn";
import { TooltipPosition } from "@skuberplus/tooltip";
import { ArrowUpDown } from "lucide-react";
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/shadcn-ui/tooltip";
import { BadgeBoolean } from "../badge";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectConditionsList } from "../kube-object-conditions";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { LineProgress } from "../line-progress";
import { WithTooltip } from "../with-tooltip";

import type { Node } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: 메트릭 데이터가 포함된 Node 타입
 *
 * @remarks
 * nodes-common-table.tsx에서 전처리하여 메트릭 데이터를 추가한 타입
 */
export interface NodeWithMetrics extends Node {
  metrics: {
    cpuUsage: number;
    cpuCapacity: number;
    memoryUsage: number;
    memoryCapacity: number;
    diskUsage: number;
    diskCapacity: number;
    cpuUsageText: string;
    memoryUsageText: string;
  };
}

/**
 * 🎯 목적: Node 테이블 컬럼 정의 배열
 *
 * @remarks
 * 12개 컬럼: Checkbox, Name, Status Icon, CPU, Memory, Disk, Roles, Taints, Version, Internal IP, Age, Schedulable, Conditions
 *
 * 📝 주의사항:
 * - size: 기본 컬럼 너비 (픽셀)
 * - enableSorting: 정렬 활성화 여부
 * - enableResizing: 리사이징 활성화 여부
 * - NodeWithMetrics 타입 사용: 전처리된 메트릭 데이터 포함
 */
export const nodeColumns: ColumnDef<NodeWithMetrics>[] = [
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
      const node = row.original;
      return (
        <div className="px-3">
          <WithTooltip>
            <span className="font-medium">{node.getName()}</span>
          </WithTooltip>
        </div>
      );
    },
    size: 200,
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
    header: () => null,
    cell: ({ row }) => {
      const node = row.original;
      return <KubeObjectStatusIcon object={node} />;
    },
    size: 24,
    enableSorting: false,
    enableResizing: false,
  },

  // ============================================
  // 💻 CPU 컬럼 (정렬 가능, 리사이징 가능, LineProgress)
  // ============================================
  {
    accessorKey: "cpu",
    id: "cpu",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        CPU
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const node = row.original;
      const { cpuUsage, cpuCapacity, cpuUsageText } = node.metrics;

      // 🎯 메트릭 데이터가 없거나 용량이 0일 경우 N/A 표시
      if (!cpuUsage || !cpuCapacity || cpuCapacity === 0) {
        return (
          <div className="px-3">
            <span className="text-muted-foreground text-sm">N/A</span>
          </div>
        );
      }

      // 🎯 사용률 계산
      const usagePercentage = ((cpuUsage * 100) / cpuCapacity).toFixed(2);

      return (
        <div className="px-3">
          <LineProgress
            max={cpuCapacity}
            value={cpuUsage}
            tooltip={{
              preferredPositions: TooltipPosition.BOTTOM,
              children: `CPU: ${cpuUsageText}, ${usagePercentage}%, cores: ${cpuCapacity}`,
            }}
          />
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.metrics.cpuUsage - rowB.original.metrics.cpuUsage;
    },
  },

  // ============================================
  // 🧠 Memory 컬럼 (정렬 가능, 리사이징 가능, LineProgress)
  // ============================================
  {
    accessorKey: "memory",
    id: "memory",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Memory
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const node = row.original;
      const { memoryUsage, memoryCapacity, memoryUsageText } = node.metrics;

      // 🎯 메트릭 데이터가 없거나 용량이 0일 경우 N/A 표시
      if (!memoryUsage || !memoryCapacity || memoryCapacity === 0) {
        return (
          <div className="px-3">
            <span className="text-muted-foreground text-sm">N/A</span>
          </div>
        );
      }

      // 🎯 사용률 계산
      const usagePercentage = ((memoryUsage * 100) / memoryCapacity).toFixed(2);

      return (
        <div className="px-3">
          <LineProgress
            max={memoryCapacity}
            value={memoryUsage}
            tooltip={{
              preferredPositions: TooltipPosition.BOTTOM,
              children: `Memory: ${memoryUsageText}, ${usagePercentage}%`,
            }}
          />
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.metrics.memoryUsage - rowB.original.metrics.memoryUsage;
    },
  },

  // ============================================
  // 💾 Disk 컬럼 (정렬 가능, 리사이징 가능, LineProgress)
  // ============================================
  {
    accessorKey: "disk",
    id: "disk",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Disk
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const node = row.original;
      const { diskUsage, diskCapacity } = node.metrics;

      // 🎯 메트릭 데이터가 없거나 용량이 0일 경우 N/A 표시
      if (!diskUsage || !diskCapacity || diskCapacity === 0) {
        return (
          <div className="px-3">
            <span className="text-muted-foreground text-sm">N/A</span>
          </div>
        );
      }

      // 🎯 사용률 계산
      const usagePercentage = ((diskUsage * 100) / diskCapacity).toFixed(2);

      return (
        <div className="px-3">
          <LineProgress
            max={diskCapacity}
            value={diskUsage}
            tooltip={{
              preferredPositions: TooltipPosition.BOTTOM,
              children: `Disk: ${usagePercentage}%`,
            }}
          />
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.metrics.diskUsage - rowB.original.metrics.diskUsage;
    },
  },

  // ============================================
  // 🎭 Roles 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "roles",
    id: "roles",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Roles
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const node = row.original;
      const roles = node.getRoleLabels();

      if (!roles) {
        return (
          <div className="px-3">
            <span className="text-muted-foreground text-sm">-</span>
          </div>
        );
      }

      return (
        <div className="px-3">
          <WithTooltip>{roles}</WithTooltip>
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getRoleLabels().localeCompare(rowB.original.getRoleLabels());
    },
  },

  // ============================================
  // 🏷️ Taints 컬럼 (정렬 가능, 리사이징 가능, Tooltip)
  // ============================================
  {
    accessorKey: "taints",
    id: "taints",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Taints
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const node = row.original;
      const taints = node.getTaints();

      if (taints.length === 0) {
        return (
          <div className="px-3">
            <span className="text-muted-foreground text-sm">0</span>
          </div>
        );
      }

      return (
        <div className="px-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">{taints.length}</span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs max-w-md whitespace-pre-line">{taints.map(formatNodeTaint).join("\n")}</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    size: 80,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getTaints().length - rowB.original.getTaints().length;
    },
  },

  // ============================================
  // 🔢 Version 컬럼 (정렬 가능, 리사이징 가능)
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
      const node = row.original;
      const version = node.getKubeletVersion();

      return (
        <div className="px-3">
          <WithTooltip>{version}</WithTooltip>
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getKubeletVersion().localeCompare(rowB.original.getKubeletVersion());
    },
  },

  // ============================================
  // 🌐 Internal IP 컬럼 (정렬 가능, 리사이징 가능)
  // ============================================
  {
    accessorKey: "internalIp",
    id: "internalIp",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Internal IP
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const node = row.original;
      const internalIp = node.getInternalIP();

      return (
        <div className="px-3">
          <WithTooltip>{internalIp || "-"}</WithTooltip>
        </div>
      );
    },
    size: 130,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const aValue = rowA.original.getInternalIP() || "";
      const bValue = rowB.original.getInternalIP() || "";
      return aValue.localeCompare(bValue);
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
      const node = row.original;
      return (
        <div className="px-3">
          <KubeObjectAge object={node} />
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
  // ✅ Schedulable 컬럼 (정렬 가능, 리사이징 가능, BadgeBoolean)
  // ============================================
  {
    accessorKey: "schedulable",
    id: "schedulable",
    header: ({ column }) => (
      <Button data-slot="button" variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Schedulable
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const node = row.original;
      return (
        <div className="px-3">
          <BadgeBoolean value={!node.isUnschedulable()} />
        </div>
      );
    },
    size: 120,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const aValue = rowA.original.isUnschedulable() ? 0 : 1;
      const bValue = rowB.original.isUnschedulable() ? 0 : 1;
      return aValue - bValue;
    },
  },

  // ============================================
  // 📊 Conditions 컬럼 (정렬 가능, 리사이징 가능, 스크롤 가능)
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
      const node = row.original;
      return (
        <div className="px-3">
          <KubeObjectConditionsList object={node} />
        </div>
      );
    },
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.getNodeConditionText().localeCompare(rowB.original.getNodeConditionText());
    },
  },
];
