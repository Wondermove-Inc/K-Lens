/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { asyncComputed } from "@ogre-tools/injectable-react";
import { podMetricsApiInjectable } from "@skuberplus/kube-api-specifics";
import { PodMetrics } from "@skuberplus/kube-object";
import { now } from "mobx-utils";
import { getMetricsSource } from "../../../common/cluster/get-metrics-source";
import requestPodMetricsInjectable from "../../../common/k8s-api/endpoints/metrics.api/request-pod-metrics.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { retryMetricsRequest } from "../common/retry-metrics-request";
import podMetricsCacheInjectable from "./metrics-cache.injectable";
import podStoreInjectable from "./store.injectable";

import type { Pod } from "@skuberplus/kube-object";

import type { PodMetricData } from "../../../common/k8s-api/endpoints/metrics.api/request-pod-metrics.injectable";

/**
 * 🎯 목적: Pod 상세 화면에서 메트릭 데이터를 Prometheus 호환 형식으로 제공
 *
 * ✅ 해결책: PodStore.getPodKubeMetrics() 사용 (Pod 목록과 동일한 방식)
 * - Pod 목록에서 정상 작동하는 방식을 Pod 상세에서도 동일하게 적용
 * - 복잡한 requestPodMetrics 대신 간단하고 신뢰할 수 있는 PodStore 사용
 *
 * 🔄 변경이력:
 * - 2025-09-25: PodStore 방식으로 변경하여 메트릭 표시 문제 해결
 * - 2025-09-26: 메트릭 캐시 시스템 추가하여 시간별 그래프 표시 지원
 */
