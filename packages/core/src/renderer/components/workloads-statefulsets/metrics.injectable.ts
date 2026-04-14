/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { asyncComputed } from "@ogre-tools/injectable-react";
import { podMetricsApiInjectable } from "@skuberplus/kube-api-specifics";
import { now } from "mobx-utils";
import { getMetricsSource } from "../../../common/cluster/get-metrics-source";
import requestPodMetricsForStatefulSetsInjectable from "../../../common/k8s-api/endpoints/metrics.api/request-pod-metrics-for-stateful-sets.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { retryMetricsRequest } from "../common/retry-metrics-request";
import genericMetricsCacheInjectable from "../generic-metrics-cache.injectable";
import podStoreInjectable from "../workloads-pods/store.injectable";
import statefulSetStoreInjectable from "./store.injectable";

import type { PodMetrics, StatefulSet } from "@skuberplus/kube-object";

import type { StatefulSetPodMetricData } from "../../../common/k8s-api/endpoints/metrics.api/request-pod-metrics-for-stateful-sets.injectable";

/**
 * 🎯 목적: StatefulSet 상세 화면에서 메트릭 데이터를 Prometheus 호환 형식으로 제공
 *
 * ✅ 주요 기능:
 * - Metrics Server 선택 시: podMetricsApi + podStore 사용 (Pod 메트릭과 동일한 방식)
 *   - Child Pod들의 실제 메트릭 값을 합산하여 StatefulSet 전체 메트릭 제공
 *   - 시계열 데이터 축적하여 그래프 표시
 * - Prometheus 선택 시: 기존 방식대로 시계열 데이터 직접 사용
 *
 * 🔄 변경이력:
 * - 2025-11-06: 공통 캐시 시스템 추가하여 Metrics Server 그래프 지원
 * - 2025-11-07: Pod 메트릭과 동일한 방식 적용 (podMetricsApi + podStore 사용)
 */
