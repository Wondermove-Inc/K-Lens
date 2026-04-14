/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { asyncComputed } from "@ogre-tools/injectable-react";
import { now } from "mobx-utils";
import { getMetricsSource } from "../../../common/cluster/get-metrics-source";
import requestClusterMetricsByNodeNamesInjectable from "../../../common/k8s-api/endpoints/metrics.api/request-cluster-metrics-by-node-names.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { retryMetricsRequest } from "../common/retry-metrics-request";
import genericMetricsCacheInjectable from "../generic-metrics-cache.injectable";
import nodeStoreInjectable from "./store.injectable";

import type { Node } from "@skuberplus/kube-object";

import type { ClusterMetricData } from "../../../common/k8s-api/endpoints/metrics.api/request-cluster-metrics-by-node-names.injectable";

/**
 * 🎯 목적: Node 상세 화면에서 메트릭 데이터를 Prometheus 호환 형식으로 제공
 *
 * ✅ 주요 기능:
 * - Metrics Server 선택 시: 시계열 데이터 축적하여 그래프 표시
 * - Prometheus 선택 시: 기존 방식대로 시계열 데이터 직접 사용
 *
 * 🔄 변경이력:
 * - 2025-11-06: 공통 캐시 시스템 추가하여 Metrics Server 그래프 지원
 */
