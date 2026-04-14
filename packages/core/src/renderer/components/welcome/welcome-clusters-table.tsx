/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Welcome 페이지 클러스터 테이블 컴포넌트 (Storybook Home story 기반)
 *
 * @remarks
 * - TanStack Table + shadcn/ui 스타일 (Storybook Home story와 동일한 UI)
 * - 7개 컬럼: Provider logo, Display Name, Version, CPU Usg., Mem Usg., Pods Status, Actions
 * - CPU/Memory는 실제 클러스터 메트릭 데이터로 AreaChart 표시
 * - Pod Status는 실제 데이터로 Stacked Bar Chart 표시
 *
 * 🔄 변경이력:
 * - 2025-11-19: 초기 생성 (Storybook Home story 마이그레이션)
 * - 2025-11-30: CPU/Memory 실제 메트릭 데이터 연동, "Updated soon" 오버레이 제거
 */

import { Input } from "@skuberplus/storybook-shadcn/src/components/ui/input";
import {
  type ColumnDef,
  type ColumnSizingInfoState,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  EllipsisVertical,
  Info,
  RefreshCcw,
  Settings,
  Trash2,
} from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { Area, AreaChart, Bar, BarChart, XAxis, YAxis } from "recharts";
import { POD_STATUS_CHART_CONFIG } from "../../utils/chart-colors";
import { ClusterProviderIcon } from "../layout/cluster-provider-icon";
import { getProviderInfo, inferProviderFromDistro } from "../layout/cluster-provider-utils";
import { Button } from "../shadcn-ui/button";
import { ChartConfig, ChartContainer, ChartTooltip } from "../shadcn-ui/chart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../shadcn-ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../shadcn-ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../shadcn-ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "../shadcn-ui/table";

import type {
  ClusterMetricsData,
  ClusterRowData,
  PodStatusData,
  WelcomeClustersAdapter,
} from "./welcome-clusters-adapter";

/**
 * 🎯 목적: Welcome Clusters Table Props 타입 정의
 */
interface WelcomeClustersTableProps {
  /**
   * 클러스터 행 데이터 배열
   */
  clusters: ClusterRowData[];

  /**
   * 행 클릭 핸들러 (선택적)
   */
  onRowClick?: (cluster: ClusterRowData) => void;

  /**
   * WelcomeClustersAdapter 인스턴스 (새로고침 기능용)
   */
  adapter: WelcomeClustersAdapter;

  /**
   * Cluster Settings 모달 열기 핸들러 (선택적)
   */
  onOpenClusterSettings?: (clusterId: string) => void;

  /**
   * 클러스터 삭제 핸들러 (선택적)
   */
  onDeleteCluster?: (clusterId: string, clusterName: string) => void;
}

/**
 * 🎯 목적: 클러스터 아바타 렌더링 (이니셜 Fallback 지원)
 *
 * @param distro - 클러스터 배포판 문자열 (예: "azure", "gcp", "openshift")
 * @param name - 클러스터 이름 (이니셜 추출용)
 * @returns Avatar 컴포넌트 (프로바이더 로고 또는 이니셜 표시)
 *
 * 📝 주의사항:
 * - distro 문자열을 소문자로 변환하여 프로바이더 로고 매칭
 * - 프로바이더 로고가 없거나 로드 실패 시 클러스터 이름 이니셜 표시 (예: "kubernetes" → "KU")
 * - Grayscale 필터 적용으로 회색조 표시
 *
 * 🔄 변경이력:
 * - 2025-11-19: Avatar 컴포넌트로 변경 (이니셜 Fallback 추가)
 */
function ClusterAvatar({ distro }: { distro?: string }) {
  const providerType = inferProviderFromDistro(distro);
  const providerInfo = getProviderInfo(providerType);

  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-md"
      style={{ backgroundColor: providerInfo.color }}
    >
      <ClusterProviderIcon provider={providerType} className="h-4 w-4 text-white" />
    </div>
  );
}

/**
 * API 서버 레이턴시를 색상 도트 + ms 텍스트로 표시한다.
 * < 200ms 초록 / 200-500ms 주황 / > 500ms 빨강 / null 회색 "-"
 */
