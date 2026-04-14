/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@skuberplus/storybook-shadcn/src/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from "@skuberplus/storybook-shadcn/src/components/ui/chart";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skuberplus/storybook-shadcn/src/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@skuberplus/storybook-shadcn/src/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@skuberplus/storybook-shadcn/src/components/ui/item";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skuberplus/storybook-shadcn/src/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@skuberplus/storybook-shadcn/src/components/ui/toggle-group";
import { BadgeCheck, ChevronDown, TriangleAlert } from "lucide-react";
import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Navigate } from "../../navigation/navigate.injectable";

/**
 * 🎯 목적: 시간별 차트 데이터 포인트 타입
 */
export interface HourlyDataPoint {
  hour: string;
  value: number;
}

/**
 * 🎯 목적: RadialBar/Pie 차트 메트릭 데이터 타입
 */
export interface MetricDataPoint {
  metric: string;
  value: number;
  fill: string;
}

/**
 * 🎯 목적: Kubernetes 메트릭 데이터 세트 (Props로 전달)
 */
export interface KubernetesMetricsData {
  masterHourlyCpuData?: HourlyDataPoint[];
  workerHourlyCpuData?: HourlyDataPoint[];
  masterHourlyMemoryData?: HourlyDataPoint[];
  workerHourlyMemoryData?: HourlyDataPoint[];
  masterCpuData?: MetricDataPoint[];
  workerCpuData?: MetricDataPoint[];
  masterMemoryData?: MetricDataPoint[];
  workerMemoryData?: MetricDataPoint[];
  masterPodsData?: MetricDataPoint[];
  workerPodsData?: MetricDataPoint[];
}

/**
 * 🎯 목적: ChartData 컴포넌트 Props 타입 정의
 * 스크린샷 기반 다크 테마 대시보드 컴포넌트
 *
 * @param className - CSS 클래스명
 * @param variant - 표시 모드 ("default": 전체, "no-data": 빈 상태, "overview": 간소화)
 * @param metricsData - Kubernetes 메트릭 데이터 (optional, 없으면 hardcoded data 사용)
 * @param navigate - 프로젝트 커스텀 네비게이션 함수 (observableHistory 기반)
 */
interface ChartDataProps {
  className?: string;
  variant?: "default" | "no-data" | "overview";
  metricsData?: KubernetesMetricsData;
  navigate?: Navigate;
}

/**
 * 🎯 목적: Hardcoded 목 데이터 제거
 * 📝 주의: 실제 Kubernetes 메트릭 데이터만 사용, fallback은 빈 배열
 * 🔄 변경이력: 2025-11-04 - 모든 hardcoded 목 데이터 제거
 */

/**
 * 🎯 목적: No Data 상태용 빈 데이터 (variant="no-data"에서만 사용)
 */
const noDataHourlyCpuData = [
  { hour: "15:00", value: 0 },
  { hour: "16:00", value: 0 },
  { hour: "17:00", value: 0 },
  { hour: "18:00", value: 0 },
  { hour: "19:00", value: 0 },
  { hour: "20:00", value: 0 },
];

const noDataHourlyMemoryData = [
  { hour: "15:00", value: 0 },
  { hour: "16:00", value: 0 },
  { hour: "17:00", value: 0 },
  { hour: "18:00", value: 0 },
  { hour: "19:00", value: 0 },
  { hour: "20:00", value: 0 },
];

const noDataCpuData = [
  { metric: "usage", value: 0, fill: "var(--color-usage)" },
  { metric: "requests", value: 0, fill: "var(--color-requests)" },
  { metric: "limits", value: 0, fill: "var(--color-limits)" },
  { metric: "allocatable", value: 0, fill: "var(--color-allocatable)" },
  { metric: "capacity", value: 0, fill: "var(--color-capacity)" },
];

const noDataMemoryData = [
  { metric: "usage", value: 0, fill: "var(--color-usage)" },
  { metric: "requests", value: 0, fill: "var(--color-requests)" },
  { metric: "limits", value: 0, fill: "var(--color-limits)" },
  { metric: "allocatable", value: 0, fill: "var(--color-allocatable)" },
  { metric: "capacity", value: 0, fill: "var(--color-capacity)" },
];

const noDataPodsData = [
  { metric: "usage", value: 0, fill: "var(--color-usage)" },
  { metric: "allocatable", value: 0, fill: "var(--color-allocatable)" },
  { metric: "capacity", value: 0, fill: "var(--color-capacity)" },
];

/**
 * 🎯 목적: Overview 전용 Kubernetes 리소스 데이터
 */
const overviewPodsData = [
  { metric: "succeeded", value: 1, fill: "var(--chart-1)" },
  { metric: "running", value: 12, fill: "var(--chart-2)" },
  { metric: "pending", value: 5, fill: "var(--chart-3)" },
];

