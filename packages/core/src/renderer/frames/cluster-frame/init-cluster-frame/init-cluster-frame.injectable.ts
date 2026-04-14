/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import assert from "assert";
import emitAppEventInjectable from "../../../../common/app-event-bus/emit-event.injectable";
import clusterOverviewRouteInjectable from "../../../../common/front-end-routing/routes/cluster/overview/cluster-overview-route.injectable";
import catalogEntityRegistryInjectable from "../../../api/catalog/entity/registry.injectable";
import hostedClusterInjectable from "../../../cluster-frame-context/hosted-cluster.injectable";
import createMainTabInjectable from "../../../components/main-tabs/create-main-tab.injectable";
import mainTabStoreInjectable from "../../../components/main-tabs/main-tab-store.injectable";
import loadExtensionsInjectable from "../../load-extensions.injectable";
// FIX-036: FileReceiverService for postMessage communication with Root Frame
import fileReceiverServiceInjectable from "../file-receiver.service.injectable";
import frameRoutingIdInjectable from "./frame-routing-id/frame-routing-id.injectable";
import { initClusterFrame } from "./init-cluster-frame";

const initClusterFrameInjectable = getInjectable({
  id: "init-cluster-frame",

  instantiate: (di) => {
    const hostedCluster = di.inject(hostedClusterInjectable);

    assert(hostedCluster, "This can only be injected within a cluster frame");

    // FIX-036: Initialize FileReceiverService for postMessage communication
    // This enables Root Frame (StatusBar) to open file tabs in Cluster Frame
    di.inject(fileReceiverServiceInjectable);

    return initClusterFrame({
      hostedCluster,
      loadExtensions: di.inject(loadExtensionsInjectable),
      catalogEntityRegistry: di.inject(catalogEntityRegistryInjectable),
      frameRoutingId: di.inject(frameRoutingIdInjectable),
      emitAppEvent: di.inject(emitAppEventInjectable),
      logger: di.inject(loggerInjectionToken),
      createMainTab: di.inject(createMainTabInjectable),
      mainTabStore: di.inject(mainTabStoreInjectable),
      clusterOverviewRoutePath: di.inject(clusterOverviewRouteInjectable).path,
    });
  },
});

export default initClusterFrameInjectable;
