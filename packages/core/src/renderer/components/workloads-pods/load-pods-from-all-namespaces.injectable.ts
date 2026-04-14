/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import clusterFrameContextForNamespacedResourcesInjectable from "../../cluster-frame-context/for-namespaced-resources.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import podStoreInjectable from "./store.injectable";

const loadPodsFromAllNamespacesInjectable = getInjectable({
  id: "load-pods-from-all-namespaces",
  instantiate: (di) => {
    const podStore = di.inject(podStoreInjectable);
    const context = di.inject(clusterFrameContextForNamespacedResourcesInjectable);

    return () => {
      podStore.loadAll({
        namespaces: context.allNamespaces,
        onLoadFailure: (error) =>
          notificationPanelStore.addError("operations", "Error", `Can not load Pods. ${String(error)}`),
      });
    };
  },
});

export default loadPodsFromAllNamespacesInjectable;
