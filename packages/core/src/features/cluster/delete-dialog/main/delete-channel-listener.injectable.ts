/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { prefixedLoggerInjectable } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import { noop } from "@skuberplus/utilities";
import emitAppEventInjectable from "../../../../common/app-event-bus/emit-event.injectable";
import clusterFramesInjectable from "../../../../common/cluster-frames.injectable";
import directoryForLensLocalStorageInjectable from "../../../../common/directory-for-lens-local-storage/directory-for-lens-local-storage.injectable";
import readFileInjectable from "../../../../common/fs/read-file.injectable";
import removePathInjectable from "../../../../common/fs/remove.injectable";
import writeFileInjectable from "../../../../common/fs/write-file.injectable";
import { dumpConfigYaml, loadConfigFromString } from "../../../../common/kube-helpers";
import joinPathsInjectable from "../../../../common/path/join-paths.injectable";
import pushCatalogToRendererInjectable from "../../../../main/catalog-sync-to-renderer/push-catalog-to-renderer.injectable";
import clusterConnectionInjectable from "../../../../main/cluster/cluster-connection.injectable";
import clustersStateInjectable from "../../storage/common/state.injectable";
import { deleteClusterChannel } from "../common/delete-channel";

const deleteClusterChannelListenerInjectable = getRequestChannelListenerInjectable({
  id: "delete-cluster-channel-listener",
  channel: deleteClusterChannel,
  getHandler: (di) => {
    const emitAppEvent = di.inject(emitAppEventInjectable);
    const clusterFrames = di.inject(clusterFramesInjectable);
    const joinPaths = di.inject(joinPathsInjectable);
    const directoryForLensLocalStorage = di.inject(directoryForLensLocalStorageInjectable);
    const deleteFile = di.inject(removePathInjectable);
    const clustersState = di.inject(clustersStateInjectable);
    const pushCatalogToRenderer = di.inject(pushCatalogToRendererInjectable);
    const readFile = di.inject(readFileInjectable);
    const writeFile = di.inject(writeFileInjectable);
    const logger = di.inject(prefixedLoggerInjectable, "DELETE-CLUSTER");

    return async (clusterId) => {
      emitAppEvent({ name: "cluster", action: "remove" });

      const cluster = clustersState.get(clusterId);

      if (!cluster) {
        return;
      }

      const clusterConnection = di.inject(clusterConnectionInjectable, cluster);

      // 1. 연결 해제 및 프레임 제거
      clusterConnection.disconnect();
      clusterFrames.delete(cluster.id);
      clustersState.delete(cluster.id);

      // 2. Kubeconfig 파일에서 context 제거
      const kubeconfigPath = cluster.kubeConfigPath.get();
      const contextName = cluster.contextName.get();

      if (kubeconfigPath && contextName) {
        try {
          logger.info(`[Delete Cluster] Removing context from kubeconfig`, {
            kubeconfigPath,
            contextName,
          });

          // 파일 읽기
          const kubeconfigContent = await readFile(kubeconfigPath);
          const { config } = loadConfigFromString(kubeconfigContent);

          // Context 제거
          config.contexts = config.contexts.filter((c) => c.name !== contextName);

          // 고아 User 제거 (다른 context가 사용하지 않는 경우)
          const usedUsers = new Set(config.contexts.map((c) => (typeof c === "string" ? c : c.user)).filter(Boolean));
          const contextUser = config.users.find((u) => u.name === contextName)?.name;

          if (contextUser && !usedUsers.has(contextUser)) {
            config.users = config.users.filter((u) => u.name !== contextUser);
            logger.debug(`[Delete Cluster] Removed orphan user`, { userName: contextUser });
          }

          // 고아 Cluster 제거 (다른 context가 사용하지 않는 경우)
          const usedClusters = new Set(
            config.contexts.map((c) => (typeof c === "string" ? c : c.cluster)).filter(Boolean),
          );
          const contextCluster = config.clusters.find((c) => c.name === contextName)?.name;

          if (contextCluster && !usedClusters.has(contextCluster)) {
            config.clusters = config.clusters.filter((c) => c.name !== contextCluster);
            logger.debug(`[Delete Cluster] Removed orphan cluster`, { clusterName: contextCluster });
          }

          // 파일에 다시 쓰기
          const updatedContent = dumpConfigYaml(config);

          await writeFile(kubeconfigPath, updatedContent);

          logger.info(`[Delete Cluster] Successfully removed context from kubeconfig`, {
            kubeconfigPath,
            contextName,
          });

          // 🎯 File watcher가 자동으로 변경 감지하여 Catalog 업데이트
          // computeKubeconfigDiff가 실행되어 source.delete(contextName) 호출
          // MobX reaction이 자동으로 Renderer에 동기화
        } catch (error) {
          logger.error(`[Delete Cluster] Failed to update kubeconfig file: ${error}`, {
            kubeconfigPath,
            contextName,
          });

          // 에러가 발생해도 강제로 Catalog 동기화
          pushCatalogToRenderer();
        }
      } else {
        logger.warn(`[Delete Cluster] Missing kubeconfigPath or contextName`, { clusterId });

        // Kubeconfig 정보가 없으면 강제로 Catalog 동기화
        pushCatalogToRenderer();
      }

      // 3. Local storage 파일 삭제
      const localStorageFilePath = joinPaths(directoryForLensLocalStorage, `${cluster.id}.json`);

      await deleteFile(localStorageFilePath).catch(noop);
    };
  },
});

export default deleteClusterChannelListenerInjectable;