function LatencyCell({ latency }: { latency?: number | null }) {
  if (latency == null) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const dotColor = latency < 200 ? "bg-emerald-500" : latency <= 500 ? "bg-amber-500" : "bg-red-500";
  const textColor =
    latency < 200
      ? "text-emerald-600 dark:text-emerald-400"
      : latency <= 500
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-2 w-2 rounded-full ${dotColor}`} />
      <span className={`text-sm tabular-nums ${textColor}`}>{latency}ms</span>
    </div>
  );
}

/**
 * 🎯 목적: Pod Status를 가로 Stacked Bar Chart로 시각화
 *
 * @param podStatus - Pod 상태별 카운트 데이터
 * @returns Stacked Bar Chart JSX 엘리먼트
 *
 * 📝 주의사항:
 * - ChartContainer 사용으로 일관된 차트 스타일 적용
 * - stackOffset="expand"로 비율 기반 렌더링 (실제 값은 tooltip에 표시)
 * - 오른쪽에 전체 Pod 수 표시
 */
/**
 * 🎯 목적: Pod Status 커스텀 툴팁 (모든 상태 표시)
 *
 * 📝 주의사항:
 * - recharts는 값이 0인 Bar를 tooltip payload에서 제외함
 * - 따라서 커스텀 툴팁에서 podStatus 데이터를 직접 사용하여 모든 상태 표시
 *
 * @param podStatus - Pod 상태 데이터
 * @param active - 툴팁 활성화 여부 (recharts에서 전달)
 */
function PodStatusTooltipContent({ podStatus, active }: { podStatus: PodStatusData; active?: boolean }) {
  if (!active) return null;

  // 🎯 표시할 상태 순서 및 색상 정의 (THEME-020: CSS 변수 사용)
  const statusConfig = [
    { key: "running", label: "Running", color: "var(--pod-status-running)", value: podStatus.running },
    { key: "succeeded", label: "Succeeded", color: "var(--pod-status-succeeded)", value: podStatus.succeeded },
    { key: "pending", label: "Pending", color: "var(--pod-status-pending)", value: podStatus.pending },
    { key: "failed", label: "Failed", color: "var(--pod-status-failed)", value: podStatus.failed },
    { key: "unknown", label: "Unknown", color: "var(--pod-status-unknown)", value: podStatus.unknown },
  ];

  return (
    <div className="border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="grid gap-1.5">
        {statusConfig.map((status) => (
          <div key={status.key} className="flex w-full items-center gap-2">
            {/* 색상 인디케이터 */}
            <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: status.color }} />
            {/* 라벨과 값 */}
            <div className="flex flex-1 items-center justify-between leading-none">
              <span className="text-muted-foreground">{status.label}</span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                {status.value.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PodStatusChart({ podStatus }: { podStatus?: PodStatusData }) {
  if (!podStatus) {
    return null;
  }

  // 🎯 차트 데이터 (실제 Pod 수 저장, stackOffset="expand"로 비율 렌더링)
  // 📝 주의: 키 순서가 Bar 컴포넌트 순서와 동일해야 툴팁 순서도 일치
  const chartData = [
    {
      pods: "status",
      running: podStatus.running,
      succeeded: podStatus.succeeded,
      pending: podStatus.pending,
      failed: podStatus.failed,
      unknown: podStatus.unknown,
    },
  ];

  // 🎯 전체 Pod 수 계산 (오른쪽 표시용)
  const total = podStatus.running + podStatus.pending + podStatus.succeeded + podStatus.failed + podStatus.unknown;

  // 🎯 THEME-020: 중앙 집중식 차트 설정 사용
  // 📝 POD_STATUS_CHART_CONFIG는 CSS 변수 참조를 직접 사용
  // ChartStyle이 자동으로 --color-running: var(--pod-status-running); 등을 생성
  const chartConfig = POD_STATUS_CHART_CONFIG satisfies ChartConfig;

  type PodStatusKey = keyof typeof chartConfig;
  const podOrder: PodStatusKey[] = ["running", "succeeded", "pending", "failed", "unknown"];
  const nonZeroKeys = podOrder.filter((key) => (podStatus?.[key as keyof PodStatusData] ?? 0) > 0);
  const firstKey = nonZeroKeys[0];
  const lastKey = nonZeroKeys[nonZeroKeys.length - 1];

  const getRadius = (key: keyof typeof chartConfig) => {
    const isFirst = key === firstKey;
    const isLast = key === lastKey;

    // radius: [top-left, top-right, bottom-right, bottom-left]
    return [isFirst ? 4 : 0, isLast ? 4 : 0, isLast ? 4 : 0, isFirst ? 4 : 0] as [number, number, number, number];
  };

  return (
    <div className="flex h-8 w-full items-center gap-2">
      {/* 가로 Stacked Bar Chart */}
      <div className="h-full flex-1">
        <ChartContainer config={chartConfig} className="h-full w-full overflow-visible" style={{ aspectRatio: "auto" }}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
            barSize={18}
            stackOffset="expand"
          >
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="pods" hide />
            {/* 🎯 커스텀 툴팁: 모든 Pod 상태 표시 (recharts 기본 동작은 0값 제외) */}
            <ChartTooltip
              content={(props) => <PodStatusTooltipContent {...props} podStatus={podStatus} />}
              cursor={false}
              wrapperStyle={{ zIndex: 9999 }}
            />
            <Bar dataKey="running" stackId="stack" fill="var(--color-running)" radius={getRadius("running")} />
            <Bar dataKey="succeeded" stackId="stack" fill="var(--color-succeeded)" radius={getRadius("succeeded")} />
            <Bar dataKey="pending" stackId="stack" fill="var(--color-pending)" radius={getRadius("pending")} />
            <Bar dataKey="failed" stackId="stack" fill="var(--color-failed)" radius={getRadius("failed")} />
            <Bar dataKey="unknown" stackId="stack" fill="var(--color-unknown)" radius={getRadius("unknown")} />
          </BarChart>
        </ChartContainer>
      </div>

      {/* 전체 Pod 수 표시 */}
      <span className="text-muted-foreground text-xs font-medium">{total}</span>
    </div>
  );
}

/**
 * 🎯 목적: CPU 사용량을 Area chart gradient로 시각화
 *
 * @param metrics - 클러스터 메트릭 데이터 (CPU 사용량 시계열)
 * @returns Area Chart JSX 엘리먼트
 *
 * 📝 주의사항:
 * - Prometheus: 시계열 데이터 전체 표시
 * - Metrics Server: 현재 값만 마지막에 표시
 * - None/undefined: 빈 차트 표시
 *
 * 🔄 변경이력:
 * - 2025-11-19: 초기 생성 (dimmed 상태)
 * - 2025-11-30: 실제 메트릭 데이터 연동
 */
function CPUUsageChart({ metrics }: { metrics?: ClusterMetricsData }) {
  // 🎯 메트릭 데이터 변환
  const data = metrics?.cpuUsage ?? [];

  const chartConfig = {
    usage: {
      label: "CPU",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  // 🎯 데이터가 없으면 희미하게 표시
  const hasData = data.length > 0;

  return (
    <div className={`flex h-8 w-full ${hasData ? "" : "opacity-20"}`}>
      <div className="h-full flex-1">
        <ChartContainer config={chartConfig} className="!aspect-auto h-full w-full">
          <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillCPU" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-usage)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-usage)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="usage"
              type="natural"
              fill="url(#fillCPU)"
              fillOpacity={0.2}
              stroke="var(--color-usage)"
              strokeWidth={1}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}

/**
 * 🎯 목적: Memory 사용량을 Area chart gradient로 시각화
 *
 * @param metrics - 클러스터 메트릭 데이터 (Memory 사용량 시계열)
 * @returns Area Chart JSX 엘리먼트
 *
 * 📝 주의사항:
 * - Prometheus: 시계열 데이터 전체 표시
 * - Metrics Server: 현재 값만 마지막에 표시
 * - None/undefined: 빈 차트 표시
 *
 * 🔄 변경이력:
 * - 2025-11-19: 초기 생성 (dimmed 상태)
 * - 2025-11-30: 실제 메트릭 데이터 연동
 */
function MemoryUsageChart({ metrics }: { metrics?: ClusterMetricsData }) {
  // 🎯 메트릭 데이터 변환
  const data = metrics?.memoryUsage ?? [];

  const chartConfig = {
    usage: {
      label: "Memory",
      color: "var(--chart-2)",
    },
  } satisfies ChartConfig;

  // 🎯 데이터가 없으면 희미하게 표시
  const hasData = data.length > 0;

  return (
    <div className={`flex h-8 w-full ${hasData ? "" : "opacity-20"}`}>
      <div className="h-full flex-1">
        <ChartContainer config={chartConfig} className="!aspect-auto h-full w-full">
          <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillMemory" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-usage)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-usage)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="usage"
              type="natural"
              fill="url(#fillMemory)"
              fillOpacity={0.2}
              stroke="var(--color-usage)"
              strokeWidth={1}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}

/**
 * 🎯 목적: Welcome 페이지 클러스터 목록 테이블 (Storybook Home story 기반)
 *
 * @param clusters - 클러스터 행 데이터 배열
 * @param onRowClick - 행 클릭 핸들러 (선택적)
 * @returns React 컴포넌트
 *
 * 📝 주요 기능:
 * - 7개 컬럼: Provider, Name, Version, CPU, Memory, Pod Status, Actions
 * - TanStack Table로 정렬, 페이지네이션 지원
 * - CPU/Memory 컬럼에 "Updated soon" Empty 오버레이
 * - Pod Status는 Stacked Bar Chart로 시각화
 * - 데이터 없을 때 Empty 상태 표시
 *
 * 🔄 변경이력:
 * - 2025-11-19: 초기 생성 (Storybook Home story와 UI 완전 동일)
 */
export const WelcomeClustersTable = observer(function WelcomeClustersTable({
  clusters,
  onRowClick,
  adapter,
  onOpenClusterSettings,
  onDeleteCluster,
}: WelcomeClustersTableProps) {
  // 🎯 TanStack Table 정렬 상태 관리
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // 🎯 컬럼 리사이징 상태 관리
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});
  const [columnSizingInfo, setColumnSizingInfo] = React.useState<ColumnSizingInfoState>({
    columnSizingStart: [],
    deltaOffset: null,
    deltaPercentage: null,
    isResizingColumn: false,
    startOffset: null,
    startSize: null,
  });

  // 🎯 페이지네이션 상태 관리
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // 🎯 새로고침 핸들러
  const handleRefresh = React.useCallback(() => {
    adapter.refreshAllConnectedClusters();
  }, [adapter]);

  // 🎯 TanStack Table 컬럼 정의 (정렬 가능한 컬럼 포함)
  const columns = React.useMemo<ColumnDef<ClusterRowData>[]>(
    () => [
      {
        id: "provider",
        accessorKey: "distro",
        size: 80,
        minSize: 60,
        maxSize: 100,
        header: () => <div className="flex items-center justify-center">Clusters</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <ClusterAvatar distro={row.original.distro} />
          </div>
        ),
        enableSorting: false,
      },
      {
        id: "latency",
        accessorFn: (row) => row.latency ?? Infinity,
        size: 120,
        minSize: 90,
        maxSize: 150,
        header: ({ column }) => (
          <Button variant="ghost" className="px-2" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Latency
            <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="px-3">
            <LatencyCell latency={row.original.latency} />
          </div>
        ),
        sortingFn: "basic",
      },
      {
        id: "name",
        accessorKey: "name",
        size: 200,
        minSize: 120,
        maxSize: 500,
        header: ({ column }) => (
          <Button variant="ghost" className="px-2" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Display Name
            <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => <div className="px-3 text-sm">{row.original.name}</div>,
      },
      {
        id: "version",
        accessorKey: "kubeVersion",
        size: 115,
        minSize: 90,
        maxSize: 140,
        header: ({ column }) => (
          <Button variant="ghost" className="px-2" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Version
            <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => <div className="px-3 text-sm">{row.original.kubeVersion}</div>,
      },
      {
        id: "cpuUsage",
        size: 120,
        minSize: 90,
        maxSize: 160,
        header: ({ column }) => (
          <Button variant="ghost" className="px-2" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            CPU Usg.
            <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="px-3">
            <CPUUsageChart metrics={row.original.metrics} />
          </div>
        ),
      },
      {
        id: "memoryUsage",
        size: 120,
        minSize: 90,
        maxSize: 160,
        header: ({ column }) => (
          <Button variant="ghost" className="px-2" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Mem Usg.
            <ArrowUpDown />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="px-3">
            <MemoryUsageChart metrics={row.original.metrics} />
          </div>
        ),
      },
      {
        id: "podStatus",
        accessorFn: (row) =>
          row.podStatus
            ? row.podStatus.running +
              row.podStatus.pending +
              row.podStatus.succeeded +
              row.podStatus.failed +
              row.podStatus.unknown
            : 0,
        size: 200,
        minSize: 160,
        maxSize: 240,
        header: "Pods Status",
        cell: ({ row }) => <PodStatusChart podStatus={row.original.podStatus} />,
        enableSorting: false,
      },
      {
        id: "setting",
        size: 44,
        minSize: 44,
        maxSize: 44,
        enableResizing: false,
        header: () => <div className="text-right"></div>,
        cell: ({ row }) => {
          // 🎯 각 행마다 독립적인 DropdownMenu 상태 관리
          const [dropdownOpen, setDropdownOpen] = React.useState(false);

          return (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg p-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="relative pl-8"
                  onSelect={(e) => {
                    e.preventDefault();
                    // 🎯 DropdownMenu 먼저 닫기
                    setDropdownOpen(false);
                    // 🎯 다음 사이클에 Dialog 열기
                    setTimeout(() => {
                      onOpenClusterSettings?.(row.original.id);
                    }, 0);
                  }}
                >
                  <Settings className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
                  Cluster Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  className="relative pl-8 !text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    // 🎯 DropdownMenu 먼저 닫기
                    setDropdownOpen(false);
                    // 🎯 다음 사이클에 AlertDialog 열기
                    setTimeout(() => {
                      onDeleteCluster?.(row.original.id, row.original.name);
                    }, 0);
                  }}
                >
                  <Trash2 className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
      },
    ],
    [],
  );

  // 🎯 TanStack Table 인스턴스 생성
  const table = useReactTable({
    data: clusters,
    columns,
    state: {
      sorting,
      pagination,
      columnSizing,
      columnSizingInfo,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onColumnSizingChange: setColumnSizing,
    onColumnSizingInfoChange: setColumnSizingInfo,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    columnResizeMode: "onChange",
  });

  return (
    <div className="flex w-full flex-col items-start gap-3">
      {/* 🎯 헤더: 제목 + 새로고침 버튼 */}
      <div className="flex w-full items-center justify-between">
        <span className="text-foreground text-base leading-none font-normal">Clusters Management</span>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* 클러스터 테이블 - TanStack Table 정렬 기능 적용 */}
      <div className="relative w-full">
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: table.getTotalSize() }}>
            <TableHeader className="bg-muted [&_tr]:border-b-0">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-muted border-b">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={`text-foreground relative ${
                        header.column.id === "setting" ? "text-right" : ""
                      } text-sm font-medium whitespace-nowrap`}
                      style={{
                        width: header.getSize(),
                        minWidth: header.column.columnDef.minSize,
                        maxWidth: header.column.columnDef.maxSize,
                      }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}

                      {/* 🎯 컬럼 리사이즈 핸들 */}
                      {header.column.getCanResize() ? (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize select-none"
                        >
                          <div className="mx-auto h-full w-px bg-border" />
                        </div>
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-[280px]">
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Info className="h-5 w-5" />
                        </EmptyMedia>
                        <EmptyTitle>No cluster</EmptyTitle>
                        <EmptyDescription>
                          Add cluster from kubeconfig or sync with kubeconfig to add cluster
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-muted/50 group border-b hover:relative cursor-pointer"
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={`text-foreground overflow-hidden text-ellipsis ${
                          cell.column.id === "podStatus" ? "relative z-50" : ""
                        }${cell.column.id === "setting" ? " text-right" : ""} group-hover:relative group-hover:z-[100]`}
                        style={{
                          width: cell.column.getSize(),
                          minWidth: cell.column.columnDef.minSize,
                          maxWidth: cell.column.columnDef.maxSize,
                        }}
                        // 🎯 setting 컬럼 클릭 시 행 클릭 이벤트 전파 방지 (액션 버튼 동작 분리)
                        onClick={cell.column.id === "setting" ? (e) => e.stopPropagation() : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>

        {/* 🎯 페이지네이션 컨트롤 - 클러스터 수, 페이지 이동, Rows per page */}
        <div className="flex items-center justify-between px-4 pt-4">
          {/* 왼쪽: 클러스터 개수 표시 */}
          <div className="text-muted-foreground text-sm">{clusters.length} cluster(s)</div>

          {/* 중앙: 페이지 이동 버튼 */}
          <div className="flex items-center space-x-2">
            <div className="text-muted-foreground flex items-center gap-1 text-sm">
              <span>Page</span>
              <Input
                type="number"
                min={1}
                max={table.getPageCount()}
                value={table.getState().pagination.pageIndex + 1}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") return;
                  const page = Math.max(1, Math.min(Number(value), table.getPageCount()));
                  table.setPageIndex(page - 1);
                }}
                className="h-8 w-14 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span>of {table.getPageCount()}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.firstPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.lastPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 오른쪽: Rows per page */}
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
});
