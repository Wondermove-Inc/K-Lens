/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Waypoints } from "lucide-react";
import React from "react";
import ingressesRouteInjectable from "../../../common/front-end-routing/routes/cluster/network/ingresses/ingresses-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";
import networkSidebarItemInjectable from "../network/network-sidebar-item.injectable";

const ingressesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-ingresses",
  instantiate: (di) => {
    const ingressRoute = di.inject(ingressesRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: networkSidebarItemInjectable.id,
      title: "Ingresses",
      getIcon: () => React.createElement(Waypoints, { className: "h-4 w-4" }),
      onClick: () => {
        // 🎯 Ingresses 탭 생성 및 활성화
        createMainTab({
          title: "Ingresses",
          route: ingressRoute.path,
          icon: "public", // 🎨 Ingresses에 적합한 아이콘 (외부 액세스)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, ingressRoute),
      isVisible: ingressRoute.isEnabled,
      orderNumber: 30,
    };
  },
  injectionToken: sidebarItemInjectionToken,
});

export default ingressesSidebarItemInjectable;