const nodeMetricsInjectable = getInjectable({
  id: "node-metrics",
  instantiate: (di, node) => {
    const requestClusterMetricsByNodeNames = di.inject(requestClusterMetricsByNodeNamesInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);
    const metricsCache = di.inject(genericMetricsCacheInjectable);
    const nodeStore = di.inject(nodeStoreInjectable);

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
            // NodeStore를 통해 메트릭 로드
            // 🔄 변경이력: 2026-01-26 - Race Condition 해결
            //   loadKubeMetrics 반환값을 직접 사용하여 MobX observable 업데이트 타이밍 문제 우회
            const loadedMetrics = await retryMetricsRequest(() => nodeStore.loadKubeMetrics(), {
              label: "node-metrics:load",
            });
            const kubeMetrics = nodeStore.getNodeKubeMetrics(node, loadedMetrics ?? undefined);

            // CPU와 Memory 값 파싱 (없으면 최근 값 유지)
            let cpuValue = kubeMetrics.cpu || 0;
            let memoryValue = kubeMetrics.memory || 0;
            if (cpuValue === 0 && memoryValue === 0) {
              const lastValues = metricsCache.getLastValues(node);
              if (lastValues) {
                cpuValue = lastValues.cpu;
                memoryValue = lastValues.memory;
              }
            }

            // 🔄 캐시에 새 데이터 포인트 추가 (시간별 그래프용)
            metricsCache.addMetricDataPoint(node, cpuValue, memoryValue);

            // 📊 캐시된 모든 데이터 포인트를 차트 형식으로 변환
            let cpuChartData = metricsCache.getCpuChartData(node);
            let memoryChartData = metricsCache.getMemoryChartData(node);

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
            // 🔄 변경이력: 2026-01-14 - Network BPS/PPS 메트릭 추가
            const metricData: ClusterMetricData = {
              cpuUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [
                    {
                      metric: { node: node.getName() },
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
                      metric: { node: node.getName() },
                      values: memoryChartData as [number, string][], // 🎯 캐시된 시간별 데이터 사용
                    },
                  ],
                },
              },
              // 🚫 지원하지 않는 메트릭은 빈 결과로 반환 (UI에서 숨김)
              memoryRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryLimits: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryAllocatableCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuLimits: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuAllocatableCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              podUsage: { status: "success", data: { resultType: "matrix", result: [] } },
              podCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              podAllocatableCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              fsSize: { status: "success", data: { resultType: "matrix", result: [] } },
              fsUsage: { status: "success", data: { resultType: "matrix", result: [] } },
              diskReadOps: { status: "success", data: { resultType: "matrix", result: [] } },
              diskWriteOps: { status: "success", data: { resultType: "matrix", result: [] } },
              diskReadLatency: { status: "success", data: { resultType: "matrix", result: [] } },
              diskWriteLatency: { status: "success", data: { resultType: "matrix", result: [] } },
              // 🎯 Network BPS/PPS 메트릭 (Metrics Server에서는 미지원)
              networkReceiveBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkReceivePps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitPps: { status: "success", data: { resultType: "matrix", result: [] } },
            };

            return metricData;
          } catch (error) {
            console.warn(`⚠️  메트릭 서버 API 호출 실패: ${node.getName()} - ${error}`);

            const lastValues = metricsCache.getLastValues(node);
            const cpuValue = lastValues?.cpu ?? 0;
            const memoryValue = lastValues?.memory ?? 0;

            metricsCache.addMetricDataPoint(node, cpuValue, memoryValue);

            let cpuChartData = metricsCache.getCpuChartData(node);
            let memoryChartData = metricsCache.getMemoryChartData(node);

            if (!cpuChartData || cpuChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              cpuChartData = [[now, "0"] as [number, string]];
            }
            if (!memoryChartData || memoryChartData.length === 0) {
              const now = Math.floor(Date.now() / 1000);
              memoryChartData = [[now, "0"] as [number, string]];
            }

            const errorMetricData: ClusterMetricData = {
              cpuUsage: {
                status: "success",
                data: {
                  resultType: "matrix",
                  result: [
                    {
                      metric: { node: node.getName() },
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
                      metric: { node: node.getName() },
                      values: memoryChartData as [number, string][],
                    },
                  ],
                },
              },
              memoryRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryLimits: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              memoryAllocatableCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuRequests: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuLimits: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              cpuAllocatableCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              podUsage: { status: "success", data: { resultType: "matrix", result: [] } },
              podCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              podAllocatableCapacity: { status: "success", data: { resultType: "matrix", result: [] } },
              fsSize: { status: "success", data: { resultType: "matrix", result: [] } },
              fsUsage: { status: "success", data: { resultType: "matrix", result: [] } },
              diskReadOps: { status: "success", data: { resultType: "matrix", result: [] } },
              diskWriteOps: { status: "success", data: { resultType: "matrix", result: [] } },
              diskReadLatency: { status: "success", data: { resultType: "matrix", result: [] } },
              diskWriteLatency: { status: "success", data: { resultType: "matrix", result: [] } },
              // 🎯 Network BPS/PPS 메트릭
              networkReceiveBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitBps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkReceivePps: { status: "success", data: { resultType: "matrix", result: [] } },
              networkTransmitPps: { status: "success", data: { resultType: "matrix", result: [] } },
            };

            return errorMetricData;
          }
        }

        // 🎯 기본값: 프로메테우스 사용 (메트릭 서버가 선택되지 않은 모든 경우)
        try {
          // requestClusterMetricsByNodeNames는 이미 Prometheus API를 통해 메트릭을 가져옴
          const metricsData = await requestClusterMetricsByNodeNames([node.getName()]);

          return metricsData;
        } catch (error) {
          console.warn(`❌ [NODE-METRICS] Failed to load Prometheus metrics for ${node.getName()}:`, error);

          // 빈 메트릭 데이터 반환
          // 🔄 변경이력: 2026-01-14 - Network BPS/PPS 메트릭 추가
          return {
            cpuUsage: { status: "error", data: { resultType: "matrix", result: [] } },
            memoryUsage: { status: "error", data: { resultType: "matrix", result: [] } },
            memoryRequests: { status: "error", data: { resultType: "matrix", result: [] } },
            memoryLimits: { status: "error", data: { resultType: "matrix", result: [] } },
            memoryCapacity: { status: "error", data: { resultType: "matrix", result: [] } },
            memoryAllocatableCapacity: { status: "error", data: { resultType: "matrix", result: [] } },
            cpuRequests: { status: "error", data: { resultType: "matrix", result: [] } },
            cpuLimits: { status: "error", data: { resultType: "matrix", result: [] } },
            cpuCapacity: { status: "error", data: { resultType: "matrix", result: [] } },
            cpuAllocatableCapacity: { status: "error", data: { resultType: "matrix", result: [] } },
            podUsage: { status: "error", data: { resultType: "matrix", result: [] } },
            podCapacity: { status: "error", data: { resultType: "matrix", result: [] } },
            podAllocatableCapacity: { status: "error", data: { resultType: "matrix", result: [] } },
            fsSize: { status: "error", data: { resultType: "matrix", result: [] } },
            fsUsage: { status: "error", data: { resultType: "matrix", result: [] } },
            diskReadOps: { status: "error", data: { resultType: "matrix", result: [] } },
            diskWriteOps: { status: "error", data: { resultType: "matrix", result: [] } },
            diskReadLatency: { status: "error", data: { resultType: "matrix", result: [] } },
            diskWriteLatency: { status: "error", data: { resultType: "matrix", result: [] } },
            // 🎯 Network BPS/PPS 메트릭
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
    getInstanceKey: (di, node: Node) => node.getId(),
  }),
});

export default nodeMetricsInjectable;
