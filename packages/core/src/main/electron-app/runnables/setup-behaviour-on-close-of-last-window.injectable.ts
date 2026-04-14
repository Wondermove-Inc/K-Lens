/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeElectronIsReadyInjectionToken } from "@skuberplus/application-for-electron-main";
import { runManySyncFor } from "@skuberplus/run-many";
import isIntegrationTestingInjectable from "../../../common/vars/is-integration-testing.injectable";
import { afterQuitOfFrontEndInjectionToken } from "../../start-main-application/runnable-tokens/phases";
import electronAppInjectable from "../electron-app.injectable";
import isAutoUpdatingInjectable from "../features/is-auto-updating.injectable";

const setupBehaviourOnCloseOfLastWindowInjectable = getInjectable({
  id: "setup-behaviour-on-close-of-last-window",
  instantiate: (di) => ({
    run: () => {
      const runManySync = runManySyncFor(di);
      const runAfterQuitOfFrontEnd = runManySync(afterQuitOfFrontEndInjectionToken);
      const app = di.inject(electronAppInjectable);
      const isIntegrationTesting = di.inject(isIntegrationTestingInjectable);
      const isAutoUpdating = di.inject(isAutoUpdatingInjectable);

      app.on("window-all-closed", () => {
        runAfterQuitOfFrontEnd();

        if (isIntegrationTesting || isAutoUpdating.get()) {
          app.quit();
        }
      });

      return undefined;
    },
  }),
  injectionToken: beforeElectronIsReadyInjectionToken,
});

export default setupBehaviourOnCloseOfLastWindowInjectable;
