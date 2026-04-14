/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import getClusterByIdInjectable from "../../features/cluster/storage/common/get-by-id.injectable";
import activeKubernetesClusterInjectable from "./active-kubernetes-cluster.injectable";
import hostedClusterIdInjectable from "./hosted-cluster-id.injectable";

import type { Cluster } from "../../common/cluster/cluster";

export type HostedCluster = Cluster;

const hostedClusterInjectable = getInjectable({
  id: "hosted-cluster",

  instantiate: (di) => {
    const hostedClusterId = di.inject(hostedClusterIdInjectable);
    const getClusterById = di.inject(getClusterByIdInjectable);
    const activeClusterEntity = di.inject(activeKubernetesClusterInjectable).get();
    const activeCluster = activeClusterEntity ? getClusterById(activeClusterEntity.getId()) : undefined;

    if (!hostedClusterId) {
      return activeCluster;
    }

    return getClusterById(hostedClusterId) ?? activeCluster;
  },
});

export default hostedClusterInjectable;
