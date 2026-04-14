/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import requestMetricsInjectable from "./request-metrics.injectable";

import type { MetricData } from "../metrics.api";
import type { RequestMetricsParams } from "./request-metrics.injectable";

/**
 * 🎯 Cluster/Node 메트릭 데이터 인터페이스
 *
 * 🔄 변경이력:
 * - 2026-01-14: networkReceiveBps, networkTransmitBps, networkReceivePps, networkTransmitPps 추가
 *              (Network BPS/PPS 듀얼 축 차트 지원)
 */
export interface ClusterMetricData {
  memoryUsage: MetricData;
  memoryRequests: MetricData;
  memoryLimits: MetricData;
  memoryCapacity: MetricData;
  memoryAllocatableCapacity: MetricData;
  cpuUsage: MetricData;
  cpuRequests: MetricData;
  cpuLimits: MetricData;
  cpuCapacity: MetricData;
  cpuAllocatableCapacity: MetricData;
  podUsage: MetricData;
  podCapacity: MetricData;
  podAllocatableCapacity: MetricData;
  fsSize: MetricData;
  fsUsage: MetricData;
  /** 🎯 Disk IOPS - 읽기 작업 수 (ops/sec) */
  diskReadOps: MetricData;
  /** 🎯 Disk IOPS - 쓰기 작업 수 (ops/sec) */
  diskWriteOps: MetricData;
  /** 🎯 Disk Latency - 평균 읽기 지연 시간 (ms) */
  diskReadLatency: MetricData;
  /** 🎯 Disk Latency - 평균 쓰기 지연 시간 (ms) */
  diskWriteLatency: MetricData;
  /** 🎯 Network BPS - 수신 (bits/sec) */
  networkReceiveBps: MetricData;
  /** 🎯 Network BPS - 송신 (bits/sec) */
  networkTransmitBps: MetricData;
  /** 🎯 Network PPS - 수신 (packets/sec) */
  networkReceivePps: MetricData;
  /** 🎯 Network PPS - 송신 (packets/sec) */
  networkTransmitPps: MetricData;
}

export type RequestClusterMetricsByNodeNames = (
  nodeNames: string[],
  params?: RequestMetricsParams,
) => Promise<ClusterMetricData>;

const requestClusterMetricsByNodeNamesInjectable = getInjectable({
  id: "get-cluster-metrics-by-node-names",
  instantiate: (di): RequestClusterMetricsByNodeNames => {
    const requestMetrics = di.inject(requestMetricsInjectable);

    return (nodeNames, params) => {
      const opts = {
        category: "cluster",
        nodes: nodeNames.join("|"),
      };

      // 🔄 변경이력: 2026-01-14 - networkReceiveBps, networkTransmitBps, networkReceivePps, networkTransmitPps 추가
      return requestMetrics(
        {
          memoryUsage: opts,
          workloadMemoryUsage: opts,
          memoryRequests: opts,
          memoryLimits: opts,
          memoryCapacity: opts,
          memoryAllocatableCapacity: opts,
          cpuUsage: opts,
          cpuRequests: opts,
          cpuLimits: opts,
          cpuCapacity: opts,
          cpuAllocatableCapacity: opts,
          podUsage: opts,
          podCapacity: opts,
          podAllocatableCapacity: opts,
          fsSize: opts,
          fsUsage: opts,
          diskReadOps: opts,
          diskWriteOps: opts,
          diskReadLatency: opts,
          diskWriteLatency: opts,
          // 🎯 Network BPS/PPS 메트릭 (듀얼 축 차트용)
          networkReceiveBps: opts,
          networkTransmitBps: opts,
          networkReceivePps: opts,
          networkTransmitPps: opts,
        },
        params,
      );
    };
  },
});

export default requestClusterMetricsByNodeNamesInjectable;