const overviewDeploymentsData = [
  { metric: "succeeded", value: 0, fill: "var(--chart-1)" },
  { metric: "running", value: 3, fill: "var(--chart-2)" },
  { metric: "pending", value: 1, fill: "var(--chart-3)" },
];

const overviewDaemonSetsData = [
  { metric: "succeeded", value: 0, fill: "var(--chart-1)" },
  { metric: "running", value: 1, fill: "var(--chart-2)" },
  { metric: "pending", value: 3, fill: "var(--chart-3)" },
];

const overviewStatefulSetsData = [
  { metric: "succeeded", value: 0, fill: "var(--chart-1)" },
  { metric: "running", value: 0, fill: "var(--chart-2)" },
  { metric: "pending", value: 0, fill: "var(--chart-3)" },
];

const overviewReplicaSetsData = [
  { metric: "succeeded", value: 0, fill: "var(--chart-1)" },
  { metric: "running", value: 3, fill: "var(--chart-2)" },
  { metric: "pending", value: 1, fill: "var(--chart-3)" },
];

const overviewJobsData = [
  { metric: "succeeded", value: 1, fill: "var(--chart-1)" },
  { metric: "running", value: 0, fill: "var(--chart-2)" },
  { metric: "pending", value: 0, fill: "var(--chart-3)" },
];

const overviewCronJobsData = [
  { metric: "succeeded", value: 0, fill: "var(--chart-1)" },
  { metric: "running", value: 0, fill: "var(--chart-2)" },
  { metric: "pending", value: 0, fill: "var(--chart-3)" },
];

/**
 * 차트와 테이블 조합의 모니터링 차트데이터 입니다.
 */
