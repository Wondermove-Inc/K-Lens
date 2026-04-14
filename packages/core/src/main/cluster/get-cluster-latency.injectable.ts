/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Welcome 클러스터 테이블의 Latency 칼럼에 사용되는 IPC Handler.
 *
 * Pull 방식: Welcome 페이지 첫 진입 시 1회 호출하여 즉시 값을 표시한다.
 * Push 방식: cluster-connection의 30초 /version 헬스체크에서 broadcastMessage로 자동 갱신된다.
 *
 * get-cluster-pod-status.injectable.ts 패턴을 따른다.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeElectronIsReadyInjectionToken } from "@skuberplus/application-for-electron-main";
import { loggerInjectionToken } from "@skuberplus/logger";
import { ipcMainHandle } from "../../common/ipc";
import getClusterByIdInjectable from "../../features/cluster/storage/common/get-by-id.injectable";
import k8sRequestInjectable from "../k8s-request.injectable";

import type { Logger } from "@skuberplus/logger";

import type { GetClusterById } from "../../features/cluster/storage/common/get-by-id.injectable";
import type { K8sRequest } from "../k8s-request.injectable";

export interface ClusterLatencyData {
  clusterId: string;
  latencyMs: number | null;
}

/** Pull 전용 IPC 채널 (ipcRenderer.invoke) */
export const clusterGetLatencyChannel = "cluster:get-latency";

/** Push 전용 broadcast 채널 (broadcastMessage → ipcRenderer.on) */
export const clusterLatencyUpdateChannel = "cluster:latency-update";

interface Dependencies {
  readonly getClusterById: GetClusterById;
  readonly logger: Logger;
  readonly k8sRequest: K8sRequest;
}

const getClusterLatencyInjectable = getInjectable({
  id: "get-cluster-latency",
  instantiate: (di) => {
    const dependencies: Dependencies = {
      getClusterById: di.inject(getClusterByIdInjectable),
      logger: di.inject(loggerInjectionToken),
      k8sRequest: di.inject(k8sRequestInjectable),
    };

    return {
      run: () => {
        dependencies.logger.info(`[GET-LATENCY] Registering IPC handler: ${clusterGetLatencyChannel}`);

        ipcMainHandle(clusterGetLatencyChannel, async (event, clusterId: string): Promise<number | null> => {
          try {
            const cluster = dependencies.getClusterById(clusterId);

            if (!cluster) {
              dependencies.logger.warn(`[GET-LATENCY] Cluster not found: ${clusterId}`);
              return null;
            }

            if (cluster.disconnected.get()) {
              dependencies.logger.warn(`[GET-LATENCY] Cluster disconnected: ${cluster.name.get()}`);
              return null;
            }

            const startTime = performance.now();
            await dependencies.k8sRequest(cluster, "/version", { timeout: 10_000 });
            const latencyMs = Math.round(performance.now() - startTime);

            return latencyMs;
          } catch (error) {
            dependencies.logger.warn(`[GET-LATENCY] Error for cluster ${clusterId}:`, error);
            return null;
          }
        });
      },
    };
  },
  injectionToken: beforeElectronIsReadyInjectionToken,
  causesSideEffects: true,
});

export default getClusterLatencyInjectable;
