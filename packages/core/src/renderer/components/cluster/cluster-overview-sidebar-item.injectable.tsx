/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Server } from "lucide-react";
import React from "react";
import clusterOverviewRouteInjectable from "../../../common/front-end-routing/routes/cluster/overview/cluster-overview-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";

const clusterOverviewSidebarItemInjectable = getInjectable({
  id: "sidebar-item-cluster-overview",

  instantiate: (di) => {
    const route = di.inject(clusterOverviewRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: null,
      title: "Cluster",
      getIcon: () => <Server className="h-4 w-4" />,
      onClick: () => {
        // 🎯 MainTab 생성 및 활성화
        createMainTab({
          title: "Cluster",
          route: route.path,
          icon: "Server", // 🎨 icon name 전달 (lucide-react)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 10,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default clusterOverviewSidebarItemInjectable;
