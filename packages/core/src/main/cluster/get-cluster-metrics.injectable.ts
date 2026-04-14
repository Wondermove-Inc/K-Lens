/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Welcome 화면에서 클러스터별 CPU/Memory 메트릭 조회를 위한 IPC Handler
 *
 * 주요 기능:
 * - 클러스터 ID로 메트릭 조회
 * - 메트릭 수집 방식별 다른 데이터 형식 반환:
 *   - Prometheus: 시계열 데이터 (여러 포인트)
 *   - Metrics Server: 실제 Kubernetes Metrics API 호출
 *   - 없음: 빈 배열
 *
 * 📝 주의사항:
 * - 연결되지 않은 클러스터는 null 반환
 * - 타임아웃: 10초 제한
 * - 권한 부족 시 null 반환 (403 에러 허용)
 *
 * 🔄 변경이력:
 * - 2025-11-30 - 초기 생성 (Welcome 화면 CPU/Memory 메트릭 지원)
 * - 2025-12-01 - 실제 Kubernetes Metrics Server API 호출 구현
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeElectronIsReadyInjectionToken } from "@skuberplus/application-for-electron-main";
import { MetricsAdapter } from "@skuberplus/kubernetes-metrics-server";
import { loggerInjectionToken } from "@skuberplus/logger";
import { getUnifiedQuery } from "@skuberplus/prometheus";
import { ipcMainHandle } from "../../common/ipc";
import getClusterByIdInjectable from "../../features/cluster/storage/common/get-by-id.injectable";
import getMetricsInjectable from "../get-metrics.injectable";
import loadProxyKubeconfigInjectable from "./load-proxy-kubeconfig.injectable";
import prometheusHandlerInjectable from "./prometheus-handler/prometheus-handler.injectable";

import type { Logger } from "@skuberplus/logger";

import type { GetClusterById } from "../../features/cluster/storage/common/get-by-id.injectable";

/**
 * 🎯 목적: Prometheus 응답 타입 정의
 */
interface PrometheusResponse {
  status: string;
  data?: {
    result?: Array<{
      values?: Array<[number, string]>;
      value?: [number, string];
    }>;
  };
}

/**
 * 🎯 목적: Prometheus 시계열 응답을 파싱하여 차트 데이터로 변환
 * @param response - Prometheus query_range 응답
 * @returns 시계열 데이터 배열
 */
function parsePrometheusTimeSeries(response: unknown): Array<{ time: string; usage: number }> {
  const res = response as PrometheusResponse;
  if (res?.status !== "success" || !res.data?.result?.[0]?.values) {
    return [];
  }

  return res.data.result[0].values.map(([timestamp, value]) => ({
    time: new Date(timestamp * 1000).toISOString(),
    usage: Number.parseFloat(value) || 0,
  }));
}

/**
 * 🎯 목적: Prometheus 단일 값 응답을 파싱
 * @param response - Prometheus query 응답
 * @returns 단일 숫자 값
 */
function parsePrometheusValue(response: unknown): number {
  const res = response as PrometheusResponse;
  if (res?.status !== "success" || !res.data?.result?.[0]) {
    return 0;
  }

  // query_range 응답 (values 배열) - 마지막 값 사용
  if (res.data.result[0].values?.length) {
    const lastValue = res.data.result[0].values[res.data.result[0].values.length - 1];
    return Number.parseFloat(lastValue[1]) || 0;
  }

  // instant query 응답 (value)
  if (res.data.result[0].value) {
    return Number.parseFloat(res.data.result[0].value[1]) || 0;
  }

  return 0;
}

/**
 * 🎯 목적: CPU 문자열을 cores 단위로 변환
 * @param cpu - Kubernetes CPU 형식 (예: "250m", "2", "100n")
 * @returns CPU cores (예: 0.25, 2, 0.0000001)
 */
function parseCpu(cpu: string): number {
  if (cpu.endsWith("m")) {
    return Number.parseFloat(cpu.slice(0, -1)) / 1000;
  }
  if (cpu.endsWith("n")) {
    return Number.parseFloat(cpu.slice(0, -1)) / 1000000000;
  }
  return Number.parseFloat(cpu) || 0;
}

