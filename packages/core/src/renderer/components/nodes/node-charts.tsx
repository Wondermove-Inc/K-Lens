/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Node 메트릭 차트 컴포넌트 (shadcn Chart 기반)
 *
 * @remarks
 * - Chart.js → shadcn Chart (recharts) 전환
 * - CPU/Memory/Disk/Pods 메트릭을 AreaChart로 시각화
 * - 각 탭마다 Usage와 Capacity를 함께 표시
 *
 * 📝 주의사항:
 * - Prometheus 메트릭 데이터 형식: [timestamp, value][]
 * - recharts 형식으로 변환 필요: { time: number, [metric]: number }[]
 *
 * 🔄 변경이력:
 * - 2025-11-13: Chart.js → shadcn Chart (recharts) 전환 (Pod 패턴 참고)
 */

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from "@skuberplus/storybook-shadcn/src/components/ui/chart";
import { bytesToUnits } from "@skuberplus/utilities";
import { mapValues } from "lodash";
import { observer } from "mobx-react";
import React, { useContext } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { isMetricsEmpty, type MetricResult, normalizeMetrics } from "../../../common/k8s-api/endpoints/metrics.api";
import { ResourceMetricsContext } from "../resource-metrics";
import { NoMetrics } from "../resource-metrics/no-metrics";

import type { ChartConfig } from "@skuberplus/storybook-shadcn/src/components/ui/chart";

export interface NodeChartsProps {}

/**
 * 🎯 목적: Unix timestamp를 시간 형식으로 변환
 * @param timestamp - Unix timestamp (초 단위)
 * @returns HH:MM 형식 문자열
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * 🎯 목적: Tooltip 라벨을 안전하게 시간 문자열로 변환
 * @param label - Recharts Tooltip 라벨 값
 * @returns HH:MM 형식 문자열 또는 "--"
 */
function formatTooltipTime(label: unknown): string {
  const value = typeof label === "number" ? label : Number(label);

  if (!Number.isFinite(value)) {
    return "--";
  }

  return formatTime(value);
}

/**
 * 🎯 목적: CPU 값을 Kubernetes 표준 표기법으로 변환
 * @param value - CPU 값 (cores 단위)
 * @returns 1코어 미만은 밀리코어(m), 1코어 이상은 소수점 2자리
 */
function formatCPU(value: number): string {
  if (value === 0) return "0";
  if (value < 1) {
    const milliCores = value * 1000;
    if (milliCores >= 1) return `${Math.round(milliCores)} m`;
    if (milliCores >= 0.1) return `${milliCores.toFixed(1)} m`;
    return `${milliCores.toFixed(2)} m`;
  }
  return value.toFixed(2);
}

/**
 * 🎯 목적: Memory 값을 읽기 쉬운 형식으로 변환
 * @param value - Memory 값 (bytes 단위)
 * @returns KiB/MiB/GiB 형식 문자열
 */
function formatMemory(value: number): string {
  return bytesToUnits(value, { precision: 1 });
}

/**
 * 🎯 목적: Pods 개수를 정수로 표시
 * @param value - Pod 개수
 * @returns 정수 문자열
 */
function formatPods(value: number): string {
  return Math.round(value).toString();
}

/**
 * 🎯 목적: IOPS 값을 읽기 쉬운 형식으로 변환
 * @param value - IOPS 값 (ops/sec)
 * @returns ops/s 형식 문자열
 *
 * 🔄 변경이력: 2026-01-13 - Disk IOPS 차트 지원을 위해 추가
 */
function formatIOPS(value: number): string {
  if (value === 0) return "0";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(1);
}

/**
 * 🎯 목적: Latency 값을 읽기 쉬운 형식으로 변환
 * @param value - Latency 값 (ms 단위)
 * @returns ms/us/s 형식 문자열
 *
 * 🔄 변경이력: 2026-01-14 - Disk Latency 이중 축 차트 지원을 위해 추가
 */
