/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 THEME-011: activeTheme injectable 제거
 * 📝 CSS 변수 기반 차트 색상으로 마이그레이션
 * 🔄 THEME-040: useChartColors 훅 제거, CSS 변수 직접 참조
 */
import { observer } from "mobx-react";
import React, { useContext } from "react";
import { isMetricsEmpty, normalizeMetrics } from "../../../common/k8s-api/endpoints/metrics.api";
import { BarChart, memoryOptions } from "../chart";
import { ResourceMetricsContext } from "../resource-metrics";
import { NoMetrics } from "../resource-metrics/no-metrics";

import type { ChartDataSets } from "../chart";

export interface VolumeClaimDiskChartProps {}

/**
 * 🎯 THEME-040: CSS 변수 직접 참조로 단순화
 * useChartColors 훅 제거 - 불필요한 JavaScript 런타임 색상 해석 제거
 */
export const VolumeClaimDiskChart = observer(({}: VolumeClaimDiskChartProps) => {
  const { metrics, tab, object } = useContext(ResourceMetricsContext) ?? {};

  if (!metrics || !object || !tab) return null;
  if (isMetricsEmpty(metrics)) return <NoMetrics />;

  const id = object.getId();
  const { diskUsage, diskCapacity } = metrics;
  const usage = normalizeMetrics(diskUsage).data.result[0].values;
  const capacity = normalizeMetrics(diskCapacity).data.result[0].values;

  // 🎯 THEME-022: CSS 변수 사용
  const datasets: ChartDataSets[] = [
    {
      id: `${id}-diskUsage`,
      label: `Usage`,
      tooltip: `Volume disk usage`,
      borderColor: "var(--chart-disk-usage)",
      data: usage.map(([x, y]) => ({ x, y })),
    },
    {
      id: `${id}-diskCapacity`,
      label: `Capacity`,
      tooltip: `Volume disk capacity`,
      borderColor: "var(--chartCapacityColor)",
      data: capacity.map(([x, y]) => ({ x, y })),
    },
  ];

  return (
    <BarChart
      className="VolumeClaimDiskChart flex box grow column"
      name={`pvc-${object.getName()}-disk`}
      timeLabelStep={10}
      options={memoryOptions}
      data={{ datasets }}
    />
  );
});
