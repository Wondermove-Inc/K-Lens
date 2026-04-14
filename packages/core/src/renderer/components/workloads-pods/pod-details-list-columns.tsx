/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Pod Details List 테이블의 TanStack Table 컬럼 정의
 *
 * @remarks
 * - KubeDataTable에서 사용할 Pod Details List 전용 컬럼 정의
 * - Deployment, DaemonSet 등 상세 페이지 내 Pod 목록 표시용
 * - 조건부 Node 컬럼 지원 (owner.kind === "Node"일 때 숨김)
 * - CPU/Memory 메트릭 LineProgress 표시
 *
 * 🔄 변경이력:
 * - 2025-11-12: 초기 생성 (레거시 Table → KubeDataTable 마이그레이션)
 */

import { bytesToUnits, cssNames } from "@skuberplus/utilities";
import kebabCase from "lodash/kebabCase";
import { AlertTriangle } from "lucide-react";
import React from "react";
import { LinkToNamespace, LinkToNode, LinkToPod } from "../kube-object-link";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { LineProgress } from "../line-progress";
import { WithTooltip } from "../with-tooltip";

import type { Pod } from "@skuberplus/kube-object";

import type { ColumnDef } from "@tanstack/react-table";

/**
 * 🎯 목적: 메트릭 데이터가 포함된 Pod 타입 (Details List용)
 */
export interface PodDetailsWithMetrics extends Pod {
  metrics: {
    cpu: number;
    memory: number;
  };
}

/**
 * 🎯 목적: CPU 사용량 렌더링 (LineProgress 또는 텍스트)
 */
function renderCpuUsage(usage: number, maxCpu?: number) {
  const value = usage.toFixed(3);

  if (!maxCpu) {
    if (parseFloat(value) === 0) return 0;
    return value;
  }

  const tooltip = (
    <p>
      {`CPU: ${Math.ceil((usage * 100) / maxCpu)}%`}
      <br />
      {usage.toFixed(3)}
    </p>
  );

  return <LineProgress max={maxCpu} value={usage} tooltip={parseFloat(value) !== 0 ? tooltip : null} />;
}

/**
 * 🎯 목적: Memory 사용량 렌더링 (LineProgress 또는 텍스트)
 */
function renderMemoryUsage(usage: number, maxMemory?: number) {
  if (!maxMemory) return usage ? bytesToUnits(usage) : 0;

  const tooltip = (
    <p>
      {`Memory: ${Math.ceil((usage * 100) / maxMemory)}%`}
      <br />
      {bytesToUnits(usage, { precision: 3 })}
    </p>
  );

  return <LineProgress max={maxMemory} value={usage} tooltip={usage != 0 ? tooltip : null} />;
}

/**
 * 🎯 목적: Pod Details List 테이블 컬럼 정의 함수
 *
 * @param hideNode - Node 컬럼 숨김 여부 (owner.kind === "Node"일 때 true)
 * @param linkToPod - Pod 이름을 링크로 표시할지 여부 (owner.kind !== "Pod"일 때 true)
 * @param maxCpu - CPU 최대값 (LineProgress 표시용)
 * @param maxMemory - Memory 최대값 (LineProgress 표시용)
 * @returns TanStack Table 컬럼 정의 배열
 */
export function getPodDetailsListColumns(
  hideNode: boolean,
  linkToPod: boolean,
  maxCpu?: number,
  maxMemory?: number,
): ColumnDef<PodDetailsWithMetrics>[] {
  const columns: ColumnDef<PodDetailsWithMetrics>[] = [
    // ============================================
    // 📝 Name 컬럼
    // ============================================
    {
      id: "name",
      accessorFn: (pod) => pod.getName(),
      header: "Name",
      cell: ({ row }) => {
        const pod = row.original;
        return (
          <WithTooltip>
            {linkToPod ? <LinkToPod name={pod.getName()} namespace={pod.getNs()} /> : pod.getName()}
          </WithTooltip>
        );
      },
      size: 200,
      enableSorting: true,
    },

    // ============================================
    // ⚠️ Status Icon 컬럼 (상태 아이콘, 24px 고정)
    // ============================================
    {
      id: "warning",
      header: () => <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
      cell: ({ row }) => <KubeObjectStatusIcon key="icon" object={row.original} />,
      size: 24,
      enableSorting: false,
      enableResizing: false,
    },
  ];

  // ============================================
  // 🖥️ Node 컬럼 (조건부)
  // ============================================
  if (!hideNode) {
    columns.push({
      id: "node",
      accessorFn: (pod) => pod.getNodeName(),
      header: "Node",
      cell: ({ row }) => (
        <WithTooltip>
          <LinkToNode name={row.original.getNodeName()} />
        </WithTooltip>
      ),
      size: 150,
      enableSorting: true,
    });
  }

  // ============================================
  // 📂 Namespace 컬럼
  // ============================================
  columns.push({
    id: "namespace",
    accessorFn: (pod) => pod.getNs(),
    header: "Namespace",
    cell: ({ row }) => (
      <WithTooltip>
        <LinkToNamespace namespace={row.original.getNs()} />
      </WithTooltip>
    ),
    size: 120,
    enableSorting: true,
  });

  // ============================================
  // ✓ Ready 컬럼
  // ============================================
  columns.push({
    id: "ready",
    accessorFn: (pod) => `${pod.getRunningContainers().length} / ${pod.getContainers().length}`,
    header: "Ready",
    cell: ({ getValue }) => getValue(),
    size: 80,
    enableSorting: false,
  });

  // ============================================
  // 📊 CPU 컬럼
  // ============================================
  columns.push({
    id: "cpu",
    accessorFn: (pod) => pod.metrics.cpu,
    header: "CPU",
    cell: ({ row }) => renderCpuUsage(row.original.metrics.cpu, maxCpu),
    size: 120,
    enableSorting: true,
  });

  // ============================================
  // 💾 Memory 컬럼
  // ============================================
  columns.push({
    id: "memory",
    accessorFn: (pod) => pod.metrics.memory,
    header: "Memory",
    cell: ({ row }) => renderMemoryUsage(row.original.metrics.memory, maxMemory),
    size: 120,
    enableSorting: true,
  });

  // ============================================
  // 📈 Status 컬럼
  // ============================================
  columns.push({
    id: "status",
    accessorFn: (pod) => pod.getStatusMessage(),
    header: "Status",
    cell: ({ row }) => {
      const pod = row.original;
      const statusMessage = pod.getStatusMessage();
      return <div className={cssNames("status", kebabCase(statusMessage))}>{statusMessage}</div>;
    },
    size: 100,
    enableSorting: false,
  });

  return columns;
}