function formatLatency(value: number): string {
  if (value === 0) return "0";
  if (value < 1) return `${(value * 1000).toFixed(0)} μs`; // 마이크로초
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`; // 초
  return `${value.toFixed(1)} ms`;
}

/**
 * 🎯 목적: BPS (bits per second) 값을 읽기 쉬운 형식으로 변환
 * @param value - BPS 값
 * @returns Gbps/Mbps/Kbps/bps 형식 문자열
 *
 * 🔄 변경이력: 2026-01-14 - Network BPS/PPS 듀얼 축 차트 지원을 위해 추가
 */
function formatBps(value: number): string {
  if (value === 0) return "0";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} Gbps`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} Mbps`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)} Kbps`;
  return `${value.toFixed(0)} bps`;
}

/**
 * 🎯 목적: PPS (packets per second) 값을 읽기 쉬운 형식으로 변환
 * @param value - PPS 값
 * @returns M pps/K pps/pps 형식 문자열
 *
 * 🔄 변경이력: 2026-01-14 - Network BPS/PPS 듀얼 축 차트 지원을 위해 추가
 */
function formatPps(value: number): string {
  if (value === 0) return "0";
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M pps`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K pps`;
  return `${value.toFixed(0)} pps`;
}

/**
 * 🎯 목적: 두 개의 메트릭을 recharts 형식으로 변환 및 병합
 *
 * @param metric1 - 첫 번째 메트릭 데이터 [timestamp, value][]
 * @param metric2 - 두 번째 메트릭 데이터 [timestamp, value][]
 * @param key1 - 첫 번째 메트릭 키 (예: "usage")
 * @param key2 - 두 번째 메트릭 키 (예: "capacity")
 * @returns recharts 형식의 데이터 배열
 */
function convertToChartData(
  metric1: Array<[number, string]>,
  metric2: Array<[number, string]>,
  key1: string = "usage",
  key2: string = "capacity",
): Array<Record<string, number>> {
  // 🎯 모든 timestamp 수집
  // 🛡️ null/undefined 방어 처리 - Prometheus 미설치 클러스터에서 크래시 방지
  const timestampMap = new Map<number, Record<string, number>>();

  // 첫 번째 메트릭 처리
  (metric1 ?? []).forEach(([time, value]) => {
    if (!timestampMap.has(time)) {
      timestampMap.set(time, { time });
    }
    timestampMap.get(time)![key1] = parseFloat(value);
  });

  // 두 번째 메트릭 처리
  (metric2 ?? []).forEach(([time, value]) => {
    if (!timestampMap.has(time)) {
      timestampMap.set(time, { time });
    }
    timestampMap.get(time)![key2] = parseFloat(value);
  });

  // 정렬하여 반환
  return Array.from(timestampMap.values()).sort((a, b) => a.time - b.time);
}

/**
 * 🎯 목적: Network BPS/PPS 메트릭을 recharts 형식으로 변환 (듀얼 축 차트용)
 *
 * @param receiveBps - Receive BPS 데이터
 * @param transmitBps - Transmit BPS 데이터
 * @param receivePps - Receive PPS 데이터
 * @param transmitPps - Transmit PPS 데이터
 * @returns recharts 형식의 데이터 배열
 *
 * 🔄 변경이력: 2026-01-14 - Network BPS/PPS 듀얼 축 차트 지원을 위해 추가
 */
function convertNetworkToChartData(
  receiveBps: Array<[number, string]>,
  transmitBps: Array<[number, string]>,
  receivePps: Array<[number, string]>,
  transmitPps: Array<[number, string]>,
): Array<Record<string, number>> {
  const timestampMap = new Map<number, Record<string, number>>();

  // Receive BPS
  (receiveBps ?? []).forEach(([time, value]) => {
    if (!timestampMap.has(time)) {
      timestampMap.set(time, { time });
    }
    timestampMap.get(time)!.receiveBps = parseFloat(value);
  });

  // Transmit BPS
  (transmitBps ?? []).forEach(([time, value]) => {
    if (!timestampMap.has(time)) {
      timestampMap.set(time, { time });
    }
    timestampMap.get(time)!.transmitBps = parseFloat(value);
  });

  // Receive PPS
  (receivePps ?? []).forEach(([time, value]) => {
    if (!timestampMap.has(time)) {
      timestampMap.set(time, { time });
    }
    timestampMap.get(time)!.receivePps = parseFloat(value);
  });

  // Transmit PPS
  (transmitPps ?? []).forEach(([time, value]) => {
    if (!timestampMap.has(time)) {
      timestampMap.set(time, { time });
    }
    timestampMap.get(time)!.transmitPps = parseFloat(value);
  });

  return Array.from(timestampMap.values()).sort((a, b) => a.time - b.time);
}

