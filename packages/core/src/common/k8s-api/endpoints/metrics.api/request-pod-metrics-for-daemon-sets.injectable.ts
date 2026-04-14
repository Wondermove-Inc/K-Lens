/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import requestMetricsInjectable from "./request-metrics.injectable";

import type { DaemonSet } from "@skuberplus/kube-object";

import type { MetricData } from "../metrics.api";

/**
 * 🎯 DaemonSet Pod 메트릭 데이터 인터페이스
 *
 * 🔄 변경이력:
 * - 2026-01-14: networkReceiveBps, networkTransmitBps, networkReceivePps, networkTransmitPps 추가
 *              (Network BPS/PPS 듀얼 축 차트 지원)
 */
export interface DaemonSetPodMetricData {
  cpuUsage: MetricData;
  memoryUsage: MetricData;
  fsUsage: MetricData;
  fsWrites: MetricData;
  fsReads: MetricData;
  networkReceive: MetricData;
  networkTransmit: MetricData;
  /** 🎯 Network BPS - 수신 (bits/sec) */
  networkReceiveBps: MetricData;
  /** 🎯 Network BPS - 송신 (bits/sec) */
  networkTransmitBps: MetricData;
  /** 🎯 Network PPS - 수신 (packets/sec) */
  networkReceivePps: MetricData;
  /** 🎯 Network PPS - 송신 (packets/sec) */
  networkTransmitPps: MetricData;
}

export type RequestPodMetricsForDaemonSets = (
  daemonsets: DaemonSet[],
  namespace: string,
  selector?: string,
) => Promise<DaemonSetPodMetricData>;

const requestPodMetricsForDaemonSetsInjectable = getInjectable({
  id: "request-pod-metrics-for-daemon-sets",
  instantiate: (di): RequestPodMetricsForDaemonSets => {
    const requestMetrics = di.inject(requestMetricsInjectable);

    return (daemonSets, namespace, selector = "") => {
      const podSelector = daemonSets.map((daemonSet) => `${daemonSet.getName()}-[[:alnum:]]{5}`).join("|");
      const opts = { category: "pods", pods: podSelector, namespace, selector };

      // 🔄 변경이력: 2026-01-14 - networkReceiveBps, networkTransmitBps, networkReceivePps, networkTransmitPps 추가
      return requestMetrics(
        {
          cpuUsage: opts,
          memoryUsage: opts,
          fsUsage: opts,
          fsWrites: opts,
          fsReads: opts,
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

export default requestPodMetricsForDaemonSetsInjectable;
