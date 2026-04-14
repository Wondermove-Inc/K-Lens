/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Pod 전체 메트릭 차트 컴포넌트 (shadcn Chart 기반)
 *
 * @remarks
 * - Chart.js → shadcn Chart (recharts) 전환
 * - CPU/Memory/Network/Disk 메트릭을 AreaChart로 시각화
 * - Pod 전체 Usage 데이터만 표시 (Container별 합산)
 * - Network/Disk는 Prometheus 전용 (Metrics Server에서는 지원 안함)
 *
 * 📝 주의사항:
 * - Prometheus 메트릭 데이터 형식: [timestamp, value][]
 * - recharts 형식으로 변환 필요: { time: number, usage: number }[]
 * - Network: receive + transmit 데이터 표시
 * - Disk: IOPS + Latency 이중 축 차트 (Node 차트와 동일한 패턴)
 *
 * 🔄 변경이력:
 * - 2025-11-04: Chart.js → shadcn Chart (recharts) 전환
 * - 2026-01-12: Network/Disk 탭 추가 (Prometheus 전용)
 * - 2026-01-12: Disk 탭을 fsUsage 대신 fsReads/fsWrites 사용으로 변경
 *              (container_fs_usage_bytes에 pod/namespace 라벨 없음)
 * - 2026-01-14: Disk 탭을 IOPS + Latency 이중 축 차트로 변경
 *              (container_fs_reads_total, container_fs_writes_total,
 *               container_fs_read_seconds_total, container_fs_write_seconds_total 사용)
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
import { isMetricsEmpty, normalizeMetrics } from "../../../common/k8s-api/endpoints/metrics.api";
import { ResourceMetricsContext } from "../resource-metrics";
import { NoMetrics } from "../resource-metrics/no-metrics";

import type { ChartConfig } from "@skuberplus/storybook-shadcn/src/components/ui/chart";

import type { AtLeastOneMetricTab } from "../resource-metrics";

// 🎯 목적: Pod 메트릭 탭 정의
// 📝 주의사항: Network/Disk는 Prometheus 전용 (Metrics Server에서는 "Prometheus Required" 메시지 표시)
export const podMetricTabs: AtLeastOneMetricTab = ["CPU", "Memory", "Network", "Disk"];

/**
 * 🎯 목적: Prometheus 메트릭 데이터를 recharts 형식으로 변환 (단일 메트릭)
 *
 * @param usage - Usage 메트릭 데이터 [timestamp, value][]
 * @returns recharts 형식의 데이터 배열
 */
function convertToChartData(usage: Array<[number, string]>): Array<{ time: number; usage: number }> {
  // 🛡️ null/undefined 방어 처리 - Prometheus 미설치 클러스터에서 크래시 방지
  return (usage ?? [])
    .map(([time, value]) => ({
      time,
      usage: parseFloat(value),
    }))
    .sort((a, b) => a.time - b.time);
}

/**
 * 🎯 목적: Network BPS/PPS 메트릭을 recharts 듀얼 축 형식으로 변환 및 병합
 *
 * @remarks
 * - 왼쪽 Y축: BPS (bits/sec) - Receive + Transmit
 * - 오른쪽 Y축: PPS (packets/sec) - Receive + Transmit
 * - Disk 차트의 IOPS+Latency 듀얼 축 패턴과 동일
 *
 * @param receiveBps - 수신 BPS 데이터 [timestamp, value][]
 * @param transmitBps - 송신 BPS 데이터 [timestamp, value][]
 * @param receivePps - 수신 PPS 데이터 [timestamp, value][]
 * @param transmitPps - 송신 PPS 데이터 [timestamp, value][]
 * @returns recharts 형식의 데이터 배열
 *
 * 🔄 변경이력:
 * - 2026-01-14: BPS/PPS 듀얼 축 차트 지원을 위해 추가
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
 * @remarks
 * - Node 차트와 동일한 패턴으로 IOPS + Latency 이중 축 차트 지원
 * - cAdvisor diskIO 메트릭 사용
 *
 * @param iopsRead - IOPS Read 데이터 [timestamp, value][]
 * @param iopsWrite - IOPS Write 데이터 [timestamp, value][]
 * @param latencyRead - Latency Read 데이터 [timestamp, value][]
 * @param latencyWrite - Latency Write 데이터 [timestamp, value][]
 * @returns recharts 형식의 데이터 배열
 *
 * 🔄 변경이력:
 * - 2026-01-14: Node 차트 패턴 적용하여 이중 축 차트 지원
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
 * 🎯 목적: Memory/Network 값을 읽기 쉬운 형식으로 변환
 * @param value - 값 (bytes 단위)
 * @returns KiB/MiB/GiB 형식 문자열
 */
