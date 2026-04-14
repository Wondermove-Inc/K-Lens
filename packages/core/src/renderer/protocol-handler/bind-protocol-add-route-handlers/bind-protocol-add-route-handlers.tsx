/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import assert from "assert";
import { EXTENSION_NAME_MATCH, EXTENSION_PUBLISHER_MATCH, LensProtocolRouter } from "../../../common/protocol-handler";
import { notificationPanelStore } from "../../components/status-bar/items/notification-panel.store";

import type { NavigateToCatalog } from "../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import type { NavigateToClusterView } from "../../../common/front-end-routing/routes/cluster-view/navigate-to-cluster-view.injectable";
import type { NavigateToEntitySettings } from "../../../common/front-end-routing/routes/entity-settings/navigate-to-entity-settings.injectable";
import type { GetClusterById } from "../../../features/cluster/storage/common/get-by-id.injectable";
import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";
import type { AttemptInstallByInfo } from "../../components/extensions/attempt-install-by-info.injectable";
import type { LensProtocolRouterRenderer } from "../lens-protocol-router-renderer/lens-protocol-router-renderer";

interface Dependencies {
  attemptInstallByInfo: AttemptInstallByInfo;
  lensProtocolRouterRenderer: LensProtocolRouterRenderer;
  navigateToCatalog: NavigateToCatalog;
  navigateToAddCluster: () => void;
  navigateToExtensions: () => void;
  navigateToEntitySettings: NavigateToEntitySettings;
  navigateToClusterView: NavigateToClusterView;
  navigateToPreferences: (tabId: string) => void;
  entityRegistry: CatalogEntityRegistry;
  getClusterById: GetClusterById;
}

export const bindProtocolAddRouteHandlers =
  ({
    attemptInstallByInfo,
    lensProtocolRouterRenderer,
    navigateToCatalog,
    navigateToAddCluster,
    navigateToExtensions,
    navigateToEntitySettings,
    navigateToClusterView,
    navigateToPreferences,
    entityRegistry,
    getClusterById,
  }: Dependencies) =>
  () => {
    lensProtocolRouterRenderer
      .addInternalHandler("/preferences", ({ search: { highlight: tabId } }) => {
        if (tabId) {
          navigateToPreferences(tabId);
        }
      })
      .addInternalHandler("/", ({ tail }) => {
        if (tail) {
          notificationPanelStore.addInfo(
            "system",
            "Unknown Action",
            `Unknown Action for skuber://app/${tail}. Are you on the latest version?`,
          );
        }

        navigateToCatalog();
      })
      .addInternalHandler("/landing", () => {
        navigateToCatalog();
      })
      .addInternalHandler("/landing/view/:group/:kind", ({ pathname: { group, kind } }) => {
        navigateToCatalog({ group, kind });
      })
      .addInternalHandler("/cluster", () => {
        navigateToAddCluster();
      })
      .addInternalHandler("/entity/:entityId/settings", ({ pathname: { entityId } }) => {
        assert(entityId);
        const entity = entityRegistry.getById(entityId);

        if (entity) {
          navigateToEntitySettings(entityId);
        } else {
          notificationPanelStore.addInfo("system", "Unknown Entity", `Unknown catalog entity "${entityId}".`);
        }
      })
      // Handlers below are deprecated and only kept for backward compact purposes
      .addInternalHandler("/cluster/:clusterId", ({ pathname: { clusterId } }) => {
        assert(clusterId);
        const cluster = getClusterById(clusterId);

        if (cluster) {
          navigateToClusterView(clusterId);
        } else {
          notificationPanelStore.addInfo("system", "Unknown Entity", `Unknown catalog entity "${clusterId}".`);
        }
      })
      .addInternalHandler("/cluster/:clusterId/settings", ({ pathname: { clusterId } }) => {
        assert(clusterId);
        const cluster = getClusterById(clusterId);

        if (cluster) {
          navigateToEntitySettings(clusterId);
        } else {
          notificationPanelStore.addInfo("system", "Unknown Entity", `Unknown catalog entity "${clusterId}".`);
        }
      })
      .addInternalHandler("/extensions", () => {
        navigateToExtensions();
      })
      .addInternalHandler(
        `/extensions/install${LensProtocolRouter.ExtensionUrlSchema}`,
        ({ pathname, search: { version } }) => {
          const name = [pathname[EXTENSION_PUBLISHER_MATCH], pathname[EXTENSION_NAME_MATCH]].filter(Boolean).join("/");

          navigateToExtensions();
          attemptInstallByInfo({ name, version, requireConfirmation: true });
        },
      );
  };
