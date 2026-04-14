/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Node 메트릭 차트 컴포넌트 (shadcn Chart 기반)
 *
 * @remarks
 * - Chart.js BarChart → shadcn Chart (recharts) 전환
 * - CPU/Memory 메트릭을 AreaChart로 시각화
 * - Usage 데이터 표시 (Pod와 달리 Requests/Limits 없음)
 *
 * 📝 주의사항:
 * - Prometheus 메트릭 데이터 형식: [timestamp, value][]
 * - recharts 형식으로 변환 필요: { time: number, usage: number }[]
 * - container-charts.tsx와 동일한 패턴 적용
 *
 * 🔄 변경이력:
 * - 2025-01-21: Chart.js → shadcn Chart (recharts) 전환 (레전드 색상/이름 툴팁 지원)
 */

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from "@skuberplus/storybook-shadcn/src/components/ui/chart";
import { bytesToUnits } from "@skuberplus/utilities";
import { mapValues } from "lodash";
import { observer } from "mobx-react";
import React, { useContext, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { isMetricsEmpty, normalizeMetrics } from "../../../common/k8s-api/endpoints/metrics.api";
import { ResourceMetricsContext } from "../resource-metrics";
import { NoMetrics } from "../resource-metrics/no-metrics";

import type { ChartConfig } from "@skuberplus/storybook-shadcn/src/components/ui/chart";

export interface NodeChartsProps {}

/**
 * 🎯 목적: Prometheus 메트릭 데이터를 recharts 형식으로 변환
 *
 * @param usage - Usage 메트릭 데이터 [timestamp, value][]
 * @returns recharts 형식의 데이터 배열
 */
function convertToChartData(usage: Array<[number, string]>): Array<{ time: number; usage: number }> {
  // 🛡️ null/undefined 방어 처리 - Prometheus 미설치 클러스터에서 크래시 방지
  const timestamps = new Set<number>();
  (usage ?? []).forEach(([time]) => timestamps.add(time));

  // 🎯 타임스탬프별 데이터 맵 생성
  const usageMap = new Map((usage ?? []).map(([time, value]) => [time, parseFloat(value)]));

  // 🎯 시간순 정렬 후 데이터 병합
  return Array.from(timestamps)
    .sort((a, b) => a - b)
    .map((time) => ({
      time,
      usage: usageMap.get(time) || 0,
    }));
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
    if (milliCores >= 1) return `${Math.round(milliCores)}m`;
    if (milliCores >= 0.1) return `${milliCores.toFixed(1)}m`;
    return `${milliCores.toFixed(2)}m`;
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

export const NodeCharts = observer(({}: NodeChartsProps) => {
  const { metrics, tab, object } = useContext(ResourceMetricsContext) ?? {};

  // 🎯 메트릭 데이터 추출 (hooks 순서 유지를 위해 early return 전에 처리)
  const { cpuUsage, memoryUsage } = mapValues(
    metrics || {},
    (metric) => normalizeMetrics(metric).data.result[0]?.values || [],
  );

  // 🎯 CPU/Memory에 따른 데이터 및 설정 선택
  // ⚠️ 중요: useMemo는 항상 호출되어야 함 (React hooks 규칙)
  const isCPU = tab === "CPU";
  const chartData = useMemo(
    () => (isCPU ? convertToChartData(cpuUsage) : convertToChartData(memoryUsage)),
    [isCPU, cpuUsage, memoryUsage],
  );

  // 🎯 Early returns - hooks 호출 후에 배치
  if (!metrics || !object || !tab) return null;
  if (isMetricsEmpty(metrics)) return <NoMetrics />;

  // 🎯 Chart Config (shadcn/ui 디자인 토큰 사용)
  // 📝 주의사항: Storybook 템플릿 패턴 적용 (var(--chart-1), var(--chart-3))
  // 🔄 변경이력: 2025-01-21 - Chart.js → shadcn Chart 전환 시 생성
  const labelPrefix = isCPU ? "CPU (cores)" : "Memory";
  const chartConfig = {
    usage: {
      label: `${labelPrefix} Usage`,
      color: isCPU ? "var(--chart-1)" : "var(--chart-3)",
    },
  } satisfies ChartConfig;

  // ⚠️ 데이터가 없으면 NoMetrics 표시
  if (chartData.length === 0) {
    return <NoMetrics />;
  }

  return (
    <div className="h-[240px] w-full">
      <ChartContainer config={chartConfig} className="h-full w-full" style={{ width: "100%", height: "100%" }}>
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{
            left: 0,
            right: 0,
            top: 5,
            bottom: 24,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis dataKey="time" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatTime} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={70}
            tickFormatter={isCPU ? formatCPU : formatMemory}
          />
          <Tooltip
            content={
              <ChartTooltipContent
                labelFormatter={formatTooltipTime}
                formatter={(value) => (isCPU ? formatCPU(Number(value)) : formatMemory(Number(value)))}
              />
            }
          />
          {/* Usage Area */}
          <Area
            dataKey="usage"
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
});
