/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Waypoints } from "lucide-react";
import React from "react";
import endpointsRouteInjectable from "../../../common/front-end-routing/routes/cluster/network/endpoints/endpoints-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";
import networkSidebarItemInjectable from "../network/network-sidebar-item.injectable";

const endpointsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-endpoints",

  instantiate: (di) => {
    const route = di.inject(endpointsRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: networkSidebarItemInjectable.id,
      title: "Endpoints",
      getIcon: () => <Waypoints className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Endpoints 탭 생성 및 활성화
        createMainTab({
          title: "Endpoints",
          route: route.path,
          icon: "Waypoints", // 🎨 Network 카테고리 통일 아이콘
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 21,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default endpointsSidebarItemInjectable;
