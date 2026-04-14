/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Workflow } from "lucide-react";
import React from "react";
import deploymentsRouteInjectable from "../../../common/front-end-routing/routes/cluster/workloads/deployments/deployments-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";
import workloadsSidebarItemInjectable from "../workloads/workloads-sidebar-item.injectable";

const deploymentsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-deployments",

  instantiate: (di) => {
    const route = di.inject(deploymentsRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: workloadsSidebarItemInjectable.id,
      title: "Deployments",
      getIcon: () => <Workflow className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Deployments 탭 생성 및 활성화
        createMainTab({
          title: "Deployments",
          route: route.path,
          icon: "Workflow", // 🎨 Workloads 카테고리 통일 아이콘
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 30,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default deploymentsSidebarItemInjectable;
