/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import replicasetsRouteInjectable from "../../../../../common/front-end-routing/routes/cluster/workloads/replicasets/replicasets-route.injectable";
import { ResourceNames } from "../../../../utils/rbac";
import createMainTabInjectable from "../../../main-tabs/create-main-tab.injectable";
import namespaceStoreInjectable from "../../../namespaces/store.injectable";
import replicasetsStoreInjectable from "../../../workloads-replicasets/store.injectable";
import { workloadInjectionToken } from "../workload-injection-token";

const replicasetsWorkloadInjectable = getInjectable({
  id: "replicasets-workload",

  instantiate: (di) => {
    const createMainTab = di.inject(createMainTabInjectable);
    const route = di.inject(replicasetsRouteInjectable);
    const namespaceStore = di.inject(namespaceStoreInjectable);
    const store = di.inject(replicasetsStoreInjectable);

    return {
      resource: {
        apiName: "replicasets",
        group: "apps",
      },
      // 🎯 목적: Workloads Overview에서 ReplicaSets 카드 클릭 시 탭 생성 및 페이지 이동
      open: () => {
        createMainTab({
          title: "Replica Sets",
          route: route.path,
          icon: "Workflow",
        });
      },

      amountOfItems: computed(() => store.getAllByNs(namespaceStore.contextNamespaces).length),

      status: computed(() => store.getStatuses(store.getAllByNs(namespaceStore.contextNamespaces))),

      title: ResourceNames.replicasets,
      orderNumber: 50,
    };
  },

  injectionToken: workloadInjectionToken,
});

export default replicasetsWorkloadInjectable;
