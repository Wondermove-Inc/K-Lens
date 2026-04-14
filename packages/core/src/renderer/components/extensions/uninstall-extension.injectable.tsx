/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { when } from "mobx";
import extensionDiscoveryInjectable from "../../../extensions/extension-discovery/extension-discovery.injectable";
import extensionInstallationStateStoreInjectable from "../../../extensions/extension-installation-state-store/extension-installation-state-store.injectable";
import extensionLoaderInjectable from "../../../extensions/extension-loader/extension-loader.injectable";
import { extensionDisplayName } from "../../../extensions/lens-extension";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { getMessageFromError } from "./get-message-from-error/get-message-from-error";

import type { LensExtensionId } from "@skuberplus/legacy-extensions";

const uninstallExtensionInjectable = getInjectable({
  id: "uninstall-extension",

  instantiate: (di) => {
    const extensionLoader = di.inject(extensionLoaderInjectable);
    const extensionDiscovery = di.inject(extensionDiscoveryInjectable);
    const extensionInstallationStateStore = di.inject(extensionInstallationStateStoreInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (extensionId: LensExtensionId): Promise<boolean> => {
      const ext = extensionLoader.getExtensionById(extensionId);

      if (!ext) {
        logger.debug(`[EXTENSIONS]: cannot uninstall ${extensionId}, was not installed`);

        return true;
      }

      const { manifest } = ext;
      const displayName = extensionDisplayName(manifest.name, manifest.version);

      try {
        logger.debug(`[EXTENSIONS]: trying to uninstall ${extensionId}`);
        extensionInstallationStateStore.setUninstalling(extensionId);

        await extensionDiscovery.uninstallExtension(extensionId);

        // wait for the ExtensionLoader to actually uninstall the extension
        await when(() => !extensionLoader.userExtensions.get().has(extensionId));

        notificationPanelStore.addSuccess(
          "extensions",
          "Extension Uninstalled",
          `Extension "${displayName}" successfully uninstalled!`,
        );

        return true;
      } catch (error) {
        const message = getMessageFromError(error);

        logger.info(`[EXTENSION-UNINSTALL]: uninstalling ${displayName} has failed: ${error}`, { error });
        notificationPanelStore.addError(
          "extensions",
          "Extension Uninstall Failed",
          `Uninstalling extension "${displayName}" has failed: ${message}`,
        );

        return false;
      } finally {
        // Remove uninstall state on uninstall failure
        extensionInstallationStateStore.clearUninstalling(extensionId);
      }
    };
  },
});

export default uninstallExtensionInjectable;
