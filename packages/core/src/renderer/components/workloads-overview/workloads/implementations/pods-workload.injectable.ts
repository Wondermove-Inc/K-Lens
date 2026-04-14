/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import podsRouteInjectable from "../../../../../common/front-end-routing/routes/cluster/workloads/pods/pods-route.injectable";
import { ResourceNames } from "../../../../utils/rbac";
import createMainTabInjectable from "../../../main-tabs/create-main-tab.injectable";
import namespaceStoreInjectable from "../../../namespaces/store.injectable";
import podStoreInjectable from "../../../workloads-pods/store.injectable";
import { workloadInjectionToken } from "../workload-injection-token";

const podsWorkloadInjectable = getInjectable({
  id: "pods-workload",

  instantiate: (di) => {
    const createMainTab = di.inject(createMainTabInjectable);
    const route = di.inject(podsRouteInjectable);
    const namespaceStore = di.inject(namespaceStoreInjectable);
    const store = di.inject(podStoreInjectable);

    return {
      resource: {
        apiName: "pods",
        group: "",
      },
      // 🎯 목적: Workloads Overview에서 Pods 카드 클릭 시 탭 생성 및 페이지 이동
      open: () => {
        createMainTab({
          title: "Pods",
          route: route.path,
          icon: "Workflow",
        });
      },

      amountOfItems: computed(() => store.getAllByNs(namespaceStore.contextNamespaces).length),

      status: computed(() => store.getStatuses(store.getAllByNs(namespaceStore.contextNamespaces))),

      title: ResourceNames.pods,
      orderNumber: 10,
    };
  },

  injectionToken: workloadInjectionToken,
});

export default podsWorkloadInjectable;