function formatBytes(value: number): string {
  return bytesToUnits(value, { precision: 1 });
}

/**
 * 🎯 목적: IOPS 값을 읽기 쉬운 형식으로 변환
 * @param value - 값 (ops/sec 단위)
 * @returns 숫자 또는 K 접미사 형식 문자열
 *
 * 📝 주의사항:
 * - 1000 이상: K 접미사 사용 (예: 1.5K)
 * - 1000 미만: 소수점 1자리
 *
 * 🔄 변경이력: 2026-01-14 - IOPS 표시를 위해 추가
 */
function formatIOPS(value: number): string {
  if (value === 0) return "0";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(1);
}

/**
 * 🎯 목적: BPS (bits per second) 값을 읽기 쉬운 형식으로 변환
 * @param value - 값 (bits/sec 단위)
 * @returns Kbps/Mbps/Gbps 형식 문자열
 *
 * 📝 주의사항:
 * - 1000 기반 (SI 단위): 1 Mbps = 1,000,000 bits/sec
 * - 네트워크 대역폭은 SI 단위가 표준
 *
 * 🔄 변경이력: 2026-01-14 - Network BPS 듀얼 축 차트 지원을 위해 추가
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
 * @param value - 값 (packets/sec 단위)
 * @returns K/M 접미사 형식 문자열
 *
 * 📝 주의사항:
 * - 1000 기반: 1K = 1,000 packets/sec
 *
 * 🔄 변경이력: 2026-01-14 - Network PPS 듀얼 축 차트 지원을 위해 추가
 */
function formatPps(value: number): string {
  if (value === 0) return "0";
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M pps`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K pps`;
  return `${value.toFixed(0)} pps`;
}

/**
 * 🎯 목적: Latency 값을 읽기 쉬운 형식으로 변환
 * @param value - Latency 값 (ms 단위)
 * @returns ms/μs/s 형식 문자열
 *
 * 📝 주의사항:
 * - 1ms 미만: μs (마이크로초) 단위로 표시
 * - 1000ms 이상: s (초) 단위로 표시
 *
 * 🔄 변경이력: 2026-01-14 - Disk Latency 이중 축 차트 지원을 위해 추가
 */