const podMetricsInjectable = getInjectable({
  id: "pod-metrics",
  instantiate: (di, pod) => {
    const podStore = di.inject(podStoreInjectable);
    const metricsCache = di.inject(podMetricsCacheInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);
    const requestPodMetrics = di.inject(requestPodMetricsInjectable);
    const podMetricsApi = di.inject(podMetricsApiInjectable);

    return asyncComputed({
      betweenUpdates: "show-latest-value", // 🔄 재검증 중에도 이전 데이터 유지 (로딩 스피너 방지)
      getValueFromObservedPromise: async () => {
        now(60 * 1000); // 60초마다 갱신

        // 🎯 사용자가 선택한 메트릭 소스 확인
        // 🔄 변경: 새로운 metricsSource 필드 사용 (구식 prometheusProvider.type 대신)
        const preferences = hostedCluster?.preferences;
        const metricsSource = getMetricsSource(preferences);
        const isMetricsServerSelected = metricsSource === "metrics-server";

        if (isMetricsServerSelected) {
          // 🔥 메트릭서버 선택: 직접 API 호출하여 메트릭 획득
          try {
            const metrics = await retryMetricsRequest(() => podMetricsApi.list({ namespace: pod.getNs() }), {
              label: "pod-metrics:list",
            });
            const podMetric = metrics?.find((m: PodMetrics) => m.getName() === pod.getName());

            // 🎯 메트릭이 있든 없든 항상 차트 데이터를 제공해야 함
            // Pod Store를 통해 메트릭 로드
            // 🔄 변경이력: 2026-01-26 - Race Condition 해결
            //   loadKubeMetrics 반환값을 직접 사용하여 MobX observable 업데이트 타이밍 문제 우회
            const loadedMetrics = await retryMetricsRequest(() => podStore.loadKubeMetrics(pod.getNs()), {
              label: "pod-metrics:load",
            });
            const kubeMetrics = podStore.getPodKubeMetrics(pod, loadedMetrics ?? undefined);

            // CPU와 Memory 값 파싱 (없으면 최근 값 유지)
            let cpuValue = 0;
            let memoryValue = 0;
            if (podMetric) {
              cpuValue = kubeMetrics.cpu || 0;
              memoryValue = kubeMetrics.memory || 0;
            } else {
              const lastValues = metricsCache.getLastValues(pod);
              if (lastValues) {
                cpuValue = lastValues.cpu;
                memoryValue = lastValues.memory;
              }
            }

            // 🔄 캐시에 새 데이터 포인트 추가 (시간별 그래프용)
            metricsCache.addMetricDataPoint(pod, cpuValue, memoryValue);

            // 📊 캐시된 모든 데이터 포인트를 차트 형식으로 변환
            let cpuChartData = metricsCache.getCpuChartData(pod);
            let memoryChartData = metricsCache.getMemoryChartData(pod);

            // 🎯 데이터가 없으면 기본 데이터 포인트 생성 (빈 그래프 대신 0값 그래프 표시)
            if (!cpuChartData || cpuChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              cpuChartData = [[now, "0"] as [number, string]];
            }
            if (!memoryChartData || memoryChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              memoryChartData = [[now, "0"] as [number, string]];
            }

            // 📈 Prometheus 호환 형식으로 변환 (시간별 데이터 포함)
            const metricData: PodMetricData = {
              cpuUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [
                    {
                      metric: { pod: pod.getName() },
                      values: cpuChartData as [number, string][], // 🎯 캐시된 시간별 데이터 사용
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
                      metric: { pod: pod.getName() },
                      values: memoryChartData as [number, string][], // 🎯 캐시된 시간별 데이터 사용
                    },
                  ],
                },
              },
              // 🚫 지원하지 않는 메트릭은 빈 결과로 반환 (UI에서 숨김)
              fsUsage: { status: "success", data: { resultType: "matrix", result: [] } },
              fsWrites: { status: "success", data: { resultType: "matrix", result: [] } },
              fsReads: { status: "success", data: { resultType: "matrix", result: [] } },
              fsReadLatency: { status: "success", data: { resultType: "matrix", result: [] } },
              fsWriteLatency: { status: "success", data: { resultType: "matrix", result: [] } },
              networkReceive: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmit: { status: "success", data: { resultType: "matrix", result: [] } },
              networkReceiveBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkReceivePps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitPps: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuLimits: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryLimits: { status: "success", data: { resultType: "matrix", result: [] } },
            };
            return metricData;
          } catch (error) {
            console.warn(`⚠️  메트릭 서버 API 호출 실패: ${pod.getName()} - ${error}`);

            const lastValues = metricsCache.getLastValues(pod);
            const cpuValue = lastValues?.cpu ?? 0;
            const memoryValue = lastValues?.memory ?? 0;

            metricsCache.addMetricDataPoint(pod, cpuValue, memoryValue);

            let cpuChartData = metricsCache.getCpuChartData(pod);
            let memoryChartData = metricsCache.getMemoryChartData(pod);

            if (!cpuChartData || cpuChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              cpuChartData = [[now, "0"] as [number, string]];
            }
            if (!memoryChartData || memoryChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              memoryChartData = [[now, "0"] as [number, string]];
            }

            const errorMetricData: PodMetricData = {
              cpuUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [
                    {
                      metric: { pod: pod.getName() },
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
                      metric: { pod: pod.getName() },
                      values: memoryChartData as [number, string][],
                    },
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
              networkReceiveBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkReceivePps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitPps: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuLimits: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryLimits: { status: "success", data: { resultType: "matrix", result: [] } },
            };
            return errorMetricData;
          }
        }

        // 🎯 기본값: 프로메테우스 사용 (메트릭 서버가 선택되지 않은 모든 경우)
        try {
          // requestPodMetrics는 이미 Prometheus API를 통해 메트릭을 가져옴
          const metricsData = await requestPodMetrics([pod], pod.getNs());

          // 🎯 데이터 포인트 개수 확인 (auto-detect 모드 지원)
          const cpuValues = metricsData?.cpuUsage?.data?.result?.[0]?.values || [];
          const memoryValues = metricsData?.memoryUsage?.data?.result?.[0]?.values || [];

          // 🎯 단일 데이터 포인트 = Metrics Server 방식 → 캐시에 축적
          if (cpuValues.length === 1 && memoryValues.length === 1) {
            // 🎯 수정: 서버 응답값 대신 podStore에서 직접 메트릭 획득 (Metrics Server 직접 선택과 동일)
            await podStore.loadKubeMetrics(pod.getNs());
            const kubeMetrics = podStore.getPodKubeMetrics(pod);
            const cpuValue = kubeMetrics.cpu || 0;
            const memoryValue = kubeMetrics.memory || 0;
            metricsCache.addMetricDataPoint(pod, cpuValue, memoryValue);

            // 📊 캐시된 모든 데이터 포인트를 차트 형식으로 변환
            let cpuChartData = metricsCache.getCpuChartData(pod);
            let memoryChartData = metricsCache.getMemoryChartData(pod);

            // 🎯 데이터가 없으면 기본 데이터 포인트 생성
            if (!cpuChartData || cpuChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              cpuChartData = [[now, "0"] as [number, string]];
            }
            if (!memoryChartData || memoryChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              memoryChartData = [[now, "0"] as [number, string]];
            }

            // 📈 캐시된 데이터로 응답 구성
            return {
              ...metricsData,
              cpuUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [
                    {
                      metric: { pod: pod.getName() },
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
                      metric: { pod: pod.getName() },
                      values: memoryChartData as [number, string][],
                    },
                  ],
                },
              },
            };
          }

          return metricsData;
        } catch (error) {
          console.warn(`❌ [POD-METRICS] Failed to load Prometheus metrics for ${pod.getName()}:`, error);

          // 빈 메트릭 데이터 반환
          return {
            cpuUsage: { status: "error", data: { resultType: "matrix", result: [] } },
            memoryUsage: { status: "error", data: { resultType: "matrix", result: [] } },
            fsUsage: { status: "error", data: { resultType: "matrix", result: [] } },
            fsWrites: { status: "error", data: { resultType: "matrix", result: [] } },
            fsReads: { status: "error", data: { resultType: "matrix", result: [] } },
            fsReadLatency: { status: "error", data: { resultType: "matrix", result: [] } },
            fsWriteLatency: { status: "error", data: { resultType: "matrix", result: [] } },
            networkReceive: { status: "error", data: { resultType: "matrix", result: [] } },
            networkTransmit: { status: "error", data: { resultType: "matrix", result: [] } },
            networkReceiveBps: { status: "error", data: { resultType: "matrix", result: [] } },
            networkTransmitBps: { status: "error", data: { resultType: "matrix", result: [] } },
            networkReceivePps: { status: "error", data: { resultType: "matrix", result: [] } },
            networkTransmitPps: { status: "error", data: { resultType: "matrix", result: [] } },
            cpuRequests: { status: "error", data: { resultType: "matrix", result: [] } },
            cpuLimits: { status: "error", data: { resultType: "matrix", result: [] } },
            memoryRequests: { status: "error", data: { resultType: "matrix", result: [] } },
            memoryLimits: { status: "error", data: { resultType: "matrix", result: [] } },
          };
        }
      },
    });
  },
  lifecycle: lifecycleEnum.keyedSingleton({
    getInstanceKey: (_di, pod: Pod) => pod.getId(),
  }),
});

export default podMetricsInjectable;