export function ChartData({ className, variant = "default", metricsData, navigate }: ChartDataProps) {
  const [selectedNode, setSelectedNode] = React.useState("master");
  const [selectedMetric, setSelectedMetric] = React.useState<"cpu" | "memory">("cpu");
  const [selectedNamespace, setSelectedNamespace] = React.useState("default");

  /**
   * 🎯 목적: 리소스 클릭 시 해당 페이지로 이동
   * @param route - 이동할 라우트 경로
   */
  const handleNavigate = (route: string) => {
    if (navigate) {
      navigate(route);
    }
  };

  /**
   * 🎯 목적: Props로 전달된 실제 Kubernetes 메트릭 데이터만 사용
   *
   * 📝 주의사항:
   * - metricsData가 없으면 빈 배열 사용 (hardcoded fallback 제거)
   * - 실제 메트릭이 수집되지 않으면 차트가 비어있음
   *
   * 🔄 변경이력:
   * - 2025-11-04 - Props 기반 데이터 주입 지원 추가
   * - 2025-11-04 - Hardcoded fallback 제거, 빈 배열로 변경
   */
  const actualMasterHourlyCpuData = metricsData?.masterHourlyCpuData || [];
  const actualWorkerHourlyCpuData = metricsData?.workerHourlyCpuData || [];
  const actualMasterHourlyMemoryData = metricsData?.masterHourlyMemoryData || [];
  const actualWorkerHourlyMemoryData = metricsData?.workerHourlyMemoryData || [];
  const actualMasterCpuData = metricsData?.masterCpuData || [];
  const actualWorkerCpuData = metricsData?.workerCpuData || [];
  const actualMasterMemoryData = metricsData?.masterMemoryData || [];
  const actualWorkerMemoryData = metricsData?.workerMemoryData || [];
  const actualMasterPodsData = metricsData?.masterPodsData || [];
  const actualWorkerPodsData = metricsData?.workerPodsData || [];

  // 🎯 목적: selectedNode와 variant에 따라 다른 데이터 선택
  const getNodeData = (masterData: any[], workerData: any[], noData: any[], overviewData?: any[]) => {
    if (variant === "no-data") return noData;
    if (variant === "overview" && overviewData) return overviewData;
    return selectedNode === "master" ? masterData : workerData;
  };

  // 🎯 목적: selectedMetric(CPU/Memory)에 따라 시간별 데이터 선택 (Props 데이터 우선 사용)
  const currentHourlyData = getNodeData(
    selectedMetric === "cpu" ? actualMasterHourlyCpuData : actualMasterHourlyMemoryData,
    selectedMetric === "cpu" ? actualWorkerHourlyCpuData : actualWorkerHourlyMemoryData,
    selectedMetric === "cpu" ? noDataHourlyCpuData : noDataHourlyMemoryData,
  );
  const currentCpuData = getNodeData(actualMasterCpuData, actualWorkerCpuData, noDataCpuData, overviewPodsData);
  const currentMemoryData = getNodeData(
    actualMasterMemoryData,
    actualWorkerMemoryData,
    noDataMemoryData,
    overviewDeploymentsData,
  );
  const currentPodsData = getNodeData(
    actualMasterPodsData,
    actualWorkerPodsData,
    noDataPodsData,
    overviewDaemonSetsData,
  );
  // TODO: Network, Storage, Events, Health 데이터는 향후 실제 메트릭으로 교체 필요
  const currentNetworkData = getNodeData([], [], [], overviewStatefulSetsData);
  const currentStorageData = getNodeData([], [], [], overviewReplicaSetsData);
  const currentEventsData = getNodeData([], [], [], overviewJobsData);
  const currentHealthData = getNodeData([], [], [], overviewCronJobsData);

  // 🎯 목적: variant에 따라 '--' 또는 실제 값 표시
  const formatValue = (value: string | number) => {
    return variant === "no-data" ? "--" : value;
  };

  // 🎯 목적: 현재 선택된 노드의 실제 데이터 값 추출
  const getCpuValues = () => {
    const data =
      variant === "no-data" ? noDataCpuData : selectedNode === "master" ? actualMasterCpuData : actualWorkerCpuData;
    return {
      usage: data.find((d: MetricDataPoint) => d.metric === "usage")?.value || 0,
      requests: data.find((d: MetricDataPoint) => d.metric === "requests")?.value || 0,
      limits: data.find((d: MetricDataPoint) => d.metric === "limits")?.value || 0,
      allocatable: data.find((d: MetricDataPoint) => d.metric === "allocatable")?.value || 0,
      capacity: data.find((d: MetricDataPoint) => d.metric === "capacity")?.value || 0,
    };
  };

  const getMemoryValues = () => {
    const data =
      variant === "no-data"
        ? noDataMemoryData
        : selectedNode === "master"
          ? actualMasterMemoryData
          : actualWorkerMemoryData;
    return {
      usage: data.find((d: MetricDataPoint) => d.metric === "usage")?.value || 0,
      requests: data.find((d: MetricDataPoint) => d.metric === "requests")?.value || 0,
      limits: data.find((d: MetricDataPoint) => d.metric === "limits")?.value || 0,
      allocatable: data.find((d: MetricDataPoint) => d.metric === "allocatable")?.value || 0,
      capacity: data.find((d: MetricDataPoint) => d.metric === "capacity")?.value || 0,
    };
  };

  const getPodsValues = () => {
    const data =
      variant === "no-data" ? noDataPodsData : selectedNode === "master" ? actualMasterPodsData : actualWorkerPodsData;
    return {
      usage: data.find((d: MetricDataPoint) => d.metric === "usage")?.value || 0,
      allocatable: data.find((d: MetricDataPoint) => d.metric === "allocatable")?.value || 0,
      capacity: data.find((d: MetricDataPoint) => d.metric === "capacity")?.value || 0,
    };
  };

  const cpuValues = getCpuValues();
  const memoryValues = getMemoryValues();
  const podsValues = getPodsValues();

  // 🎯 목적: 메모리 값을 적절한 단위로 포맷팅
  const formatMemoryValue = (value: number) => {
    if (variant === "no-data") return "--";
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}GiB`;
    }
    return `${value.toFixed(1)}MiB`;
  };

  /**
   * 🎯 목적: 차트 데이터 범위에 따른 Y축 domain 동적 계산
   * 📝 주의: 작은 값일 때 중복 tick 방지를 위해 세밀한 스케일 적용
   * @param data - 시간별 데이터 포인트 배열
   * @returns [min, max] Y축 범위
   */
  const calculateYAxisDomain = (data: HourlyDataPoint[]): [number, number] => {
    const values = data.map((d) => d.value).filter((v) => v > 0);
    if (values.length === 0) return [0, 1];

    const maxValue = Math.max(...values);

    // 작은 값일 때 더 세밀한 스케일 (0.1 단위 겹침 방지)
    if (maxValue < 1) {
      return [0, Math.ceil(maxValue * 10) / 10 + 0.1];
    }

    // 일반적인 경우 10% 여유 추가
    return [0, Math.ceil(maxValue * 1.1)];
  };

  /**
   * 🎯 목적: Y축과 툴팁에서 사용할 통일된 값 포맷팅 함수
   * 📝 주의: CPU/Memory에 따라 다른 단위 적용
   * @param value - 포맷팅할 숫자 값
   * @param metric - 메트릭 타입 ('cpu' | 'memory')
   * @returns 포맷팅된 문자열 (예: "0.5m", "1.2", "512MiB", "2.5GiB")
   */
  const formatChartValue = (value: number, metric: "cpu" | "memory"): string => {
    if (value === 0) return "0";

    if (metric === "cpu") {
      // CPU: 작은 값은 millicores(m), 큰 값은 cores
      if (value < 0.01) return `${(value * 1000).toFixed(1)} m`;
      if (value < 1) return `${(value * 1000).toFixed(0)} m`;
      return value.toFixed(2);
    } else {
      // Memory: MiB/GiB 자동 변환
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)} GiB`;
      }
      return `${value.toFixed(0)} MiB`;
    }
  };

  // 🎯 목적: 시간별 사용량 차트 설정 (CPU/Memory에 따라 다른 색상)
  const hourlyChartConfig = {
    value: {
      label: "Hourly Usage",
      color: selectedMetric === "cpu" ? "var(--chart-1)" : "var(--chart-3)",
    },
  } satisfies ChartConfig;

  // 🎯 목적: CPU Radial 차트 설정
  const cpuChartConfig = {
    value: {
      label: "CPU Value",
    },
    usage: {
      label: "Usage",
      color: "var(--chart-1)",
    },
    requests: {
      label: "Requests",
      color: "var(--chart-2)",
    },
    limits: {
      label: "Limits",
      color: "var(--chart-3)",
    },
    allocatable: {
      label: "Allocatable",
      color: "var(--chart-4)",
    },
    capacity: {
      label: "Capacity",
      color: "var(--chart-5)",
    },
  } satisfies ChartConfig;

  // 🎯 목적: Memory Radial 차트 설정
  const memoryChartConfig = {
    value: {
      label: "Memory Value",
    },
    usage: {
      label: "Usage",
      color: "var(--chart-1)",
    },
    requests: {
      label: "Requests",
      color: "var(--chart-2)",
    },
    limits: {
      label: "Limits",
      color: "var(--chart-3)",
    },
    allocatable: {
      label: "Allocatable",
      color: "var(--chart-4)",
    },
    capacity: {
      label: "Capacity",
      color: "var(--chart-5)",
    },
  } satisfies ChartConfig;

  // 🎯 목적: Pods Radial 차트 설정
  const podsChartConfig = {
    value: {
      label: "Pods Value",
    },
    usage: {
      label: "Usage",
      color: "var(--chart-1)",
    },
    allocatable: {
      label: "Allocatable",
      color: "var(--chart-2)",
    },
    capacity: {
      label: "Capacity",
      color: "var(--chart-3)",
    },
  } satisfies ChartConfig;

  // 💡 주석 처리: 현재 사용하지 않는 차트 설정들 (향후 확장 시 활성화)
  // 🎯 목적: Network Radial 차트 설정
  // const networkChartConfig = {
  //   value: {
  //     label: "Network Value",
  //   },
  //   inbound: {
  //     label: "Inbound",
  //     color: "var(--chart-1)",
  //   },
  //   outbound: {
  //     label: "Outbound",
  //     color: "var(--chart-2)",
  //   },
  //   total: {
  //     label: "Total",
  //     color: "var(--chart-3)",
  //   },
  // } satisfies ChartConfig;

  // 🎯 목적: Storage Radial 차트 설정
  // const storageChartConfig = {
  //   value: {
  //     label: "Storage Value",
  //   },
  //   used: {
  //     label: "Used",
  //     color: "var(--chart-1)",
  //   },
  //   available: {
  //     label: "Available",
  //     color: "var(--chart-2)",
  //   },
  //   total: {
  //     label: "Total",
  //     color: "var(--chart-3)",
  //   },
  // } satisfies ChartConfig;

  // 🎯 목적: Events Radial 차트 설정
  // const eventsChartConfig = {
  //   value: {
  //     label: "Events Value",
  //   },
  //   normal: {
  //     label: "Normal",
  //     color: "var(--chart-1)",
  //   },
  //   warning: {
  //     label: "Warning",
  //     color: "var(--chart-2)",
  //   },
  //   error: {
  //     label: "Error",
  //     color: "var(--chart-3)",
  //   },
  // } satisfies ChartConfig;

  // 🎯 목적: Health Radial 차트 설정
  // const healthChartConfig = {
  //   value: {
  //     label: "Health Value",
  //   },
  //   ready: {
  //     label: "Ready",
  //     color: "var(--chart-1)",
  //   },
  //   notready: {
  //     label: "Not Ready",
  //     color: "var(--chart-2)",
  //   },
  //   total: {
  //     label: "Total",
  //     color: "var(--chart-3)",
  //   },
  // } satisfies ChartConfig;

  // 🎯 목적: Overview용 공통 차트 설정 (Succeeded/Running/Pending)
  const overviewChartConfig = {
    value: {
      label: "Status Value",
    },
    succeeded: {
      label: "Succeeded",
      color: "var(--chart-1)",
    },
    running: {
      label: "Running",
      color: "var(--chart-2)",
    },
    pending: {
      label: "Pending",
      color: "var(--chart-3)",
    },
  } satisfies ChartConfig;

  // 🎯 목적: Overview용 공통 범례 컴포넌트
  const OverviewLegend = ({ data }: { data: any[] }) => (
    <>
      <Item className="gap-1.5 px-0.5 py-0 text-sm">
        <ItemMedia variant="icon" className="h-2 w-2">
          <div className="bg-chart-1 h-1 w-1 rounded-full" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
            Succeeded: {data.find((d) => d.metric === "succeeded")?.value || 0}
          </ItemTitle>
        </ItemContent>
      </Item>
      <Item className="gap-1.5 px-0.5 py-0 text-sm">
        <ItemMedia variant="icon" className="h-2 w-2">
          <div className="bg-chart-2 h-1 w-1 rounded-full" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
            Running: {data.find((d) => d.metric === "running")?.value || 0}
          </ItemTitle>
        </ItemContent>
      </Item>
      <Item className="gap-1.5 px-0.5 py-0 text-sm">
        <ItemMedia variant="icon" className="h-2 w-2">
          <div className="bg-chart-3 h-1 w-1 rounded-full" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
            Pending: {data.find((d) => d.metric === "pending")?.value || 0}
          </ItemTitle>
        </ItemContent>
      </Item>
    </>
  );

  return (
    <div className={`bg-background min-h-screen w-full p-5 ${className || ""}`}>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
        {/* 헤더와 차트 영역 */}
        <div className="flex flex-col gap-3">
          {/* 헤더 영역 */}
          <div className="flex items-center justify-between">
            <h1 className="text-foreground text-lg leading-none font-normal">{"{Menuname}"}</h1>

            {/* Overview에서는 Namespace 드롭다운, 다른 스토리에서는 Master/Worker 노드 토글 */}
            {variant === "overview" ? (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="outline" className="min-w-[180px]">
                    Namespace: {selectedNamespace}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="start">
                  <DropdownMenuLabel>All Namespaces</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={selectedNamespace === "default"}
                    onCheckedChange={() => setSelectedNamespace("default")}
                  >
                    default
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={selectedNamespace === "cilium-secrets"}
                    onCheckedChange={() => setSelectedNamespace("cilium-secrets")}
                  >
                    cilium-secrets
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={selectedNamespace === "kube-node-lease"}
                    onCheckedChange={() => setSelectedNamespace("kube-node-lease")}
                  >
                    kube-node-lease
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={selectedNamespace === "kube-public"}
                    onCheckedChange={() => setSelectedNamespace("kube-public")}
                  >
                    kube-public
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <ToggleGroup
                type="single"
                value={selectedNode}
                onValueChange={(value) => value && setSelectedNode(value)}
                variant="outline"
                size="default"
                className="w-[360px]"
              >
                <ToggleGroupItem value="master" aria-label="Master Nodes" className="flex-1">
                  Master Nodes
                </ToggleGroupItem>
                <ToggleGroupItem value="worker" aria-label="Worker Nodes" className="flex-1">
                  Worker Nodes
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>

          {/* 차트 영역 - 반응형 레이아웃 (900px 이하에서 세로 정렬) */}
          <div
            className={`flex flex-col rounded-md lg:flex-row ${variant === "overview" ? "" : "border-input border"}`}
          >
            {/* 왼쪽: 시간별 사용량 차트 (overview에서는 숨김) */}
            {variant !== "overview" && (
              <div className="border-input flex min-w-0 flex-1 flex-col items-start gap-4 border-b bg-transparent p-4 lg:border-r lg:border-b-0">
                {/* 제목과 토글 영역 */}
                <div className="flex items-center justify-between gap-5 self-stretch">
                  <h3 className="text-foreground text-sm leading-none font-medium">
                    Hourly {selectedMetric === "cpu" ? "CPU" : "Memory"} usage
                  </h3>

                  {/* CPU/Memory 토글 - shadcn/ui ToggleGroup */}
                  <ToggleGroup
                    type="single"
                    value={selectedMetric}
                    onValueChange={(value) => value && setSelectedMetric(value as "cpu" | "memory")}
                    variant="outline"
                    size="sm"
                    className="w-[160px]"
                  >
                    <ToggleGroupItem value="cpu" aria-label="CPU" className="flex-1">
                      CPU
                    </ToggleGroupItem>
                    <ToggleGroupItem value="memory" aria-label="Memory" className="flex-1">
                      Memory
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* 차트 래퍼 */}
                <div className="flex flex-grow flex-col items-start gap-2.5 self-stretch">
                  <ChartContainer config={hourlyChartConfig} className="h-[340px] w-full">
                    <AreaChart
                      accessibilityLayer
                      data={currentHourlyData}
                      margin={{
                        left: 6,
                        right: 12,
                        bottom: 24,
                      }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="hour"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => value}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        domain={calculateYAxisDomain(currentHourlyData)}
                        tickFormatter={(value) => formatChartValue(value, selectedMetric)}
                      />
                      <Tooltip
                        content={
                          <ChartTooltipContent formatter={(value) => formatChartValue(Number(value), selectedMetric)} />
                        }
                      />
                      {/* 🎯 ChartTooltip 표시: 호버 시 값 확인 */}
                      <Area
                        dataKey="value"
                        name="value"
                        type="monotone"
                        fill={selectedMetric === "cpu" ? "var(--chart-1)" : "var(--chart-3)"}
                        fillOpacity={0.4}
                        stroke={selectedMetric === "cpu" ? "var(--chart-1)" : "var(--chart-3)"}
                        isAnimationActive={false}
                      />
                      <Legend content={<ChartLegendContent />} />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>
            )}

            {/* 오른쪽: Usage Type Distribution Chart */}
            <div
              className={`flex min-w-0 flex-1 flex-col items-start ${variant === "overview" ? "gap-0" : "gap-2"} self-stretch ${variant === "overview" ? "" : "p-4"}`}
            >
              {/* 제목 (overview에서는 숨김) */}
              {variant !== "overview" && (
                <div className="flex h-8 items-center gap-2.5 self-stretch">
                  <h3 className="text-foreground text-sm leading-none font-medium">Usage Type Distribution Chart</h3>
                </div>
              )}

              {/* 카드들 */}
              <div
                className={`min-w-0 flex-1 self-stretch ${variant === "overview" ? "grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2" : "flex items-stretch gap-4"}`}
              >
                {/* CPU Card */}
                <Card
                  className={`bg-background flex flex-col gap-1 rounded-md p-3 ${variant === "overview" ? "" : "min-w-0 flex-1"}`}
                >
                  {variant === "overview" ? (
                    <CardHeader
                      className="items-center gap-0 p-0 cursor-pointer transition-colors hover:text-status-info"
                      onClick={() => handleNavigate("/pods")}
                    >
                      <span className="text-base font-semibold hover:underline">Pods (18)</span>
                    </CardHeader>
                  ) : (
                    <CardHeader className="items-center gap-0 p-0">
                      <CardTitle className="text-base">CPU</CardTitle>
                    </CardHeader>
                  )}
                  <CardContent className="flex-1 p-0 pb-2">
                    <ChartContainer
                      config={variant === "overview" ? overviewChartConfig : cpuChartConfig}
                      className="mx-auto aspect-square max-h-[120px]"
                    >
                      {variant === "overview" ? (
                        <PieChart>
                          {/* 🎯 ChartTooltip 표시: 호버 시 값 확인 */}
                          <Pie data={currentCpuData} dataKey="value" nameKey="metric" innerRadius={20} />
                        </PieChart>
                      ) : (
                        <RadialBarChart data={currentCpuData} innerRadius="30%" outerRadius="90%">
                          {/* 🎯 ChartTooltip 표시: 호버 시 값 확인 */}
                          <Tooltip content={<ChartTooltipContent nameKey="metric" />} />
                          <RadialBar dataKey="value" background />
                        </RadialBarChart>
                      )}
                    </ChartContainer>
                  </CardContent>
                  <CardFooter className="p-0">
                    <ItemGroup className="w-full gap-0.5">
                      {variant === "overview" ? (
                        <OverviewLegend data={currentCpuData} />
                      ) : (
                        <>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-1 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Usage: {formatValue(cpuValues.usage.toFixed(2))}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-2 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Requests: {formatValue(cpuValues.requests.toFixed(2))}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-3 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Limits: {formatValue(cpuValues.limits.toFixed(2))}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-4 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Allocatable Capacity: {formatValue(cpuValues.allocatable.toFixed(2))}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-5 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Capacity: {formatValue(cpuValues.capacity.toFixed(2))}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                        </>
                      )}
                    </ItemGroup>
                  </CardFooter>
                </Card>

                {/* Memory Card */}
                <Card
                  className={`bg-background flex flex-col gap-1 rounded-md p-3 ${variant === "overview" ? "" : "min-w-0 flex-1"}`}
                >
                  {variant === "overview" ? (
                    <CardHeader
                      className="items-center gap-0 p-0 cursor-pointer transition-colors hover:text-status-info"
                      onClick={() => handleNavigate("/deployments")}
                    >
                      <span className="text-base font-semibold hover:underline">Deployments (4)</span>
                    </CardHeader>
                  ) : (
                    <CardHeader className="items-center gap-0 p-0">
                      <CardTitle className="text-base">Memory</CardTitle>
                    </CardHeader>
                  )}
                  <CardContent className="flex-1 p-0 pb-2">
                    <ChartContainer
                      config={variant === "overview" ? overviewChartConfig : memoryChartConfig}
                      className="mx-auto aspect-square max-h-[120px]"
                    >
                      {variant === "overview" ? (
                        <PieChart>
                          {/* 🎯 ChartTooltip 표시: 호버 시 값 확인 */}
                          <Pie data={currentMemoryData} dataKey="value" nameKey="metric" innerRadius={20} />
                        </PieChart>
                      ) : (
                        <RadialBarChart data={currentMemoryData} innerRadius="30%" outerRadius="90%">
                          {/* ChartTooltip 제거: CardFooter에 값 표시됨 */}
                          <Tooltip content={<ChartTooltipContent nameKey="metric" />} />
                          <RadialBar dataKey="value" background />
                        </RadialBarChart>
                      )}
                    </ChartContainer>
                  </CardContent>
                  <CardFooter className="p-0">
                    <ItemGroup className="w-full gap-0.5">
                      {variant === "overview" ? (
                        <OverviewLegend data={currentMemoryData} />
                      ) : (
                        <>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-1 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Usage: {formatMemoryValue(memoryValues.usage)}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-2 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Requests: {formatMemoryValue(memoryValues.requests)}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-3 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Limits: {formatMemoryValue(memoryValues.limits)}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-4 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Allocatable Capacity: {formatMemoryValue(memoryValues.allocatable)}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-5 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Capacity: {formatMemoryValue(memoryValues.capacity)}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                        </>
                      )}
                    </ItemGroup>
                  </CardFooter>
                </Card>

                {/* Pods Card */}
                <Card
                  className={`bg-background flex flex-col gap-1 rounded-md p-3 ${variant === "overview" ? "" : "min-w-0 flex-1"}`}
                >
                  {variant === "overview" ? (
                    <CardHeader
                      className="items-center gap-0 p-0 cursor-pointer transition-colors hover:text-status-info"
                      onClick={() => handleNavigate("/daemon-sets")}
                    >
                      <span className="text-base font-semibold hover:underline">Daemon Sets (4)</span>
                    </CardHeader>
                  ) : (
                    <CardHeader className="items-center gap-0 p-0">
                      <CardTitle className="text-base">Pods</CardTitle>
                    </CardHeader>
                  )}
                  <CardContent className="flex-1 p-0 pb-2">
                    <ChartContainer
                      config={variant === "overview" ? overviewChartConfig : podsChartConfig}
                      className="mx-auto aspect-square max-h-[120px]"
                    >
                      {variant === "overview" ? (
                        <PieChart>
                          {/* ChartTooltip 제거: CardFooter에 값 표시됨 */}
                          <Pie data={currentPodsData} dataKey="value" nameKey="metric" innerRadius={20} />
                        </PieChart>
                      ) : (
                        <RadialBarChart data={currentPodsData} innerRadius="30%" outerRadius="90%">
                          {/* ChartTooltip 제거: CardFooter에 값 표시됨 */}
                          <Tooltip content={<ChartTooltipContent nameKey="metric" />} />
                          <RadialBar dataKey="value" background />
                        </RadialBarChart>
                      )}
                    </ChartContainer>
                  </CardContent>
                  <CardFooter className="p-0">
                    <ItemGroup className="w-full gap-0.5">
                      {variant === "overview" ? (
                        <OverviewLegend data={currentPodsData} />
                      ) : (
                        <>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-1 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Usage: {formatValue(podsValues.usage.toString())}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-2 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Allocatable: {formatValue(podsValues.allocatable.toString())}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                          <Item className="gap-1.5 px-0.5 py-0 text-sm">
                            <ItemMedia variant="icon" className="h-2 w-2">
                              <div className="bg-chart-3 h-1 w-1 rounded-full" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle className="text-muted-foreground text-sm leading-normal font-normal">
                                Capacity: {formatValue(podsValues.capacity.toString())}
                              </ItemTitle>
                            </ItemContent>
                          </Item>
                        </>
                      )}
                    </ItemGroup>
                  </CardFooter>
                </Card>

                {/* Network Card - Overview에서만 표시 */}
                {variant === "overview" && (
                  <Card className="bg-background flex flex-col gap-1 rounded-md p-3">
                    <CardHeader
                      className="items-center gap-0 p-0 cursor-pointer transition-colors hover:text-status-info"
                      onClick={() => handleNavigate("/stateful-sets")}
                    >
                      <span className="text-base font-semibold hover:underline">Stateful Sets (0)</span>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 pb-2">
                      <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                        <PieChart>
                          {/* ChartTooltip 제거: CardFooter에 값 표시됨 */}
                          <Pie data={currentNetworkData} dataKey="value" nameKey="metric" innerRadius={20} />
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                    <CardFooter className="p-0">
                      <ItemGroup className="w-full gap-0.5">
                        <OverviewLegend data={currentNetworkData} />
                      </ItemGroup>
                    </CardFooter>
                  </Card>
                )}

                {/* Storage Card - Overview에서만 표시 */}
                {variant === "overview" && (
                  <Card className="bg-background flex flex-col gap-1 rounded-md p-3">
                    <CardHeader
                      className="items-center gap-0 p-0 cursor-pointer transition-colors hover:text-status-info"
                      onClick={() => handleNavigate("/replica-sets")}
                    >
                      <span className="text-base font-semibold hover:underline">Replica Sets (4)</span>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 pb-2">
                      <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                        <PieChart>
                          {/* ChartTooltip 제거: CardFooter에 값 표시됨 */}
                          <Pie data={currentStorageData} dataKey="value" nameKey="metric" innerRadius={20} />
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                    <CardFooter className="p-0">
                      <ItemGroup className="w-full gap-0.5">
                        <OverviewLegend data={currentStorageData} />
                      </ItemGroup>
                    </CardFooter>
                  </Card>
                )}

                {/* Events Card - Overview에서만 표시 */}
                {variant === "overview" && (
                  <Card className="bg-background flex flex-col gap-1 rounded-md p-3">
                    <CardHeader
                      className="items-center gap-0 p-0 cursor-pointer transition-colors hover:text-status-info"
                      onClick={() => handleNavigate("/jobs")}
                    >
                      <span className="text-base font-semibold hover:underline">Jobs (1)</span>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 pb-2">
                      <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                        <PieChart>
                          {/* ChartTooltip 제거: CardFooter에 값 표시됨 */}
                          <Pie data={currentEventsData} dataKey="value" nameKey="metric" innerRadius={20} />
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                    <CardFooter className="p-0">
                      <ItemGroup className="w-full gap-0.5">
                        <OverviewLegend data={currentEventsData} />
                      </ItemGroup>
                    </CardFooter>
                  </Card>
                )}

                {/* Health Card - Overview에서만 표시 */}
                {variant === "overview" && (
                  <Card className="bg-background flex flex-col gap-1 rounded-md p-3">
                    <CardHeader
                      className="items-center gap-0 p-0 cursor-pointer transition-colors hover:text-status-info"
                      onClick={() => handleNavigate("/cron-jobs")}
                    >
                      <span className="text-base font-semibold hover:underline">Cron Jobs (0)</span>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 pb-2">
                      <ChartContainer config={overviewChartConfig} className="mx-auto aspect-square max-h-[120px]">
                        <PieChart>
                          {/* ChartTooltip 제거: CardFooter에 값 표시됨 */}
                          <Pie data={currentHealthData} dataKey="value" nameKey="metric" innerRadius={20} />
                        </PieChart>
                      </ChartContainer>
                    </CardContent>
                    <CardFooter className="p-0">
                      <ItemGroup className="w-full gap-0.5">
                        <OverviewLegend data={currentHealthData} />
                      </ItemGroup>
                    </CardFooter>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 경고 테이블 또는 Empty 상태 (overview에서는 숨김) */}
        {variant !== "overview" && (
          <div className="flex flex-1 flex-col items-start gap-1 self-stretch">
            {variant === "no-data" ? (
              <Empty className="min-h-[300px] w-full">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BadgeCheck className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No issues found</EmptyTitle>
                  <EmptyDescription>Everything is fine in the cluster</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                {/* 헤더 - 🎯 THEME-024: Semantic color for warnings */}
                <div className="flex items-center gap-1">
                  <TriangleAlert className="h-4 w-4 text-status-warning" />
                  <span className="text-lg leading-none font-normal text-status-warning">Warnings</span>
                  <span className="text-muted-foreground text-base leading-6 font-light">(3)</span>
                </div>

                {/* 테이블 */}
                <div className="flex flex-col items-start self-stretch">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="border-border h-[40px]">
                        <TableHead className="text-foreground w-1/5 text-sm leading-5 font-medium">Head Text</TableHead>
                        <TableHead className="text-foreground w-1/5 text-sm leading-5 font-medium">Head Text</TableHead>
                        <TableHead className="text-foreground w-1/5 text-sm leading-5 font-medium">Head Text</TableHead>
                        <TableHead className="text-foreground w-1/5 text-sm leading-5 font-medium">Head Text</TableHead>
                        <TableHead className="text-foreground w-1/5 text-sm leading-5 font-medium">Head Text</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* TODO: 실제 경고 데이터로 교체 필요 */}
                      {[].map((row: any) => (
                        <TableRow key={row.id} className="border-border h-[52px]">
                          <TableCell className="text-foreground text-sm leading-5 font-normal">{row.col1}</TableCell>
                          <TableCell className="text-foreground text-sm leading-5 font-normal">{row.col2}</TableCell>
                          <TableCell className="text-foreground text-sm leading-5 font-normal">{row.col3}</TableCell>
                          <TableCell className="text-foreground text-sm leading-5 font-normal">{row.col4}</TableCell>
                          <TableCell>
                            {/* 🎯 THEME-040: Semantic 색상 시스템 적용 */}
                            {row.isVerified ? (
                              <Badge variant="secondary" className="bg-semantic-running text-semantic-running-text">
                                <BadgeCheck className="h-3 w-3" />
                                {row.badge}
                              </Badge>
                            ) : (
                              <Badge variant="default">{row.badge}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Caption */}
                <div className="flex flex-shrink-0 items-center justify-center gap-2.5 self-stretch pt-4">
                  <span className="text-muted-foreground flex-1 text-center text-sm leading-5 font-normal">
                    Caption text
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
