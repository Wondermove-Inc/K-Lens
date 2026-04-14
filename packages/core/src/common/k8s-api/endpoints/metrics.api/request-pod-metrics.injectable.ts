/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import requestMetricsInjectable from "./request-metrics.injectable";

import type { Container, Pod } from "@skuberplus/kube-object";

import type { MetricData } from "../metrics.api";

/**
 * 🎯 Pod 메트릭 데이터 인터페이스
 *
 * 🔄 변경이력:
 * - 2026-01-14: fsReadLatency, fsWriteLatency 추가 (Disk IOPS + Latency 이중 축 차트 지원)
 * - 2026-01-14: networkReceiveBps, networkTransmitBps, networkReceivePps, networkTransmitPps 추가
 *              (Network BPS/PPS 듀얼 축 차트 지원)
 */
export interface PodMetricData {
  cpuUsage: MetricData;
  memoryUsage: MetricData;
  fsUsage: MetricData;
  fsWrites: MetricData;
  fsReads: MetricData;
  fsReadLatency: MetricData;
  fsWriteLatency: MetricData;
  networkReceive: MetricData;
  networkTransmit: MetricData;
  // 🎯 Network BPS/PPS 메트릭 (듀얼 축 차트용)
  networkReceiveBps: MetricData;
  networkTransmitBps: MetricData;
  networkReceivePps: MetricData;
  networkTransmitPps: MetricData;
  cpuRequests: MetricData;
  cpuLimits: MetricData;
  memoryRequests: MetricData;
  memoryLimits: MetricData;
}

export type RequestPodMetrics = (
  pods: Pod[],
  namespace: string,
  container?: Container,
  selector?: string,
) => Promise<PodMetricData>;

const requestPodMetricsInjectable = getInjectable({
  id: "request-pod-metrics",
  instantiate: (di): RequestPodMetrics => {
    const requestMetrics = di.inject(requestMetricsInjectable);

    return async (pods, namespace, container, selector = "pod, namespace") => {
      // 🎯 향후 개선: Kubernetes Metrics Server 직접 사용
      // TODO: 현재는 아키텍처 제약으로 인해 비활성화됨 (common에서 renderer/main 의존성 불가)
      // 향후 Provider 패턴으로 리팩토링 시 활성화 예정

      const podSelector = pods.map((pod) => pod.getName()).join("|");
      const opts = { category: "pods", pods: podSelector, container: container?.name, namespace, selector };

      // 🔄 변경이력: 2026-01-14 - fsReadLatency, fsWriteLatency, networkBps/Pps 추가
      return requestMetrics(
        {
          cpuUsage: opts,
          cpuRequests: opts,
          cpuLimits: opts,
          memoryUsage: opts,
          memoryRequests: opts,
          memoryLimits: opts,
          fsUsage: opts,
          fsWrites: opts,
          fsReads: opts,
          fsReadLatency: opts,
          fsWriteLatency: opts,
          networkReceive: opts,
          networkTransmit: opts,
          // 🎯 Network BPS/PPS 메트릭 (듀얼 축 차트용)
          networkReceiveBps: opts,
          networkTransmitBps: opts,
          networkReceivePps: opts,
          networkTransmitPps: opts,
        },
        {
          namespace,
        },
      );
    };
  },
});

export default requestPodMetricsInjectable;
