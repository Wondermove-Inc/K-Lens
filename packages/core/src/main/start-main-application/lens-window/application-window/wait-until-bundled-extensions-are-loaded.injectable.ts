/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { delay } from "@skuberplus/utilities";
import { bundledExtensionsLoaded } from "../../../../common/ipc/extension-handling";
import ipcMainInjectionToken from "../../../../common/ipc/ipc-main-injection-token";

const DEV_TIMEOUT_MS = 60_000;
const PROD_TIMEOUT_MS = 30_000;

const waitUntilBundledExtensionsAreLoadedInjectable = getInjectable({
  id: "wait-until-bundled-extensions-are-loaded",

  instantiate: (di) => {
    const ipcMain = di.inject(ipcMainInjectionToken);
    const logger = di.inject(loggerInjectionToken);
    const isDev = process.env.NODE_ENV === "development";
    const timeoutMs = isDev ? DEV_TIMEOUT_MS : PROD_TIMEOUT_MS;

    return async () => {
      let resolved = false;

      const viewHasLoaded = new Promise<void>((resolve) => {
        ipcMain.once(bundledExtensionsLoaded, () => {
          resolved = true;
          resolve();
        });
      });

      const timeout = delay(timeoutMs).then(() => {
        if (!resolved) {
          logger.warn(
            `[wait-until-bundled-extensions-are-loaded] ⚠️ Timeout (${timeoutMs}ms) waiting for bundled extensions. ` +
              `Proceeding anyway. This may indicate the renderer is still building or failed to load.`,
          );
        }
      });

      await Promise.race([viewHasLoaded, timeout]);
      await delay(50); // wait just a bit longer to let the first round of rendering happen
    };
  },

  causesSideEffects: true,
});

export default waitUntilBundledExtensionsAreLoadedInjectable;
