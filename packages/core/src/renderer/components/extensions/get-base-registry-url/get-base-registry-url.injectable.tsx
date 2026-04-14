/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import execFileInjectable from "../../../../common/fs/exec-file.injectable";
import { defaultExtensionRegistryUrl } from "../../../../features/user-preferences/common/preferences-helpers";
import userPreferencesStateInjectable from "../../../../features/user-preferences/common/state.injectable";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";

const getBaseRegistryUrlInjectable = getInjectable({
  id: "get-base-registry-url",

  instantiate: (di) => {
    const { extensionRegistryUrl } = di.inject(userPreferencesStateInjectable);
    const logger = di.inject(loggerInjectionToken);
    const execFile = di.inject(execFileInjectable);

    return async () => {
      switch (extensionRegistryUrl.location) {
        case "custom":
          return extensionRegistryUrl.customUrl;

        case "npmrc": {
          const filteredEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("npm")));
          const result = await execFile("pnpm", ["config", "get", "registry"], { env: filteredEnv });

          if (result.callWasSuccessful) {
            return result.response.trim();
          }

          notificationPanelStore.addError(
            "extensions",
            "Registry Configuration Error",
            "Failed to get configured registry from .npmrc. Falling back to default registry.",
          );
          logger.warn("[EXTENSIONS]: failed to get configured registry from .npmrc", result.error);
        }

        // fallthrough
        default:
        case "default":
          return defaultExtensionRegistryUrl;
      }
    };
  },
});

export default getBaseRegistryUrlInjectable;
