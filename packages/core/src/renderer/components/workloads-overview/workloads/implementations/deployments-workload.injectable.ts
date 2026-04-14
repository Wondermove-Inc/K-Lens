/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import deploymentsRouteInjectable from "../../../../../common/front-end-routing/routes/cluster/workloads/deployments/deployments-route.injectable";
import { ResourceNames } from "../../../../utils/rbac";
import createMainTabInjectable from "../../../main-tabs/create-main-tab.injectable";
import namespaceStoreInjectable from "../../../namespaces/store.injectable";
import deploymentsStoreInjectable from "../../../workloads-deployments/store.injectable";
import { workloadInjectionToken } from "../workload-injection-token";

const deploymentsWorkloadInjectable = getInjectable({
  id: "deployments-workload",

  instantiate: (di) => {
    const createMainTab = di.inject(createMainTabInjectable);
    const route = di.inject(deploymentsRouteInjectable);
    const namespaceStore = di.inject(namespaceStoreInjectable);
    const store = di.inject(deploymentsStoreInjectable);

    return {
      resource: {
        apiName: "deployments",
        group: "apps",
      },
      // 🎯 목적: Workloads Overview에서 Deployments 카드 클릭 시 탭 생성 및 페이지 이동
      open: () => {
        createMainTab({
          title: "Deployments",
          route: route.path,
          icon: "Workflow",
        });
      },

      amountOfItems: computed(() => store.getAllByNs(namespaceStore.contextNamespaces).length),

      status: computed(() => store.getStatuses(store.getAllByNs(namespaceStore.contextNamespaces))),

      title: ResourceNames.deployments,
      orderNumber: 20,
    };
  },

  injectionToken: workloadInjectionToken,
});

export default deploymentsWorkloadInjectable;
