/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { storesAndApisCanBeCreatedInjectionToken } from "@skuberplus/kube-api-specifics";
import activeKubernetesClusterInjectable from "./cluster-frame-context/active-kubernetes-cluster.injectable";
import hostedClusterIdInjectable from "./cluster-frame-context/hosted-cluster-id.injectable";
import matchedClusterIdInjectable from "./navigation/matched-cluster-id.injectable";

const storesAndApisCanBeCreatedInjectable = getInjectable({
  id: "create-stores-and-apis",

  instantiate: (di) => {
    const hostedClusterId = di.inject(hostedClusterIdInjectable);
    const activeCluster = di.inject(activeKubernetesClusterInjectable).get();
    const fallbackClusterId = activeCluster?.getId();
    const matchedClusterId = di.inject(matchedClusterIdInjectable)?.get?.();
    const canBeCreated = !!(hostedClusterId ?? fallbackClusterId ?? matchedClusterId);

    return canBeCreated;
  },

  injectionToken: storesAndApisCanBeCreatedInjectionToken,

  // ROOT frame과 Cluster frame에서 각각 다른 값을 반환해야 하므로 매번 재평가 필요
  causesSideEffects: true,
});

export default storesAndApisCanBeCreatedInjectable;
