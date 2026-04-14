/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 모든 연결된 클러스터의 경고(Alerts) 정보를 수집하는 IPC Handler
 *
 * 주요 기능:
 * - 연결된 모든 클러스터의 Node 경고 및 Event 경고 수집
 * - 클러스터별 최근 경고 미리보기 제공
 * - 상태바 Alerts Popover에서 사용
 *
 * 📝 주의사항:
 * - 연결되지 않은 클러스터는 제외
 * - 각 클러스터별 타임아웃: 5초 제한
 * - 병렬 처리로 모든 클러스터 동시 조회
 *
 * 🔄 변경이력:
 * - 2025-12-10 - 초기 생성 (상태바 Alerts Popover 기능)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeElectronIsReadyInjectionToken } from "@skuberplus/application-for-electron-main";
import { loggerInjectionToken } from "@skuberplus/logger";
import createCoreApiInjectable from "../../common/cluster/create-core-api.injectable";
import loadKubeconfigInjectable from "../../common/cluster/load-kubeconfig.injectable";
import { ipcMainHandle } from "../../common/ipc";
import { clusterGetAllAlertsChannel } from "../../common/ipc/cluster";
import clustersInjectable from "../../features/cluster/storage/common/clusters.injectable";

import type { Logger } from "@skuberplus/logger";

import type { IComputedValue } from "mobx";

/**
 * 🎯 목적: Kubernetes Node 응답 타입 (필요한 필드만 정의)
 */
interface KubeNode {
  metadata?: {
    name?: string;
  };
  status?: {
    conditions?: Array<{
      type?: string;
      status?: string;
      lastTransitionTime?: string | Date;
    }>;
  };
}

/**
 * 🎯 목적: Kubernetes Event 응답 타입 (필요한 필드만 정의)
 */
interface KubeEvent {
  type?: string;
  reason?: string;
  message?: string;
  lastTimestamp?: string | Date;
  eventTime?: string | Date;
  involvedObject?: {
    kind?: string;
    name?: string;
  };
}

import type { Cluster } from "../../common/cluster/cluster";
import type { CreateCoreApi } from "../../common/cluster/create-core-api.injectable";

/**
 * 🎯 목적: 개별 경고 항목 타입 (내부용, ID 없음)
 */
interface ClusterAlertItemInternal {
  type: "node" | "event";
  message: string;
  timestamp: string;
  resource?: string;
}

/**
 * 🎯 목적: 개별 경고 항목 타입 (외부 공개용, ID 포함)
 */
export interface ClusterAlertItem extends ClusterAlertItemInternal {
  /** 🔑 고유 ID (dismiss 추적용): clusterId:type:resource */
  id: string;
}

/**
 * 🎯 목적: 클러스터별 경고 요약 타입
 */
export interface ClusterAlertSummary {
  clusterId: string;
  clusterName: string;
  connected: boolean;
  totalCount: number;
  nodeWarnings: number;
  eventWarnings: number;
  recentAlerts: ClusterAlertItem[];
}

/**
 * 🎯 목적: 전체 응답 타입 (Renderer와 공유)
 */
export interface AllClusterAlertsResponse {
  clusters: ClusterAlertSummary[];
  totalCount: number;
}

interface Dependencies {
  readonly clusters: IComputedValue<Cluster[]>;
  readonly createCoreApi: CreateCoreApi;
  readonly logger: Logger;
}

/**
 * 🎯 목적: 타임스탬프를 상대 시간 문자열로 변환
 * @param timestamp - ISO 타임스탬프 또는 Date 객체
 * @returns "2m ago", "1h ago" 형식의 문자열
 */
function formatRelativeTime(timestamp: string | Date | undefined): string {
  if (!timestamp) return "unknown";

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * 🎯 목적: Node에서 경고 조건(Warning Conditions) 추출
 * @param nodes - KubeNode 배열
 * @returns 경고 아이템 배열 (ID 없음, 추후 할당)
 */
function extractNodeWarnings(nodes: KubeNode[]): ClusterAlertItemInternal[] {
  const warnings: ClusterAlertItemInternal[] = [];

  for (const node of nodes) {
    const conditions = node.status?.conditions || [];
    const nodeName = node.metadata?.name || "unknown";

    for (const condition of conditions) {
      // Ready가 아닌 상태이거나, 다른 문제 조건이 True인 경우
      const isWarning =
        (condition.type === "Ready" && condition.status !== "True") ||
        (condition.type !== "Ready" && condition.status === "True");

      if (isWarning && condition.type) {
        warnings.push({
          type: "node",
          message: `Node ${nodeName}: ${condition.type}`,
          timestamp: formatRelativeTime(condition.lastTransitionTime),
          resource: `node/${nodeName}`,
        });
      }
    }
  }

  return warnings;
}

/**
 * 🎯 목적: Event에서 Warning 타입만 추출
 * @param events - KubeEvent 배열
 * @returns 경고 아이템 배열 (ID 없음, 추후 할당)
 */
function extractEventWarnings(events: KubeEvent[]): ClusterAlertItemInternal[] {
  // Warning 타입 이벤트만 필터링
  const warningEvents = events.filter((event) => event.type === "Warning");

  // 최근 1시간 이내의 이벤트만 (너무 오래된 것 제외)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentWarnings = warningEvents.filter((event) => {
    const eventTime = event.lastTimestamp || event.eventTime;
    if (!eventTime) return false;
    return new Date(eventTime) > oneHourAgo;
  });

  return recentWarnings.map((event) => {
    const involvedObject = event.involvedObject;
    const resourceInfo = involvedObject ? `${involvedObject.kind}/${involvedObject.name}` : "unknown";

    return {
      type: "event" as const,
      message: `${resourceInfo}: ${event.reason || event.message || "Unknown warning"}`,
      timestamp: formatRelativeTime(event.lastTimestamp || event.eventTime),
      resource: resourceInfo,
    };
  });
}