function formatLatency(value: number): string {
  if (value === 0) return "0";
  if (value < 1) return `${(value * 1000).toFixed(0)} μs`; // 마이크로초
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`; // 초
  return `${value.toFixed(1)} ms`;
}

export const PodCharts = observer(() => {
  const { metrics, tab, object, metricsSource } = useContext(ResourceMetricsContext) ?? {};

  if (!metrics || !object || !tab) return null;

  // 🎯 Network/Disk 탭이고 Metrics Server인 경우 Prometheus 필요 메시지 표시
  if ((tab === "Network" || tab === "Disk") && metricsSource === "metrics-server") {
    return <NoMetrics variant="prometheus-required" />;
  }

  if (isMetricsEmpty(metrics)) return <NoMetrics />;

  // 🎯 메트릭 데이터 추출
  // 📝 주의: fsUsage 대신 fsReads/fsWrites 사용 (container_fs_usage_bytes에 pod 라벨 없음)
  // 🔄 변경이력: 2026-01-14 - fsReadLatency, fsWriteLatency, networkBps/Pps 추가 (이중 축 차트 지원)
  const {
    cpuUsage,
    memoryUsage,
    networkReceiveBps,
    networkTransmitBps,
    networkReceivePps,
    networkTransmitPps,
    fsReads,
    fsWrites,
    fsReadLatency,
    fsWriteLatency,
  } = mapValues(metrics, (metric) => normalizeMetrics(metric).data.result[0]?.values || []);

  // 🎯 탭에 따른 차트 렌더링
  switch (tab) {
    case "CPU": {
      const chartData = convertToChartData(cpuUsage);

      if (chartData.length === 0) return <NoMetrics />;

      const chartConfig = {
        usage: {
          label: "CPU Usage",
          color: "var(--chart-1)",
        },
      } satisfies ChartConfig;

      return (
        <div className="h-[240px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full" style={{ width: "100%", height: "100%" }}>
            <AreaChart accessibilityLayer data={chartData} margin={{ left: 0, right: 0, top: 5, bottom: 24 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatTime} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={70} tickFormatter={formatCPU} />
              <Tooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={formatTooltipTime}
                    formatter={(value, name, item) => {
                      // 🎯 dataKey 사용 (name은 Area의 name prop, dataKey는 CSS 변수와 일치)
                      const dataKey = (item as { dataKey?: string }).dataKey || name;
                      const itemConfig = chartConfig[dataKey as keyof typeof chartConfig];
                      const label = itemConfig?.label || name;

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
                              {formatCPU(Number(value))}
                            </span>
                          </div>
                        </>
                      );
                    }}
                  />
                }
              />
              {/* 🔄 변경이력: 2026-01-26 - type="monotone" → "monotone"으로 변경하여 부드러운 곡선 렌더링 */}
              <Area
                dataKey="usage"
                name="Usage"
                type="monotone"
                fill="var(--color-usage)"
                fillOpacity={0.4}
                stroke="var(--color-usage)"
                isAnimationActive={false}
              />
              <Legend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </div>
      );
    }

    case "Memory": {
      const chartData = convertToChartData(memoryUsage);

      if (chartData.length === 0) return <NoMetrics />;

      const chartConfig = {
        usage: {
          label: "Memory Usage",
          color: "var(--chart-3)",
        },
      } satisfies ChartConfig;

      return (
        <div className="h-[240px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full" style={{ width: "100%", height: "100%" }}>
            <AreaChart accessibilityLayer data={chartData} margin={{ left: 0, right: 0, top: 5, bottom: 24 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatTime} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={70} tickFormatter={formatBytes} />
              <Tooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={formatTooltipTime}
                    formatter={(value, name, item) => {
                      // 🎯 dataKey 사용 (name은 Area의 name prop, dataKey는 CSS 변수와 일치)
                      const dataKey = (item as { dataKey?: string }).dataKey || name;
                      const itemConfig = chartConfig[dataKey as keyof typeof chartConfig];
                      const label = itemConfig?.label || name;

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
                              {formatBytes(Number(value))}
                            </span>
                          </div>
                        </>
                      );
                    }}
                  />
                }
              />
              {/* 🔄 변경이력: 2026-01-26 - type="monotone" → "monotone"으로 변경하여 부드러운 곡선 렌더링 */}
              <Area
                dataKey="usage"
                name="Usage"
                type="monotone"
                fill="var(--color-usage)"
                fillOpacity={0.4}
                stroke="var(--color-usage)"
                isAnimationActive={false}
              />
              <Legend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </div>
      );
    }

    case "Network": {
      // 🎯 Network BPS + PPS: 이중 축 차트 (Disk 차트와 동일한 패턴)
      // 왼쪽 Y축: BPS (bits/sec), 오른쪽 Y축: PPS (packets/sec)
      // 📝 메트릭: container_network_receive/transmit_bytes_total * 8 (BPS)
      //           container_network_receive/transmit_packets_total (PPS)
      // 🔄 변경이력: 2026-01-14 - bytes 기반 단일 축 → BPS/PPS 듀얼 축 변경
      const chartData = convertNetworkToChartData(
        networkReceiveBps,
        networkTransmitBps,
        networkReceivePps,
        networkTransmitPps,
      );

      if (chartData.length === 0) return <NoMetrics />;

      const chartConfig = {
        receiveBps: {
          label: "Receive bps",
          color: "var(--chart-1)", // Blue
        },
        transmitBps: {
          label: "Transmit bps",
          color: "var(--chart-2)", // Navy
        },
        receivePps: {
          label: "Receive pps",
          // 🎯 theme 객체로 직접 OKLCH 값 지정 (CSS 변수 중첩 문제 해결)
          theme: {
            "default-light": "oklch(0.8 0 0)",
            "default-dark": "oklch(0.7 0 0)",
            "red-light": "oklch(0.8 0 0)",
            "red-dark": "oklch(0.7 0 0)",
            "orange-light": "oklch(0.8 0 0)",
            "orange-dark": "oklch(0.7 0 0)",
            "green-light": "oklch(0.8 0 0)",
            "green-dark": "oklch(0.7 0 0)",
            "blue-light": "oklch(0.8 0 0)",
            "blue-dark": "oklch(0.7 0 0)",
            "yellow-light": "oklch(0.8 0 0)",
            "yellow-dark": "oklch(0.7 0 0)",
            "violet-light": "oklch(0.8 0 0)",
            "violet-dark": "oklch(0.7 0 0)",
          },
        },
        transmitPps: {
          label: "Transmit pps",
          // 🎯 theme 객체로 직접 OKLCH 값 지정 (CSS 변수 중첩 문제 해결)
          theme: {
            "default-light": "oklch(0 0 0)",
            "default-dark": "oklch(0.95 0 0)",
            "red-light": "oklch(0 0 0)",
            "red-dark": "oklch(0.95 0 0)",
            "orange-light": "oklch(0 0 0)",
            "orange-dark": "oklch(0.95 0 0)",
            "green-light": "oklch(0 0 0)",
            "green-dark": "oklch(0.95 0 0)",
            "blue-light": "oklch(0 0 0)",
            "blue-dark": "oklch(0.95 0 0)",
            "yellow-light": "oklch(0 0 0)",
            "yellow-dark": "oklch(0.95 0 0)",
            "violet-light": "oklch(0 0 0)",
            "violet-dark": "oklch(0.95 0 0)",
          },
        },
      } satisfies ChartConfig;

      return (
        <div className="h-[240px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full" style={{ width: "100%", height: "100%" }}>
            <AreaChart accessibilityLayer data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 24 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatTime} />

              {/* 왼쪽 Y축: BPS (bits/sec) */}
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={80}
                tickFormatter={formatBps}
              />

              {/* 오른쪽 Y축: PPS (packets/sec) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={80}
                tickFormatter={formatPps}
              />

              <Tooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={formatTooltipTime}
                    formatter={(value, name, item) => {
                      // 🎯 dataKey 사용 (name은 Area의 name prop, dataKey는 CSS 변수와 일치)
                      const dataKey = (item as { dataKey?: string }).dataKey || name;
                      const itemConfig = chartConfig[dataKey as keyof typeof chartConfig];
                      const label = itemConfig?.label || name;

                      return (
                        <>
                          {/* 🎨 Indicator dot - ChartStyle이 생성한 CSS 변수 사용 */}
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor: `var(--color-${dataKey})`,
                            }}
                          />
                          {/* 📝 Label + Formatted Value (전체 숫자 표시) */}
                          <div className="flex flex-1 justify-between leading-none items-center gap-2">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-mono font-medium tabular-nums" style={{ color: "var(--foreground)" }}>
                              {Number(value).toLocaleString()}
                            </span>
                          </div>
                        </>
                      );
                    }}
                  />
                }
              />

              {/* BPS - 왼쪽 축, 실선 (fill 효과 제거, node-charts와 동일) */}
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

              <Legend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </div>
      );
    }

    case "Disk": {
      // 🎯 Disk IOPS + Latency: 이중 축 차트 (Node 차트와 동일한 패턴)
      // 왼쪽 Y축: IOPS (ops/sec), 오른쪽 Y축: Latency (ms)
      // 📝 메트릭: container_fs_reads_total, container_fs_writes_total,
      //           container_fs_read_seconds_total, container_fs_write_seconds_total
      // 🔄 변경이력: 2026-01-14 - 단일 축 → IOPS + Latency 이중 축 변경
      const chartData = convertToDualAxisChartData(fsReads, fsWrites, fsReadLatency, fsWriteLatency);

      if (chartData.length === 0) return <NoMetrics />;

      const chartConfig = {
        iopsRead: {
          label: "Read IOPS",
          color: "var(--chart-1)", // Blue
        },
        iopsWrite: {
          label: "Write IOPS",
          color: "var(--chart-2)", // Navy
        },
        latencyRead: {
          label: "Read Latency",
          // 🎯 theme 객체로 직접 OKLCH 값 지정 (CSS 변수 중첩 문제 해결)
          theme: {
            "default-light": "oklch(0.8 0 0)",
            "default-dark": "oklch(0.7 0 0)",
            "red-light": "oklch(0.8 0 0)",
            "red-dark": "oklch(0.7 0 0)",
            "orange-light": "oklch(0.8 0 0)",
            "orange-dark": "oklch(0.7 0 0)",
            "green-light": "oklch(0.8 0 0)",
            "green-dark": "oklch(0.7 0 0)",
            "blue-light": "oklch(0.8 0 0)",
            "blue-dark": "oklch(0.7 0 0)",
            "yellow-light": "oklch(0.8 0 0)",
            "yellow-dark": "oklch(0.7 0 0)",
            "violet-light": "oklch(0.8 0 0)",
            "violet-dark": "oklch(0.7 0 0)",
          },
        },
        latencyWrite: {
          label: "Write Latency",
          // 🎯 theme 객체로 직접 OKLCH 값 지정 (CSS 변수 중첩 문제 해결)
          theme: {
            "default-light": "oklch(0 0 0)",
            "default-dark": "oklch(0.95 0 0)",
            "red-light": "oklch(0 0 0)",
            "red-dark": "oklch(0.95 0 0)",
            "orange-light": "oklch(0 0 0)",
            "orange-dark": "oklch(0.95 0 0)",
            "green-light": "oklch(0 0 0)",
            "green-dark": "oklch(0.95 0 0)",
            "blue-light": "oklch(0 0 0)",
            "blue-dark": "oklch(0.95 0 0)",
            "yellow-light": "oklch(0 0 0)",
            "yellow-dark": "oklch(0.95 0 0)",
            "violet-light": "oklch(0 0 0)",
            "violet-dark": "oklch(0.95 0 0)",
          },
        },
      } satisfies ChartConfig;

      return (
        <div className="h-[240px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full" style={{ width: "100%", height: "100%" }}>
            <AreaChart accessibilityLayer data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 24 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatTime} />

              {/* 왼쪽 Y축: IOPS */}
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={70}
                tickFormatter={formatIOPS}
              />

              {/* 오른쪽 Y축: Latency */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={70}
                tickFormatter={formatLatency}
              />

              <Tooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={formatTooltipTime}
                    formatter={(value, name, item) => {
                      // 🎯 dataKey 사용 (name은 Area의 name prop, dataKey는 CSS 변수와 일치)
                      const dataKey = (item as { dataKey?: string }).dataKey || name;
                      const itemConfig = chartConfig[dataKey as keyof typeof chartConfig];
                      const label = itemConfig?.label || name;

                      // 🎯 IOPS/Latency 분기 처리 (dataKey 기반)
                      const isLatency = dataKey === "latencyRead" || dataKey === "latencyWrite";
                      const formattedValue = isLatency ? formatLatency(Number(value)) : formatIOPS(Number(value));

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

              {/* IOPS - 왼쪽 축, 실선 (fill 효과 제거, node-charts와 동일) */}
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

              <Legend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </div>
      );
    }

    default:
      return <NoMetrics />;
  }
});
