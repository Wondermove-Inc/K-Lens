/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { storesAndApisCanBeCreatedInjectionToken } from "@skuberplus/kube-api-specifics";
import { computed } from "mobx";
import clusterFrameContextForNamespacedResourcesInjectable from "../../renderer/cluster-frame-context/for-namespaced-resources.injectable";

const selectedFilterNamespacesInjectable = getInjectable({
  id: "selected-filter-namespaces",
  instantiate: (di) => {
    if (!di.inject(storesAndApisCanBeCreatedInjectionToken)) {
      // Dummy value so that this works in all environments
      return computed(() => []);
    }

    const context = di.inject(clusterFrameContextForNamespacedResourcesInjectable);

    return computed(() => [...context.contextNamespaces]);
  },
});

export default selectedFilterNamespacesInjectable;