/**
 * 🎯 목적: Memory 문자열을 bytes 단위로 변환
 * @param memory - Kubernetes Memory 형식 (예: "128Mi", "1Gi", "1000Ki")
 * @returns Memory bytes
 */
function parseMemory(memory: string): number {
  const units: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    k: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
  };
  for (const [suffix, mult] of Object.entries(units)) {
    if (memory.endsWith(suffix)) {
      return Number.parseFloat(memory.slice(0, -suffix.length)) * mult;
    }
  }
  return Number.parseFloat(memory) || 0;
}

/**
 * 🎯 목적: 클러스터 메트릭 데이터 타입 정의 (Renderer와 공유)
 */
export interface ClusterMetricsData {
  cpuUsage: Array<{ time: string; usage: number }>; // 시계열 또는 단일 포인트
  memoryUsage: Array<{ time: string; usage: number }>; // 시계열 또는 단일 포인트
  cpuCapacity: number; // 총 CPU (cores)
  memoryCapacity: number; // 총 메모리 (bytes)
  providerType: "prometheus" | "metrics-server" | "none";
}

/**
 * 🎯 목적: IPC 채널명 상수
 */
export const clusterGetMetricsChannel = "cluster:get-metrics";

interface Dependencies {
  readonly getClusterById: GetClusterById;
  readonly logger: Logger;
}