/**
 * 🎯 목적: 4개의 메트릭을 recharts 형식으로 변환 및 병합 (이중 축 차트용)
 *
 * @param iopsRead - IOPS Read 데이터
 * @param iopsWrite - IOPS Write 데이터
 * @param latencyRead - Latency Read 데이터
 * @param latencyWrite - Latency Write 데이터
 * @returns recharts 형식의 데이터 배열
 *
 * 🔄 변경이력: 2026-01-14 - 이중 축 차트 (IOPS + Latency) 지원을 위해 추가
 */
function convertToDualAxisChartData(
  iopsRead: Array<[number, string]>,
  iopsWrite: Array<[number, string]>,
  latencyRead: Array<[number, string]>,
  latencyWrite: Array<[number, string]>,
): Array<Record<string, number>> {
  const timestampMap = new Map<number, Record<string, number>>();

  // IOPS Read
  (iopsRead ?? []).forEach(([time, value]) => {
    if (!timestampMap.has(time)) {
      timestampMap.set(time, { time });
    }
    timestampMap.get(time)!.iopsRead = parseFloat(value);
  });

  // IOPS Write
  (iopsWrite ?? []).forEach(([time, value]) => {
    if (!timestampMap.has(time)) {
      timestampMap.set(time, { time });
    }
    timestampMap.get(time)!.iopsWrite = parseFloat(value);
  });

  // Latency Read (NaN 처리 포함)
  (latencyRead ?? []).forEach(([time, value]) => {
    if (!timestampMap.has(time)) {
      timestampMap.set(time, { time });
    }
    const latencyValue = parseFloat(value);
    // 📝 NaN 처리: 0으로 나누기 발생 시 0 반환
    timestampMap.get(time)!.latencyRead = Number.isFinite(latencyValue) ? latencyValue : 0;
  });

  // Latency Write (NaN 처리 포함)
  (latencyWrite ?? []).forEach(([time, value]) => {
    if (!timestampMap.has(time)) {
      timestampMap.set(time, { time });
    }
    const latencyValue = parseFloat(value);
    timestampMap.get(time)!.latencyWrite = Number.isFinite(latencyValue) ? latencyValue : 0;
  });

  return Array.from(timestampMap.values()).sort((a, b) => a.time - b.time);
}

