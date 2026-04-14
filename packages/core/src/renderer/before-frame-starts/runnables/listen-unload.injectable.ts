/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { reactRootLifecycleInjectionToken } from "@skuberplus/react-application";
import closeRendererLogFileInjectable from "../../../features/population-of-logs-to-a-file/renderer/close-renderer-log-file.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import podMetricsCacheInjectable from "../../components/workloads-pods/metrics-cache.injectable";
import frameRoutingIdInjectable from "../../frames/cluster-frame/init-cluster-frame/frame-routing-id/frame-routing-id.injectable";
import currentlyInClusterFrameInjectable from "../../routes/currently-in-cluster-frame.injectable";
import { beforeFrameStartsSecondInjectionToken } from "../tokens";

const listenUnloadInjectable = getInjectable({
  id: "listen-unload",
  instantiate: (di) => ({
    run: () => {
      const closeRendererLogFile = di.inject(closeRendererLogFileInjectable);
      const isClusterFrame = di.inject(currentlyInClusterFrameInjectable);
      const logger = di.inject(loggerInjectionToken);
      const podMetricsCache = di.inject(podMetricsCacheInjectable);

      window.addEventListener("beforeunload", () => {
        // 🧹 프로그램 종료 시 Pod 메트릭 캐시 정리
        try {
          const stats = podMetricsCache.getCacheStats();
          podMetricsCache.clearAllCaches();
          logger.info(
            `[CACHE-CLEANUP] Pod 메트릭 캐시 정리 완료 - ${stats.totalPods}개 Pod, ${stats.totalDataPoints}개 데이터 포인트 삭제`,
          );
        } catch (error) {
          logger.warn(`[CACHE-CLEANUP] Pod 메트릭 캐시 정리 중 에러: ${error}`);
        }

        if (isClusterFrame) {
          const hostedCluster = di.inject(hostedClusterInjectable);
          const frameRoutingId = di.inject(frameRoutingIdInjectable);

          logger.info(`[CLUSTER-FRAME] Unload dashboard, clusterId=${hostedCluster?.id}, frameId=${frameRoutingId}`);
        } else {
          logger.info("[ROOT-FRAME]: Unload app");
        }

        closeRendererLogFile();

        // 🎯 React 18: reactRootLifecycleInjectionToken을 사용하여 unmount
        di.inject(reactRootLifecycleInjectionToken).unmount();
      });
    },
  }),
  injectionToken: beforeFrameStartsSecondInjectionToken,
});

export default listenUnloadInjectable;
