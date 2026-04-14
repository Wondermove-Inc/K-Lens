/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import React, { useContext } from "react";
import { isMetricsEmpty, normalizeMetrics } from "../../../common/k8s-api/endpoints/metrics.api";
import { BarChart } from "../chart";
import { type MetricsTab, metricTabOptions } from "../chart/options";
import { ResourceMetricsContext } from "../resource-metrics";
import { NoMetrics } from "../resource-metrics/no-metrics";

import type { ChartDataSets } from "../chart";

export const IngressCharts = observer(() => {
  const { metrics, tab, object } = useContext(ResourceMetricsContext) ?? {};

  if (!metrics || !object || !tab) return null;
  if (isMetricsEmpty(metrics)) return <NoMetrics />;

  const id = object.getId();
  const values = Object.values(metrics)
    .map(normalizeMetrics)
    .map(({ data }) => data.result[0].values);
  const [/* bytesSentSuccess, bytesSentFailure, */ requestDurationSeconds, responseDurationSeconds] = values;

  const datasets: Partial<Record<MetricsTab, ChartDataSets[]>> = {
    /* Network: [
      {
        id: `${id}-bytesSentSuccess`,
        label: `Bytes sent, status 2xx`,
        tooltip: `Bytes sent by Ingress controller with successful status`,
        borderColor: "var(--chart-network-success)", // 🎯 THEME-022: CSS 변수 (활성화 시 정의 필요)
        data: bytesSentSuccess.map(([x, y]) => ({ x, y })),
      },
      {
        id: `${id}-bytesSentFailure`,
        label: `Bytes sent, status 5xx`,
        tooltip: `Bytes sent by Ingress controller with error status`,
        borderColor: "var(--chart-network-failure)", // 🎯 THEME-022: CSS 변수 (활성화 시 정의 필요)
        data: bytesSentFailure.map(([x, y]) => ({ x, y })),
      },
    ], */
    // 🎯 THEME-022: CSS 변수 사용
    Duration: [
      {
        id: `${id}-requestDurationSeconds`,
        label: `Request`,
        tooltip: `Request duration in seconds`,
        borderColor: "var(--chart-request-duration)",
        data: requestDurationSeconds.map(([x, y]) => ({ x, y })),
      },
      {
        id: `${id}-responseDurationSeconds`,
        label: `Response`,
        tooltip: `Response duration in seconds`,
        borderColor: "var(--chart-response-duration)",
        data: responseDurationSeconds.map(([x, y]) => ({ x, y })),
      },
    ],
  };

  return (
    <BarChart
      name={`${object.getName()}-metric-${tab}`}
      options={metricTabOptions[tab]}
      data={{ datasets: datasets[tab] }}
    />
  );
});