export const NodeCharts = observer((_props: NodeChartsProps) => {
  const { metrics, tab, object } = useContext(ResourceMetricsContext) ?? {};

  if (!metrics || !object || !tab) return null;
  if (isMetricsEmpty(metrics)) return <NoMetrics />;

  // 🔧 Node 객체에서 이름과 Internal IP 가져오기 (instance 라벨 매칭용)
  const nodeName = object.getName();
  const nodeInternalIP = (object as { getInternalIP?: () => string | undefined }).getInternalIP?.();

  /**
   * 🎯 목적: 메트릭 결과에서 현재 노드의 데이터만 필터링
   *
   * @param results - Prometheus 쿼리 결과 배열
   * @returns 현재 노드에 해당하는 결과 또는 undefined
   *
   * 📝 주의사항:
   * - Kind, Docker Desktop 등에서는 node 라벨이 없고 instance(IP:port)만 있음
   * - nodeName, nodeInternalIP로 매칭 시도
   *
   * 🔄 변경이력: 2026-01-13 - Node Disk 메트릭 표시 버그 수정
   */
  const findNodeResult = (results: MetricResult[] | undefined) => {
    if (!results || results.length === 0) return undefined;

    // 결과가 하나뿐이면 그대로 사용
    if (results.length === 1) return results[0];

    // 여러 결과가 있으면 현재 노드 매칭
    return results.find(({ metric }) => {
      const { node, instance, kubernetes_node } = metric;
      const instanceHost = instance?.split(":")[0];

      return (
        nodeName === node ||
        nodeName === instance ||
        nodeName === instanceHost ||
        nodeName === kubernetes_node ||
        (nodeInternalIP && nodeInternalIP === instanceHost)
      );
    });
  };

  // 🎯 메트릭 데이터 추출 (현재 노드의 데이터만 필터링)
  // 📝 fsSize, fsUsage는 더 이상 사용하지 않음 (IOPS + Latency로 변경됨)
  // 🔄 변경이력: 2026-01-14 - diskReadLatency, diskWriteLatency, network BPS/PPS 추가
  const {
    memoryUsage,
    memoryCapacity,
    cpuUsage,
    cpuCapacity,
    podUsage,
    podCapacity,
    diskReadOps,
    diskWriteOps,
    diskReadLatency,
    diskWriteLatency,
    // 🎯 Network BPS/PPS 메트릭 (듀얼 축 차트용)
    networkReceiveBps,
    networkTransmitBps,
    networkReceivePps,
    networkTransmitPps,
  } = mapValues(metrics, (metric) => findNodeResult(normalizeMetrics(metric).data.result)?.values || []);

  // 🎯 탭에 따른 데이터 선택 및 차트 설정
  let chartData: Array<Record<string, number>> = [];
  let chartConfig: ChartConfig = {};
  let yAxisFormatter: (value: number) => string = (v) => v.toString();

  switch (tab) {
    case "CPU":
      chartData = convertToChartData(cpuUsage, cpuCapacity, "usage", "capacity");
      chartConfig = {
        usage: {
          label: "CPU Usage",
          // 🎯 THEME-040: CSS 변수 참조 (하드코딩 제거)
          color: "var(--chart-1)",
        },
        capacity: {
          label: "CPU Capacity",
          // 🎯 THEME-040: CSS 변수 참조 (하드코딩 제거)
          color: "var(--chart-2)",
        },
      } satisfies ChartConfig;
      yAxisFormatter = formatCPU;
      break;

    case "Memory":
      chartData = convertToChartData(memoryUsage, memoryCapacity, "usage", "capacity");
      chartConfig = {
        usage: {
          label: "Memory Usage",
          color: "var(--chart-3)", // Purple
        },
        capacity: {
          label: "Memory Capacity",
          color: "var(--chart-2)", // Navy
        },
      } satisfies ChartConfig;
      yAxisFormatter = formatMemory;
      break;

    case "Disk":
      // 🎯 Disk IOPS + Latency: 이중 축 차트
      // 왼쪽 Y축: IOPS (ops/sec), 오른쪽 Y축: Latency (ms)
      // 🔄 변경이력: 2026-01-14 - IOPS 단일 → IOPS + Latency 이중 축 변경
      // 🔄 변경이력: 2026-01-15 - 실선(IOPS)은 테마 색상, 점선(Latency)은 무채색으로 구분
      chartData = convertToDualAxisChartData(diskReadOps, diskWriteOps, diskReadLatency, diskWriteLatency);
      chartConfig = {
        iopsRead: {
          label: "Read IOPS",
          color: "var(--chart-1)",
        },
        iopsWrite: {
          label: "Write IOPS",
          color: "var(--chart-4)",
        },
        latencyRead: {
          label: "Read Latency",
          // 🎯 THEME-040: CSS 변수 참조 (하드코딩 제거) - 밝은 neutral
          color: "var(--chart-neutral-light)",
        },
        latencyWrite: {
          label: "Write Latency",
          // 🎯 THEME-040: CSS 변수 참조 (하드코딩 제거) - 어두운 neutral
          color: "var(--chart-neutral-dark)",
        },
      } satisfies ChartConfig;
      // 이중 축: 왼쪽 IOPS용 기본 포매터
      yAxisFormatter = formatIOPS;
      break;

    case "Pods":
      chartData = convertToChartData(podUsage, podCapacity, "usage", "capacity");
      chartConfig = {
        usage: {
          label: "Pods Usage",
          color: "var(--chart-5)", // Green
        },
        capacity: {
          label: "Pods Capacity",
          color: "var(--chart-2)", // Navy
        },
      } satisfies ChartConfig;
      yAxisFormatter = formatPods;
      break;

    case "Network":
      // 🎯 Network BPS + PPS: 이중 축 차트
      // 왼쪽 Y축: BPS (bits/sec), 오른쪽 Y축: PPS (packets/sec)
      // 🔄 변경이력: 2026-01-14 - Network BPS/PPS 듀얼 축 차트 추가
      // 🔄 변경이력: 2026-01-15 - 실선(BPS)은 테마 색상, 점선(PPS)은 무채색으로 구분
      chartData = convertNetworkToChartData(
        networkReceiveBps,
        networkTransmitBps,
        networkReceivePps,
        networkTransmitPps,
      );
      chartConfig = {
        receiveBps: {
          label: "Receive bps",
          color: "var(--chart-1)",
        },
        transmitBps: {
          label: "Transmit bps",
          color: "var(--chart-4)",
        },
        receivePps: {
          label: "Receive pps",
          // 🎯 THEME-040: CSS 변수 참조 (하드코딩 제거) - 밝은 neutral
          color: "var(--chart-neutral-light)",
        },
        transmitPps: {
          label: "Transmit pps",
          // 🎯 THEME-040: CSS 변수 참조 (하드코딩 제거) - 어두운 neutral
          color: "var(--chart-neutral-dark)",
        },
      } satisfies ChartConfig;
      // 이중 축: 왼쪽 BPS용 기본 포매터
      yAxisFormatter = formatBps;
      break;

    default:
      return <NoMetrics />;
  }

  // ⚠️ 데이터가 없으면 NoMetrics 표시
  if (chartData.length === 0) {
    return <NoMetrics />;
  }

  // 🎯 Disk/Network 탭: 이중 축 차트
  // 다른 탭: 단일 축 차트 (Usage + Capacity)
  // 🔄 변경이력: 2026-01-14 - Disk 탭에 이중 축 차트 지원 추가
  // 🔄 변경이력: 2026-01-14 - Network 탭 추가 (BPS + PPS 듀얼 축)
  const isDualAxis = tab === "Disk" || tab === "Network";

  return (
    <div className="h-[240px] w-full">
      <ChartContainer config={chartConfig} className="h-full w-full" style={{ width: "100%", height: "100%" }}>
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{
            left: 0,
            right: isDualAxis ? 10 : 0, // 이중 축일 때 오른쪽 여백
            top: 5,
            bottom: 24,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatTime} />

          {/* 왼쪽 Y축: IOPS/BPS 또는 기본 메트릭 */}
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={70}
            tickFormatter={yAxisFormatter}
          />

          {/* 오른쪽 Y축: Latency (Disk) 또는 PPS (Network) */}
          {tab === "Disk" && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={70}
              tickFormatter={formatLatency}
            />
          )}
          {tab === "Network" && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={70}
              tickFormatter={formatPps}
            />
          )}

          <Tooltip
            content={
              <ChartTooltipContent
                labelFormatter={formatTooltipTime}
                formatter={(value, name, item) => {
                  // 🎯 dataKey 사용 (name은 Area의 name prop, dataKey는 CSS 변수와 일치)
                  const dataKey = (item as { dataKey?: string }).dataKey || name;
                  const itemConfig = chartConfig[dataKey as keyof typeof chartConfig];
                  const label = itemConfig?.label || name;

                  // 이중 축 차트에서 오른쪽 축 메트릭인지 확인하여 적절한 포맷터 적용
                  let formattedValue: string;
                  if (tab === "Disk" && (dataKey === "latencyRead" || dataKey === "latencyWrite")) {
                    formattedValue = formatLatency(Number(value));
                  } else if (tab === "Network") {
                    // 🎯 Network 탭: 전체 숫자 표시 (단위 포맷팅 없음)
                    formattedValue = Number(value).toLocaleString();
                  } else {
                    formattedValue = yAxisFormatter(Number(value));
                  }

                  return (
                    <>
                      {/* 🎨 Indicator dot - ChartStyle이 생성한 CSS 변수 사용 */}
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{
                          backgroundColor: `var(--color-${dataKey})`,
                        }}
                      />
                      {/* 📝 Label + Formatted Value */}
                      <div className="flex flex-1 justify-between leading-none items-center gap-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono font-medium tabular-nums" style={{ color: "var(--foreground)" }}>
                          {formattedValue}
                        </span>
                      </div>
                    </>
                  );
                }}
              />
            }
          />

          {tab === "Disk" ? (
            <>
              {/* 🎯 Disk 탭: IOPS (왼쪽 축, 실선) + Latency (오른쪽 축, 점선) */}
              {/* 🔄 변경이력: 2026-01-15 - fill 효과 제거 (가독성 개선) */}
              {/* 🔄 변경이력: 2026-01-26 - type="monotone" → "monotone"으로 변경하여 부드러운 곡선 렌더링 */}
              <Area
                yAxisId="left"
                dataKey="iopsRead"
                name="Read IOPS"
                type="monotone"
                fill="none"
                stroke="var(--color-iopsRead)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                yAxisId="left"
                dataKey="iopsWrite"
                name="Write IOPS"
                type="monotone"
                fill="none"
                stroke="var(--color-iopsWrite)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              {/* Latency - 오른쪽 축 */}
              <Area
                yAxisId="right"
                dataKey="latencyRead"
                name="Read Latency"
                type="monotone"
                fill="none"
                stroke="var(--color-latencyRead)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                yAxisId="right"
                dataKey="latencyWrite"
                name="Write Latency"
                type="monotone"
                fill="none"
                stroke="var(--color-latencyWrite)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </>
          ) : tab === "Network" ? (
            <>
              {/* 🎯 Network 탭: BPS (왼쪽 축, 실선) + PPS (오른쪽 축, 점선) */}
              {/* 🔄 변경이력: 2026-01-15 - fill 효과 제거 (가독성 개선) */}
              <Area
                yAxisId="left"
                dataKey="receiveBps"
                name="Receive BPS"
                type="monotone"
                fill="none"
                stroke="var(--color-receiveBps)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                yAxisId="left"
                dataKey="transmitBps"
                name="Transmit BPS"
                type="monotone"
                fill="none"
                stroke="var(--color-transmitBps)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              {/* PPS - 오른쪽 축 */}
              <Area
                yAxisId="right"
                dataKey="receivePps"
                name="Receive PPS"
                type="monotone"
                fill="none"
                stroke="var(--color-receivePps)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                yAxisId="right"
                dataKey="transmitPps"
                name="Transmit PPS"
                type="monotone"
                fill="none"
                stroke="var(--color-transmitPps)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </>
          ) : (
            <>
              {/* 🎯 다른 탭: 기존 단일 축 차트 (CPU, Memory, Pods) */}
              {/* 🔄 변경이력: 2026-01-26 - type="monotone" → "monotone"으로 변경하여 부드러운 곡선 렌더링 */}
              <Area
                yAxisId="left"
                dataKey="usage"
                name="Usage"
                type="monotone"
                fill="var(--color-usage)"
                fillOpacity={0.4}
                stroke="var(--color-usage)"
                isAnimationActive={false}
              />
              <Area
                yAxisId="left"
                dataKey="capacity"
                name="Capacity"
                type="monotone"
                fill="var(--color-capacity)"
                fillOpacity={0.2}
                stroke="var(--color-capacity)"
                isAnimationActive={false}
              />
            </>
          )}

          <Legend content={<ChartLegendContent />} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
});