const statefulSetMetricsInjectable = getInjectable({
  id: "stateful-set-metrics",
  instantiate: (di, statefulSet) => {
    const requestPodMetricsForStatefulSets = di.inject(requestPodMetricsForStatefulSetsInjectable);
    const metricsCache = di.inject(genericMetricsCacheInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);
    const statefulSetStore = di.inject(statefulSetStoreInjectable);
    const podStore = di.inject(podStoreInjectable);
    const podMetricsApi = di.inject(podMetricsApiInjectable);

    return asyncComputed({
      betweenUpdates: "show-latest-value",
      getValueFromObservedPromise: async () => {
        now(60 * 1000);

        // 사용자가 선택한 메트릭 소스 확인
        // 🔄 변경: 새로운 metricsSource 필드 사용 (구식 prometheusProvider.type 대신)
        const preferences = hostedCluster?.preferences;
        const metricsSource = getMetricsSource(preferences);
        const isMetricsServerSelected = metricsSource === "metrics-server";

        try {
          let metricsData: StatefulSetPodMetricData;

          // 🎯 Metrics Server 선택 시: Pod 메트릭과 동일한 방식 사용 (podMetricsApi + podStore)
          if (isMetricsServerSelected) {
            const childPods = statefulSetStore.getChildPods(statefulSet);

            if (childPods.length > 0) {
              // 🎯 Pod 메트릭과 동일한 방식: podMetricsApi로 직접 조회
              const metrics = await retryMetricsRequest(() => podMetricsApi.list({ namespace: statefulSet.getNs() }), {
                label: "statefulset-metrics:list",
              });
              // 🔄 변경이력: 2026-01-26 - Race Condition 해결
              //   loadKubeMetrics 반환값을 직접 사용하여 MobX observable 업데이트 타이밍 문제 우회
              const loadedMetrics = await retryMetricsRequest(() => podStore.loadKubeMetrics(statefulSet.getNs()), {
                label: "statefulset-metrics:load",
              });

              // 🔄 각 Child Pod의 메트릭 값 합산
              let totalCpu = 0;
              let totalMemory = 0;
              let matchedPods = 0;

              childPods.forEach((pod) => {
                const podMetric = metrics?.find((m: PodMetrics) => m.getName() === pod.getName());
                const kubeMetrics = podStore.getPodKubeMetrics(pod, loadedMetrics ?? undefined);

                const cpuValue = podMetric ? kubeMetrics.cpu || 0 : 0;
                const memoryValue = podMetric ? kubeMetrics.memory || 0 : 0;
                if (podMetric) {
                  matchedPods += 1;
                }

                totalCpu += cpuValue;
                totalMemory += memoryValue;
              });

              if (matchedPods === 0) {
                const lastValues = metricsCache.getLastValues(statefulSet);
                if (lastValues) {
                  totalCpu = lastValues.cpu;
                  totalMemory = lastValues.memory;
                }
              }

              // 단일 데이터 포인트 생성 (Metrics Server 스타일)
              const timestamp = Math.floor(Date.now() / 1000);
              metricsData = {
                cpuUsage: {
                  status: "success",
                  data: {
                    resultType: "matrix",
                    result: [
                      {
                        metric: { statefulset: statefulSet.getName() },
                        values: [[timestamp, totalCpu.toString()]] as [number, string][],
                      },
                    ],
                  },
                },
                memoryUsage: {
                  status: "success",
                  data: {
                    resultType: "matrix",
                    result: [
                      {
                        metric: { statefulset: statefulSet.getName() },
                        values: [[timestamp, totalMemory.toString()]] as [number, string][],
                      },
                    ],
                  },
                },
                fsUsage: { status: "success", data: { resultType: "matrix", result: [] } },
                fsWrites: { status: "success", data: { resultType: "matrix", result: [] } },
                fsReads: { status: "success", data: { resultType: "matrix", result: [] } },
                networkReceive: { status: "success", data: { resultType: "matrix", result: [] } },
                networkTransmit: { status: "success", data: { resultType: "matrix", result: [] } },
                // 🎯 Network BPS/PPS (듀얼 축 차트용) - Metrics Server에서는 미지원
                networkReceiveBps: { status: "success", data: { resultType: "matrix", result: [] } },
                networkTransmitBps: { status: "success", data: { resultType: "matrix", result: [] } },
                networkReceivePps: { status: "success", data: { resultType: "matrix", result: [] } },
                networkTransmitPps: { status: "success", data: { resultType: "matrix", result: [] } },
              };
            } else {
              console.warn(`⚠️ [STATEFULSET-METRICS] No child pods found for statefulSet ${statefulSet.getName()}`);
              metricsData = {
                cpuUsage: { status: "success", data: { resultType: "matrix", result: [] } },
                memoryUsage: { status: "success", data: { resultType: "matrix", result: [] } },
                fsUsage: { status: "success", data: { resultType: "matrix", result: [] } },
                fsWrites: { status: "success", data: { resultType: "matrix", result: [] } },
                fsReads: { status: "success", data: { resultType: "matrix", result: [] } },
                networkReceive: { status: "success", data: { resultType: "matrix", result: [] } },
                networkTransmit: { status: "success", data: { resultType: "matrix", result: [] } },
                // 🎯 Network BPS/PPS (듀얼 축 차트용)
                networkReceiveBps: { status: "success", data: { resultType: "matrix", result: [] } },
                networkTransmitBps: { status: "success", data: { resultType: "matrix", result: [] } },
                networkReceivePps: { status: "success", data: { resultType: "matrix", result: [] } },
                networkTransmitPps: { status: "success", data: { resultType: "matrix", result: [] } },
              };
            }
          } else {
            // Prometheus 모드: 기존 방식 사용
            metricsData = await requestPodMetricsForStatefulSets([statefulSet], statefulSet.getNs());
          }

          const cpuValues = metricsData?.cpuUsage?.data?.result?.[0]?.values;
          const memoryValues = metricsData?.memoryUsage?.data?.result?.[0]?.values;

          // 단일 포인트 감지 시 캐시 사용 (Metrics Server 및 auto-detect-smart 폴백 모두 지원)
          if (cpuValues && cpuValues.length === 1 && memoryValues && memoryValues.length === 1) {
            const cpuValue = parseFloat(cpuValues[0][1]) || 0;
            const memoryValue = parseFloat(memoryValues[0][1]) || 0;

            metricsCache.addMetricDataPoint(statefulSet, cpuValue, memoryValue);

            let cpuChartData = metricsCache.getCpuChartData(statefulSet);
            let memoryChartData = metricsCache.getMemoryChartData(statefulSet);

            if (!cpuChartData || cpuChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              cpuChartData = [[now, "0"] as [number, string]];
            }
            if (!memoryChartData || memoryChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              memoryChartData = [[now, "0"] as [number, string]];
            }

            const cachedMetricData: StatefulSetPodMetricData = {
              cpuUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [
                    {
                      metric: metricsData.cpuUsage.data.result[0]?.metric || { statefulset: statefulSet.getName() },
                      values: cpuChartData as [number, string][],
                    },
                  ],
                },
              },
              memoryUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [
                    {
                      metric: metricsData.memoryUsage.data.result[0]?.metric || { statefulset: statefulSet.getName() },
                      values: memoryChartData as [number, string][],
                    },
                  ],
                },
              },
              fsUsage: metricsData.fsUsage,
              fsWrites: metricsData.fsWrites,
              fsReads: metricsData.fsReads,
              networkReceive: metricsData.networkReceive,
              networkTransmit: metricsData.networkTransmit,
              // 🎯 Network BPS/PPS (듀얼 축 차트용)
              networkReceiveBps: metricsData.networkReceiveBps,
              networkTransmitBps: metricsData.networkTransmitBps,
              networkReceivePps: metricsData.networkReceivePps,
              networkTransmitPps: metricsData.networkTransmitPps,
            };

            return cachedMetricData;
          }

          return metricsData;
        } catch (error) {
          console.warn(`❌ [STATEFULSET-METRICS] Failed to load metrics for ${statefulSet.getName()}:`, error);

          return {
            cpuUsage: { status: "error", data: { resultType: "matrix", result: [] } },
            memoryUsage: { status: "error", data: { resultType: "matrix", result: [] } },
            fsUsage: { status: "error", data: { resultType: "matrix", result: [] } },
            fsWrites: { status: "error", data: { resultType: "matrix", result: [] } },
            fsReads: { status: "error", data: { resultType: "matrix", result: [] } },
            networkReceive: { status: "error", data: { resultType: "matrix", result: [] } },
            networkTransmit: { status: "error", data: { resultType: "matrix", result: [] } },
            // 🎯 Network BPS/PPS (듀얼 축 차트용)
            networkReceiveBps: { status: "error", data: { resultType: "matrix", result: [] } },
            networkTransmitBps: { status: "error", data: { resultType: "matrix", result: [] } },
            networkReceivePps: { status: "error", data: { resultType: "matrix", result: [] } },
            networkTransmitPps: { status: "error", data: { resultType: "matrix", result: [] } },
          };
        }
      },
    });
  },
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (di, statefulSet: StatefulSet) => statefulSet.getId(),
  }),
});

export default statefulSetMetricsInjectable;