const getAllClusterAlertsInjectable = getInjectable({
  id: "get-all-cluster-alerts",
  instantiate: (di) => {
    const dependencies: Dependencies = {
      clusters: di.inject(clustersInjectable),
      createCoreApi: di.inject(createCoreApiInjectable),
      logger: di.inject(loggerInjectionToken),
    };

    return {
      run: () => {
        dependencies.logger.info(`[GET-ALL-ALERTS] Registering IPC handler: ${clusterGetAllAlertsChannel}`);

        /**
         * 🎯 목적: 모든 클러스터의 경고를 수집하는 IPC Handler
         *
         * @returns 모든 클러스터의 경고 요약
         *
         * 📝 주의사항:
         * - Main Process에서 실행됨
         * - 병렬로 모든 클러스터 조회
         * - 각 클러스터별 5초 타임아웃
         */
        ipcMainHandle(clusterGetAllAlertsChannel, async (): Promise<AllClusterAlertsResponse> => {
          const allClusters = dependencies.clusters.get();
          dependencies.logger.debug(`[GET-ALL-ALERTS] Found ${allClusters.length} clusters`);

          // 🔄 모든 클러스터를 병렬로 처리
          const clusterSummaries = await Promise.all(
            allClusters.map(async (cluster): Promise<ClusterAlertSummary> => {
              const clusterId = cluster.id;
              const clusterName = cluster.name.get();

              // 🚨 실제 연결 상태 확인 (online + accessible)
              // - online: 클러스터가 온라인인지 감지 가능
              // - accessible: 사용자가 클러스터 리소스에 접근 가능한지
              // - disconnected는 "사용자 연결 의도"라서 사용하지 않음
              if (!cluster.online.get() || !cluster.accessible.get()) {
                dependencies.logger.debug(`[GET-ALL-ALERTS] Cluster not accessible: ${clusterName}`);
                return {
                  clusterId,
                  clusterName,
                  connected: false,
                  totalCount: 0,
                  nodeWarnings: 0,
                  eventWarnings: 0,
                  recentAlerts: [],
                };
              }

              try {
                // 🔧 KubeConfig 로드
                const loadKubeconfig = di.inject(loadKubeconfigInjectable, cluster);
                const kubeConfig = await loadKubeconfig();

                // 🎯 CoreV1Api 인스턴스 생성
                const coreApi = dependencies.createCoreApi(kubeConfig);

                // 📊 Node 및 Event 조회 (병렬, 5초 타임아웃)
                const [nodesResponse, eventsResponse] = await Promise.race([
                  Promise.all([coreApi.listNode(), coreApi.listEventForAllNamespaces()]),
                  new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout after 5s")), 5000)),
                ]);

                const nodes: KubeNode[] = nodesResponse.items || [];
                const events: KubeEvent[] = eventsResponse.items || [];

                // 🧮 경고 추출
                const nodeWarnings = extractNodeWarnings(nodes);
                const eventWarnings = extractEventWarnings(events);

                // 📋 최근 경고 2개만 선택 (미리보기용)
                // 🔑 각 알럿에 고유 ID 부여 (dismiss 추적용)
                const allWarnings = [...nodeWarnings, ...eventWarnings].map((alert) => ({
                  ...alert,
                  id: `${clusterId}:${alert.type}:${alert.resource || "unknown"}`,
                }));
                const recentAlerts = allWarnings.slice(0, 2);

                dependencies.logger.debug(
                  `[GET-ALL-ALERTS] ${clusterName}: ${nodeWarnings.length} node warnings, ${eventWarnings.length} event warnings`,
                );

                return {
                  clusterId,
                  clusterName,
                  connected: true,
                  totalCount: allWarnings.length,
                  nodeWarnings: nodeWarnings.length,
                  eventWarnings: eventWarnings.length,
                  recentAlerts,
                };
              } catch (error) {
                // 🛡️ 권한 부족 에러 허용 (403)
                if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 403) {
                  dependencies.logger.warn(`[GET-ALL-ALERTS] Permission denied for cluster: ${clusterName}`);
                }
                // 🚨 타임아웃 에러
                else if (error instanceof Error && error.message.includes("Timeout")) {
                  dependencies.logger.warn(`[GET-ALL-ALERTS] Timeout for cluster: ${clusterName}`);
                }
                // 🚨 기타 에러
                else {
                  dependencies.logger.error(`[GET-ALL-ALERTS] Error for cluster ${clusterName}:`, error);
                }

                return {
                  clusterId,
                  clusterName,
                  connected: true, // 연결은 됐지만 조회 실패
                  totalCount: 0,
                  nodeWarnings: 0,
                  eventWarnings: 0,
                  recentAlerts: [],
                };
              }
            }),
          );

          // 📊 총 경고 개수 계산
          const totalCount = clusterSummaries.reduce((sum, cluster) => sum + cluster.totalCount, 0);

          dependencies.logger.info(
            `[GET-ALL-ALERTS] Total: ${totalCount} warnings across ${clusterSummaries.length} clusters`,
          );

          return {
            clusters: clusterSummaries,
            totalCount,
          };
        });
      },
    };
  },
  injectionToken: beforeElectronIsReadyInjectionToken,
  causesSideEffects: true,
});

export default getAllClusterAlertsInjectable;
