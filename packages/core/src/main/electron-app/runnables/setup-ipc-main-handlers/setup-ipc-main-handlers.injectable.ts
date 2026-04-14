/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { onLoadOfApplicationInjectionToken } from "@skuberplus/application";
import { loggerInjectionToken } from "@skuberplus/logger";
import directoryForUserDataInjectable from "../../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import clusterFramesInjectable from "../../../../common/cluster-frames.injectable";
import applicationMenuItemCompositeInjectable from "../../../../features/application-menu/main/application-menu-item-composite.injectable";
import clustersInjectable from "../../../../features/cluster/storage/common/clusters.injectable";
import getClusterByIdInjectable from "../../../../features/cluster/storage/common/get-by-id.injectable";
import pushCatalogToRendererInjectable from "../../../catalog-sync-to-renderer/push-catalog-to-renderer.injectable";
import powerMonitorInjectable from "../../features/power-monitor.injectable";
import { setupIpcMainHandlers } from "./setup-ipc-main-handlers";

const setupIpcMainHandlersInjectable = getInjectable({
  id: "setup-ipc-main-handlers",

  instantiate: (di) => ({
    run: () => {
      const logger = di.inject(loggerInjectionToken);

      logger.debug("[APP-MAIN] initializing ipc main handlers");

      setupIpcMainHandlers({
        applicationMenuItemComposite: di.inject(applicationMenuItemCompositeInjectable),
        pushCatalogToRenderer: di.inject(pushCatalogToRendererInjectable),
        clusters: di.inject(clustersInjectable),
        getClusterById: di.inject(getClusterByIdInjectable),
        clusterFrames: di.inject(clusterFramesInjectable),
        powerMonitor: di.inject(powerMonitorInjectable),
        directoryForUserData: di.inject(directoryForUserDataInjectable),
      });
    },
  }),

  injectionToken: onLoadOfApplicationInjectionToken,
  causesSideEffects: true,
});

export default setupIpcMainHandlersInjectable;
