/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { when } from "mobx";
import { notificationPanelStore } from "../../../components/status-bar/items/notification-panel.store";
import { requestSetClusterFrameId } from "../../../ipc";

import type { Logger } from "@skuberplus/logger";

import type { EmitAppEvent } from "../../../../common/app-event-bus/emit-event.injectable";
import type { Cluster } from "../../../../common/cluster/cluster";
import type { CatalogEntityRegistry } from "../../../api/catalog/entity/registry";
import type { CreateMainTab } from "../../../components/main-tabs/create-main-tab.injectable";
import type { MainTabStore } from "../../../components/main-tabs/main-tab-store";

interface Dependencies {
  hostedCluster: Cluster;
  loadExtensions: () => void;
  catalogEntityRegistry: CatalogEntityRegistry;
  frameRoutingId: number;
  emitAppEvent: EmitAppEvent;
  logger: Logger;
  createMainTab: CreateMainTab;
  mainTabStore: MainTabStore;
  clusterOverviewRoutePath: string;
}

const logPrefix = "[CLUSTER-FRAME]:";

export const initClusterFrame =
  ({
    hostedCluster,
    loadExtensions,
    catalogEntityRegistry,
    frameRoutingId,
    emitAppEvent,
    logger,
    createMainTab,
    mainTabStore,
    clusterOverviewRoutePath,
  }: Dependencies) =>
  async () => {
    // TODO: Make catalogEntityRegistry already initialized when passed as dependency
    catalogEntityRegistry.init();

    logger.info(`${logPrefix} Init dashboard, clusterId=${hostedCluster.id}, frameId=${frameRoutingId}`);

    await requestSetClusterFrameId(hostedCluster.id);
    await when(() => hostedCluster.ready.get()); // cluster.activate() is done at this point

    catalogEntityRegistry.activeEntity = hostedCluster.id;

    // 🎯 목적: iframe 컨텍스트에서 기본 "Overview" 탭 생성 (첫 진입에만 실행)
    if (!mainTabStore.hasTabs) {
      logger.info(
        `${logPrefix} Creating default Overview tab for clusterId=${hostedCluster.id} (no existing tabs detected)`,
      );
      createMainTab({
        title: "Overview",
        route: clusterOverviewRoutePath,
        clusterId: hostedCluster.id,
      });
    } else {
      logger.info(
        `${logPrefix} Skipping default Overview tab for clusterId=${hostedCluster.id} (restored tabs already present)`,
      );
    }

    // Only load the extensions once the catalog has been populated.
    // Note that the Catalog might still have unprocessed entities until the extensions are fully loaded.
    when(
      () => catalogEntityRegistry.items.get().length > 0,
      () => loadExtensions(),
      {
        timeout: 15_000,
        onError: (error) => {
          logger.warn("[CLUSTER-FRAME]: error from activeEntity when()", error);

          notificationPanelStore.addError(
            "system",
            "Extension Load Failed",
            "Failed to get KubernetesCluster for this view. Extensions will not be loaded.",
          );
        },
      },
    );

    setTimeout(() => {
      emitAppEvent({
        name: "cluster",
        action: "open",
        params: {
          clusterId: hostedCluster.id,
        },
      });
    });
  };
