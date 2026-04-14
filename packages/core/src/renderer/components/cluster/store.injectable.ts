/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { clusterApiInjectable, storesAndApisCanBeCreatedInjectionToken } from "@skuberplus/kube-api-specifics";
import { loggerInjectionToken } from "@skuberplus/logger";
import assert from "assert";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForNamespacedResourcesInjectable from "../../cluster-frame-context/for-namespaced-resources.injectable";
import { ClusterStore } from "./store";

const clusterStoreInjectable = getInjectable({
  id: "cluster-store",

  instantiate: (di) => {
    assert(
      di.inject(storesAndApisCanBeCreatedInjectionToken),
      "clusterStore is only available in certain environments",
    );
    const clusterApi = di.inject(clusterApiInjectable);

    return new ClusterStore(
      {
        context: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      clusterApi,
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default clusterStoreInjectable;
