/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Welcome 화면에서 클러스터별 Pod Status 조회를 위한 IPC Handler
 *
 * 주요 기능:
 * - 클러스터 ID로 Pod 목록 조회
 * - Phase별 카운트 계산 (Running, Pending, Succeeded, Failed, Unknown)
 * - 연결 상태 확인 및 에러 처리
 *
 * 📝 주의사항:
 * - 연결되지 않은 클러스터는 null 반환
 * - 타임아웃: 5초 제한
 * - 권한 부족 시 null 반환 (403 에러 허용)
 *
 * 🔄 변경이력:
 * - 2025-11-19 - 초기 생성 (Welcome 화면 다중 클러스터 Pod Status 지원)
 * - 2025-11-19 - injection token 추가 (IPC handler 자동 등록)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeElectronIsReadyInjectionToken } from "@skuberplus/application-for-electron-main";
import { loggerInjectionToken } from "@skuberplus/logger";
import { ipcMainHandle } from "../../common/ipc";
import getClusterByIdInjectable from "../../features/cluster/storage/common/get-by-id.injectable";
import loadProxyKubeconfigInjectable from "./load-proxy-kubeconfig.injectable";

import type { V1Pod } from "@skuberplus/kubernetes-client-node";
import type { Logger } from "@skuberplus/logger";

import type { GetClusterById } from "../../features/cluster/storage/common/get-by-id.injectable";

/**
 * 🎯 목적: Pod Status 데이터 타입 정의 (Renderer와 공유)
 */
export interface PodStatusData {
  running: number;
  succeeded: number;
  pending: number;
  failed: number;
  unknown: number;
}

/**
 * 🎯 목적: IPC 채널명 상수
 */
export const clusterGetPodStatusChannel = "cluster:get-pod-status";

interface Dependencies {
  readonly getClusterById: GetClusterById;
  readonly logger: Logger;
}

const getClusterPodStatusInjectable = getInjectable({
  id: "get-cluster-pod-status",
  instantiate: (di) => {
    const dependencies: Dependencies = {
      getClusterById: di.inject(getClusterByIdInjectable),
      logger: di.inject(loggerInjectionToken),
    };

    return {
      run: () => {
        dependencies.logger.info(`[GET-POD-STATUS] Registering IPC handler: ${clusterGetPodStatusChannel}`);

        /**
         * 🎯 목적: IPC Handler 등록
         *
         * @param clusterId - 조회할 클러스터 ID
         * @returns Pod 상태별 카운트 또는 null (연결 안 됨/에러)
         *
         * 📝 주의사항:
         * - Main Process에서 실행됨
         * - 연결되지 않은 클러스터는 null 반환
         * - 타임아웃 5초 제한
         */
        ipcMainHandle(clusterGetPodStatusChannel, async (event, clusterId: string): Promise<PodStatusData | null> => {
          dependencies.logger.info(`[GET-POD-STATUS] 요청 받음: ${clusterId}`);

          try {
            // 🔍 클러스터 조회
            const cluster = dependencies.getClusterById(clusterId);

            if (!cluster) {
              dependencies.logger.warn(`[GET-POD-STATUS] Cluster not found: ${clusterId}`);
              return null;
            }

            const clusterName = cluster.name.get();
            dependencies.logger.info(
              `[GET-POD-STATUS] 클러스터 찾음: ${clusterName}, disconnected: ${cluster.disconnected.get()}`,
            );

            // 🚨 연결 상태 확인
            if (cluster.disconnected.get()) {
              dependencies.logger.warn(`[GET-POD-STATUS] Cluster disconnected: ${clusterName}`);
              return null;
            }

            // 🔧 KubeConfig 로드 (Proxy 경유 - kind 클러스터 지원)
            const proxyConfig = await di.inject(loadProxyKubeconfigInjectable, cluster)();
            const { CoreV1Api } = await import("@skuberplus/kubernetes-client-node");
            const coreApi = proxyConfig.makeApiClient(CoreV1Api);

            // 📊 Pod 목록 조회 (모든 네임스페이스)
            dependencies.logger.debug(`[GET-POD-STATUS] Fetching pods for cluster: ${cluster.name.get()}`);

            const response = await Promise.race([
              coreApi.listPodForAllNamespaces(),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout after 5s")), 5000)),
            ]);

            const pods: V1Pod[] = response.items;

            // 🧮 Phase별 카운트 계산
            const statusData: PodStatusData = {
              running: 0,
              succeeded: 0,
              pending: 0,
              failed: 0,
              unknown: 0,
            };

            for (const pod of pods) {
              const phase = pod.status?.phase?.toLowerCase();

              switch (phase) {
                case "running":
                  statusData.running++;
                  break;
                case "succeeded":
                  statusData.succeeded++;
                  break;
                case "pending":
                  statusData.pending++;
                  break;
                case "failed":
                  statusData.failed++;
                  break;
                default:
                  statusData.unknown++;
              }
            }

            dependencies.logger.debug(`[GET-POD-STATUS] Success for ${cluster.name.get()}:`, statusData);

            return statusData;
          } catch (error) {
            // 🛡️ 권한 부족 에러 허용 (403)
            if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 403) {
              dependencies.logger.warn(`[GET-POD-STATUS] Permission denied for cluster: ${clusterId}`);
              return null;
            }

            // 🚨 타임아웃 에러
            if (error instanceof Error && error.message.includes("Timeout")) {
              dependencies.logger.warn(`[GET-POD-STATUS] Timeout for cluster: ${clusterId}`);
              return null;
            }

            // 🚨 기타 에러 로그
            dependencies.logger.error(`[GET-POD-STATUS] Error for cluster ${clusterId}:`, error);
            return null;
          }
        });
      },
    };
  },
  injectionToken: beforeElectronIsReadyInjectionToken,
  causesSideEffects: true,
});

export default getClusterPodStatusInjectable;