const getClusterMetricsInjectable = getInjectable({
  id: "get-cluster-metrics",
  instantiate: (di) => {
    const dependencies: Dependencies = {
      getClusterById: di.inject(getClusterByIdInjectable),
      logger: di.inject(loggerInjectionToken),
    };

    return {
      run: () => {
        dependencies.logger.info(`[GET-METRICS] Registering IPC handler: ${clusterGetMetricsChannel}`);

        /**
         * 🎯 목적: IPC Handler 등록
         *
         * @param clusterId - 조회할 클러스터 ID
         * @returns CPU/Memory 메트릭 데이터 또는 null (연결 안 됨/에러)
         */
        ipcMainHandle(
          clusterGetMetricsChannel,
          async (event, clusterId: string): Promise<ClusterMetricsData | null> => {
            try {
              // 🔍 클러스터 조회
              const cluster = dependencies.getClusterById(clusterId);

              if (!cluster) {
                dependencies.logger.warn(`[GET-METRICS] Cluster not found: ${clusterId}`);
                return null;
              }

              // 🚨 연결 상태 확인
              if (cluster.disconnected.get()) {
                dependencies.logger.debug(`[GET-METRICS] Cluster disconnected: ${cluster.name.get()}`);
                return null;
              }

              // 🎯 메트릭 수집 방식 확인 (새로운 metricsSource 필드 사용)
              const metricsSource = cluster.preferences?.metricsSource ?? "metrics-server";
              const clusterName = cluster.name.get();

              dependencies.logger.debug(`[GET-METRICS] Cluster ${clusterName} - Metrics source: "${metricsSource}"`);

              // 🎭 메트릭 수집 방식별 처리
              if (metricsSource === "metrics-server") {
                // 🎯 Metrics Server 모드: 실제 Kubernetes Metrics API 호출
                dependencies.logger.debug(`[GET-METRICS] Using Metrics Server for cluster: ${clusterName}`);

                try {
                  // 🔧 KubeConfig 로드 (Proxy 경유)
                  const proxyConfig = await di.inject(loadProxyKubeconfigInjectable, cluster)();
                  const { CoreV1Api, CustomObjectsApi } = await import("@skuberplus/kubernetes-client-node");
                  const apiClient = proxyConfig.makeApiClient(CoreV1Api);
                  const customObjectsApi = proxyConfig.makeApiClient(CustomObjectsApi);

                  // 🎯 MetricsAdapter로 실제 메트릭 조회
                  const metricsAdapter = new MetricsAdapter(apiClient, customObjectsApi);
                  const clusterMetrics = await metricsAdapter.getClusterMetrics({ nodes: "*" });

                  // 📊 Node Capacity 조회
                  const nodesResponse = await apiClient.listNode();
                  let totalCpuCapacity = 0;
                  let totalMemoryCapacity = 0;
                  for (const node of nodesResponse.items) {
                    totalCpuCapacity += parseCpu(node.status?.capacity?.cpu || "0");
                    totalMemoryCapacity += parseMemory(node.status?.capacity?.memory || "0");
                  }

                  // 🎯 메트릭 값 추출 (MetricsAdapter 반환 형식: [[timestamp, value]])
                  const cpuValue = Number.parseFloat(clusterMetrics.cpuUsage[0]?.[1] || "0");
                  const memoryValue = Number.parseFloat(clusterMetrics.memoryUsage[0]?.[1] || "0");

                  dependencies.logger.debug(
                    `[GET-METRICS] Metrics Server data for ${clusterName}: CPU=${cpuValue} cores, Memory=${memoryValue} bytes`,
                  );

                  // 📝 시계열 생성: 이전 5개는 0, 마지막 1개는 실제 값
                  // recharts AreaChart는 최소 2개 포인트가 필요
                  const now = Date.now();
                  const interval = 60000; // 1분 간격
                  const pointCount = 6; // 6개 포인트

                  const cpuUsage = Array.from({ length: pointCount }, (_, i) => ({
                    time: new Date(now - (pointCount - 1 - i) * interval).toISOString(),
                    usage: i === pointCount - 1 ? cpuValue : 0, // 마지막만 실제값
                  }));

                  const memoryUsage = Array.from({ length: pointCount }, (_, i) => ({
                    time: new Date(now - (pointCount - 1 - i) * interval).toISOString(),
                    usage: i === pointCount - 1 ? memoryValue : 0, // 마지막만 실제값
                  }));

                  return {
                    cpuUsage,
                    memoryUsage,
                    cpuCapacity: totalCpuCapacity,
                    memoryCapacity: totalMemoryCapacity,
                    providerType: "metrics-server",
                  };
                } catch (metricsError) {
                  // 🚨 Metrics Server 호출 실패 시 빈 데이터 반환
                  dependencies.logger.warn(`[GET-METRICS] Metrics Server API failed for ${clusterName}:`, metricsError);

                  const now = Date.now();
                  const interval = 60000;
                  const pointCount = 6;

                  const emptyUsage = Array.from({ length: pointCount }, (_, i) => ({
                    time: new Date(now - (pointCount - 1 - i) * interval).toISOString(),
                    usage: 0,
                  }));

                  return {
                    cpuUsage: emptyUsage,
                    memoryUsage: emptyUsage,
                    cpuCapacity: 0,
                    memoryCapacity: 0,
                    providerType: "metrics-server",
                  };
                }
              }

              if (metricsSource === "prometheus") {
                // 🎯 Prometheus 모드: 실제 Prometheus query_range API 호출
                dependencies.logger.debug(`[GET-METRICS] Using Prometheus for cluster: ${clusterName}`);

                try {
                  // 🔧 Prometheus Handler 및 GetMetrics 주입
                  const prometheusHandler = di.inject(prometheusHandlerInjectable, cluster);
                  const { prometheusPath } = await prometheusHandler.getPrometheusDetails();
                  const getMetrics = di.inject(getMetricsInjectable);

                  // 📅 시간 범위 설정 (최근 1시간, 60초 간격)
                  const nowSeconds = Math.floor(Date.now() / 1000);
                  const startSeconds = nowSeconds - 3600; // 1시간 전
                  const stepSeconds = 60; // 60초 간격

                  // 🎯 PromQL 쿼리 생성 (통합 쿼리 사용 - Provider 제거됨)
                  const cpuQuery = getUnifiedQuery("cluster", "cpuUsage", { nodes: ".*" });
                  const memoryQuery = getUnifiedQuery("cluster", "memoryUsage", { nodes: ".*" });
                  const cpuCapQuery = getUnifiedQuery("cluster", "cpuCapacity", { nodes: ".*" });
                  const memCapQuery = getUnifiedQuery("cluster", "memoryCapacity", { nodes: ".*" });

                  dependencies.logger.debug(`[GET-METRICS] Prometheus queries - CPU: ${cpuQuery}`);

                  // 📊 병렬로 쿼리 실행
                  const [cpuRes, memRes, cpuCapRes, memCapRes] = await Promise.all([
                    getMetrics(cluster, prometheusPath, {
                      query: cpuQuery,
                      start: startSeconds,
                      end: nowSeconds,
                      step: stepSeconds,
                    }),
                    getMetrics(cluster, prometheusPath, {
                      query: memoryQuery,
                      start: startSeconds,
                      end: nowSeconds,
                      step: stepSeconds,
                    }),
                    getMetrics(cluster, prometheusPath, {
                      query: cpuCapQuery,
                      start: startSeconds,
                      end: nowSeconds,
                      step: stepSeconds,
                    }),
                    getMetrics(cluster, prometheusPath, {
                      query: memCapQuery,
                      start: startSeconds,
                      end: nowSeconds,
                      step: stepSeconds,
                    }),
                  ]);

                  // 📝 응답 파싱
                  const cpuUsage = parsePrometheusTimeSeries(cpuRes);
                  const memoryUsage = parsePrometheusTimeSeries(memRes);
                  const cpuCapacity = parsePrometheusValue(cpuCapRes);
                  const memoryCapacity = parsePrometheusValue(memCapRes);

                  dependencies.logger.debug(
                    `[GET-METRICS] Prometheus data for ${clusterName}: ${cpuUsage.length} CPU points, ${memoryUsage.length} Memory points`,
                  );

                  // 📝 데이터가 없으면 빈 시계열 반환
                  if (cpuUsage.length === 0 && memoryUsage.length === 0) {
                    const now = Date.now();
                    const interval = 60000;
                    const pointCount = 6;

                    const emptyUsage = Array.from({ length: pointCount }, (_, i) => ({
                      time: new Date(now - (pointCount - 1 - i) * interval).toISOString(),
                      usage: 0,
                    }));

                    return {
                      cpuUsage: emptyUsage,
                      memoryUsage: emptyUsage,
                      cpuCapacity,
                      memoryCapacity,
                      providerType: "prometheus",
                    };
                  }

                  return {
                    cpuUsage,
                    memoryUsage,
                    cpuCapacity,
                    memoryCapacity,
                    providerType: "prometheus",
                  };
                } catch (prometheusError) {
                  // 🚨 Prometheus 호출 실패 시 빈 데이터 반환
                  dependencies.logger.warn(`[GET-METRICS] Prometheus API failed for ${clusterName}:`, prometheusError);

                  const now = Date.now();
                  const interval = 60000;
                  const pointCount = 6;

                  const emptyUsage = Array.from({ length: pointCount }, (_, i) => ({
                    time: new Date(now - (pointCount - 1 - i) * interval).toISOString(),
                    usage: 0,
                  }));

                  return {
                    cpuUsage: emptyUsage,
                    memoryUsage: emptyUsage,
                    cpuCapacity: 0,
                    memoryCapacity: 0,
                    providerType: "prometheus",
                  };
                }
              }

              // 🎯 메트릭 없음: 빈 시계열 (차트 영역만 표시)
              dependencies.logger.debug(`[GET-METRICS] No metrics provider for cluster: ${clusterName}`);

              // 📝 메트릭 설정이 없어도 차트 영역은 표시 (희미하게)
              const now = Date.now();
              const interval = 60000;
              const pointCount = 6;

              const emptyUsage = Array.from({ length: pointCount }, (_, i) => ({
                time: new Date(now - (pointCount - 1 - i) * interval).toISOString(),
                usage: 0,
              }));

              return {
                cpuUsage: emptyUsage,
                memoryUsage: emptyUsage,
                cpuCapacity: 0,
                memoryCapacity: 0,
                providerType: "none",
              };
            } catch (error) {
              // 🛡️ 권한 부족 에러 허용 (403)
              if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 403) {
                dependencies.logger.warn(`[GET-METRICS] Permission denied for cluster: ${clusterId}`);
                return null;
              }

              // 🚨 타임아웃 에러
              if (error instanceof Error && error.message.includes("Timeout")) {
                dependencies.logger.warn(`[GET-METRICS] Timeout for cluster: ${clusterId}`);
                return null;
              }

              // 🚨 기타 에러 로그
              dependencies.logger.error(`[GET-METRICS] Error for cluster ${clusterId}:`, error);
              return null;
            }
          },
        );
      },
    };
  },
  injectionToken: beforeElectronIsReadyInjectionToken,
  causesSideEffects: true,
});

export default getClusterMetricsInjectable;
