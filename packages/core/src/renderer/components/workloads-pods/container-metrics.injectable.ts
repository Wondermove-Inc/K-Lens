/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { asyncComputed } from "@ogre-tools/injectable-react";
import { cpuUnitsToNumber, unitsToBytes } from "@skuberplus/utilities";
import { now } from "mobx-utils";
import { getMetricsSource } from "../../../common/cluster/get-metrics-source";
import requestPodMetricsInjectable from "../../../common/k8s-api/endpoints/metrics.api/request-pod-metrics.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { retryMetricsRequest } from "../common/retry-metrics-request";
import genericMetricsCacheInjectable from "../generic-metrics-cache.injectable";
import podStoreInjectable from "./store.injectable";

import type { Container, Pod } from "@skuberplus/kube-object";

interface PodContainerParams {
  pod: Pod;
  container: Container;
}

const podContainerMetricsInjectable = getInjectable({
  id: "pod-container-metrics",
  instantiate: (di, { pod, container }) => {
    const requestPodMetrics = di.inject(requestPodMetricsInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);
    const metricsCache = di.inject(genericMetricsCacheInjectable);
    const podStore = di.inject(podStoreInjectable);

    return asyncComputed({
      betweenUpdates: "show-latest-value", // 🔄 재검증 중에도 이전 데이터 유지 (로딩 스피너 방지)
      getValueFromObservedPromise: async () => {
        now(60 * 1000);

        // 🎯 사용자가 선택한 메트릭 소스 확인
        // 🔄 변경: 새로운 metricsSource 필드 사용 (구식 prometheusProvider.type 대신)
        const preferences = hostedCluster?.preferences;
        const metricsSource = getMetricsSource(preferences);
        const isMetricsServerSelected = metricsSource === "metrics-server";

        if (isMetricsServerSelected) {
          // 🎯 메트릭서버 선택된 경우 메트릭서버 시도
          try {
            // 🔥 Pod 메트릭과 동일: podStore를 통해 메트릭 로드
            await retryMetricsRequest(() => podStore.loadKubeMetrics(pod.getNs()), {
              label: "container-metrics:load",
            });

            // 🎯 podStore의 kubeMetrics에서 직접 가져오기 (캐시 문제 방지)
            const podMetric = podStore.kubeMetrics?.find((metric) => {
              return metric.getName() === pod.getName() && metric.getNs() === pod.getNs();
            });

            if (podMetric) {
              // 특정 컨테이너의 메트릭만 추출
              const containerMetric = podMetric.containers?.find((c) => c.name === container.name);

              if (containerMetric) {
                // 🎯 Container ID 생성: Pod ID + Container 이름
                const containerId = `${pod.getId()}-${container.name}`;

                // 📊 메트릭 값 추출 및 단위 변환 (Pod 메트릭과 동일한 방식)
                const cpu = containerMetric.usage?.cpu || "0";
                const memory = containerMetric.usage?.memory || "0";
                const cpuValue = cpuUnitsToNumber(cpu) ?? 0;
                const memoryValue = unitsToBytes(memory);

                // 🔄 캐시에 데이터 포인트 추가
                metricsCache.addMetricDataPoint(containerId, cpuValue, memoryValue);

                // 📈 캐시에서 시계열 데이터 조회
                let cpuChartData = metricsCache.getCpuChartData(containerId);
                let memoryChartData = metricsCache.getMemoryChartData(containerId);

                // ⚠️ 캐시가 비어있을 경우 기본값 설정
                if (!cpuChartData || cpuChartData.length === 0) {
                  const now = Math.floor(Date.now() / 1000);
                  cpuChartData = [[now, "0"] as [number, string]];
                }
                if (!memoryChartData || memoryChartData.length === 0) {
                  const now = Math.floor(Date.now() / 1000);
                  memoryChartData = [[now, "0"] as [number, string]];
                }
                return {
                  cpuUsage: {
                    status: "success",
                    data: {
                      resultType: "matrix",
                      result: [{ metric: { container: container.name }, values: cpuChartData as [number, string][] }],
                    },
                  },
                  memoryUsage: {
                    status: "success",
                    data: {
                      resultType: "matrix",
                      result: [
                        { metric: { container: container.name }, values: memoryChartData as [number, string][] },
                      ],
                    },
                  },
                  fsUsage: { status: "success", data: { resultType: "matrix", result: [] } },
                  fsWrites: { status: "success", data: { resultType: "matrix", result: [] } },
                  fsReads: { status: "success", data: { resultType: "matrix", result: [] } },
                  fsReadLatency: { status: "success", data: { resultType: "matrix", result: [] } },
                  fsWriteLatency: { status: "success", data: { resultType: "matrix", result: [] } },
                  networkReceive: { status: "success", data: { resultType: "matrix", result: [] } },
                  networkTransmit: { status: "success", data: { resultType: "matrix", result: [] } },
                  // 🎯 Network BPS/PPS 메트릭 (Metrics Server에서는 미지원)
                  networkReceiveBps: { status: "success", data: { resultType: "matrix", result: [] } },
                  networkTransmitBps: { status: "success", data: { resultType: "matrix", result: [] } },
                  networkReceivePps: { status: "success", data: { resultType: "matrix", result: [] } },
                  networkTransmitPps: { status: "success", data: { resultType: "matrix", result: [] } },
                  cpuRequests: { status: "success", data: { resultType: "matrix", result: [] } },
                  cpuLimits: { status: "success", data: { resultType: "matrix", result: [] } },
                  memoryRequests: { status: "success", data: { resultType: "matrix", result: [] } },
                  memoryLimits: { status: "success", data: { resultType: "matrix", result: [] } },
                };
              }
            }

            // 메트릭을 찾지 못한 경우에도 최근 값 유지
            console.warn(
              `⚠️  [CONTAINER-METRICS] Container metrics not found for ${container.name}, using default values`,
            );
            const containerId = `${pod.getId()}-${container.name}`;
            const lastValues = metricsCache.getLastValues(containerId);
            const cpuValue = lastValues?.cpu ?? 0;
            const memoryValue = lastValues?.memory ?? 0;

            metricsCache.addMetricDataPoint(containerId, cpuValue, memoryValue);

            let cpuChartData = metricsCache.getCpuChartData(containerId);
            let memoryChartData = metricsCache.getMemoryChartData(containerId);

            if (!cpuChartData || cpuChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              cpuChartData = [[now, "0"] as [number, string]];
            }
            if (!memoryChartData || memoryChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              memoryChartData = [[now, "0"] as [number, string]];
            }

            return {
              cpuUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [{ metric: { container: container.name }, values: cpuChartData as [number, string][] }],
                },
              },
              memoryUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [{ metric: { container: container.name }, values: memoryChartData as [number, string][] }],
                },
              },
              fsUsage: { status: "success", data: { resultType: "matrix", result: [] } },
              fsWrites: { status: "success", data: { resultType: "matrix", result: [] } },
              fsReads: { status: "success", data: { resultType: "matrix", result: [] } },
              fsReadLatency: { status: "success", data: { resultType: "matrix", result: [] } },
              fsWriteLatency: { status: "success", data: { resultType: "matrix", result: [] } },
              networkReceive: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmit: { status: "success", data: { resultType: "matrix", result: [] } },
              // 🎯 Network BPS/PPS 메트릭 (Metrics Server에서는 미지원)
              networkReceiveBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkReceivePps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitPps: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuLimits: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryLimits: { status: "success", data: { resultType: "matrix", result: [] } },
            };
          } catch (error) {
            console.warn(
              `⚠️  [CONTAINER-METRICS] Metrics Server failed for ${container.name}, using default values`,
              error,
            );

            const containerId = `${pod.getId()}-${container.name}`;
            const lastValues = metricsCache.getLastValues(containerId);
            const cpuValue = lastValues?.cpu ?? 0;
            const memoryValue = lastValues?.memory ?? 0;

            metricsCache.addMetricDataPoint(containerId, cpuValue, memoryValue);

            let cpuChartData = metricsCache.getCpuChartData(containerId);
            let memoryChartData = metricsCache.getMemoryChartData(containerId);

            if (!cpuChartData || cpuChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              cpuChartData = [[now, "0"] as [number, string]];
            }
            if (!memoryChartData || memoryChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              memoryChartData = [[now, "0"] as [number, string]];
            }

            return {
              cpuUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [{ metric: { container: container.name }, values: cpuChartData as [number, string][] }],
                },
              },
              memoryUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [{ metric: { container: container.name }, values: memoryChartData as [number, string][] }],
                },
              },
              fsUsage: { status: "success", data: { resultType: "matrix", result: [] } },
              fsWrites: { status: "success", data: { resultType: "matrix", result: [] } },
              fsReads: { status: "success", data: { resultType: "matrix", result: [] } },
              fsReadLatency: { status: "success", data: { resultType: "matrix", result: [] } },
              fsWriteLatency: { status: "success", data: { resultType: "matrix", result: [] } },
              networkReceive: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmit: { status: "success", data: { resultType: "matrix", result: [] } },
              // 🎯 Network BPS/PPS 메트릭 (Metrics Server에서는 미지원)
              networkReceiveBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkReceivePps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitPps: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuLimits: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryLimits: { status: "success", data: { resultType: "matrix", result: [] } },
            };
          }
        }

        // 🎯 기본값: 프로메테우스 사용 (메트릭 서버가 선택되지 않은 모든 경우)
        try {
          const metricsData = await requestPodMetrics([pod], pod.getNs(), container, "pod, container, namespace");

          // 🎯 데이터 포인트 개수 확인 (auto-detect 모드 지원)
          const cpuValues = metricsData?.cpuUsage?.data?.result?.[0]?.values || [];
          const memoryValues = metricsData?.memoryUsage?.data?.result?.[0]?.values || [];

          // 🎯 단일 데이터 포인트 = Metrics Server 방식 → 캐시에 축적
          if (cpuValues.length === 1 && memoryValues.length === 1) {
            const containerId = `${pod.getId()}-${container.name}`;
            const cpuValue = parseFloat(cpuValues[0][1]) || 0;
            const memoryValue = parseFloat(memoryValues[0][1]) || 0;

            // 🔄 캐시에 데이터 포인트 추가
            metricsCache.addMetricDataPoint(containerId, cpuValue, memoryValue);

            // 📈 캐시에서 시계열 데이터 조회
            let cpuChartData = metricsCache.getCpuChartData(containerId);
            let memoryChartData = metricsCache.getMemoryChartData(containerId);

            // ⚠️ 캐시가 비어있을 경우 기본값 설정
            if (!cpuChartData || cpuChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              cpuChartData = [[now, "0"] as [number, string]];
            }
            if (!memoryChartData || memoryChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              memoryChartData = [[now, "0"] as [number, string]];
            }
            return {
              ...metricsData,
              cpuUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [{ metric: { container: container.name }, values: cpuChartData as [number, string][] }],
                },
              },
              memoryUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [{ metric: { container: container.name }, values: memoryChartData as [number, string][] }],
                },
              },
            };
          }

          return metricsData;
        } catch (error) {
          console.warn(`❌ [CONTAINER-METRICS] Failed to load Prometheus metrics for ${container.name}:`, error);

          // 🔄 실패 시에도 기본 데이터 포인트로 그래프 표시
          const now = Math.floor(Date.now() / 1000);
          return {
            cpuUsage: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: { container: container.name }, values: [[now, "0"]] as [number, string][] }],
              },
            },
            memoryUsage: {
              status: "success",
              data: {
                resultType: "matrix",
                result: [{ metric: { container: container.name }, values: [[now, "0"]] as [number, string][] }],
              },
            },
            fsUsage: { status: "success", data: { resultType: "matrix", result: [] } },
            fsWrites: { status: "success", data: { resultType: "matrix", result: [] } },
            fsReads: { status: "success", data: { resultType: "matrix", result: [] } },
            fsReadLatency: { status: "success", data: { resultType: "matrix", result: [] } },
            fsWriteLatency: { status: "success", data: { resultType: "matrix", result: [] } },
            networkReceive: { status: "success", data: { resultType: "matrix", result: [] } },
            networkTransmit: { status: "success", data: { resultType: "matrix", result: [] } },
            // 🎯 Network BPS/PPS 메트릭
            networkReceiveBps: { status: "success", data: { resultType: "matrix", result: [] } },
            networkTransmitBps: { status: "success", data: { resultType: "matrix", result: [] } },
            networkReceivePps: { status: "success", data: { resultType: "matrix", result: [] } },
            networkTransmitPps: { status: "success", data: { resultType: "matrix", result: [] } },
            cpuRequests: { status: "success", data: { resultType: "matrix", result: [] } },
            cpuLimits: { status: "success", data: { resultType: "matrix", result: [] } },
            memoryRequests: { status: "success", data: { resultType: "matrix", result: [] } },
            memoryLimits: { status: "success", data: { resultType: "matrix", result: [] } },
          };
        }
      },
    });
  },
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (_di, { pod, container }: PodContainerParams) => {
      return `${pod.getId()}-${container.name}`;
    },
  }),
});

export default podContainerMetricsInjectable;
