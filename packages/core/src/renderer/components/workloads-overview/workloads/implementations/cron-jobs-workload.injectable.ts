/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import cronJobsRouteInjectable from "../../../../../common/front-end-routing/routes/cluster/workloads/cron-jobs/cron-jobs-route.injectable";
import { ResourceNames } from "../../../../utils/rbac";
import createMainTabInjectable from "../../../main-tabs/create-main-tab.injectable";
import namespaceStoreInjectable from "../../../namespaces/store.injectable";
import cronJobsStoreInjectable from "../../../workloads-cronjobs/store.injectable";
import { workloadInjectionToken } from "../workload-injection-token";

const cronJobsWorkloadInjectable = getInjectable({
  id: "cron-jobs-workload",

  instantiate: (di) => {
    const createMainTab = di.inject(createMainTabInjectable);
    const route = di.inject(cronJobsRouteInjectable);
    const namespaceStore = di.inject(namespaceStoreInjectable);
    const store = di.inject(cronJobsStoreInjectable);

    return {
      resource: {
        apiName: "cronjobs",
        group: "batch",
      },
      // 🎯 목적: Workloads Overview에서 CronJobs 카드 클릭 시 탭 생성 및 페이지 이동
      open: () => {
        createMainTab({
          title: "Cron Jobs",
          route: route.path,
          icon: "Workflow",
        });
      },
      amountOfItems: computed(() => store.getAllByNs(namespaceStore.contextNamespaces).length),
      status: computed(() => store.getStatuses(store.getAllByNs(namespaceStore.contextNamespaces))),
      title: ResourceNames.cronjobs,
      orderNumber: 70,
    };
  },

  injectionToken: workloadInjectionToken,
});

export default cronJobsWorkloadInjectable;
