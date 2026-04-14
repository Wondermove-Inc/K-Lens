/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Waypoints } from "lucide-react";
import React from "react";
import ingressClassesRouteInjectable from "../../../common/front-end-routing/routes/cluster/network/ingress-class/ingress-classes-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";
import networkSidebarItemInjectable from "../network/network-sidebar-item.injectable";

const ingressClassesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-ingress-classes",
  instantiate: (di) => {
    const ingressClassRoute = di.inject(ingressClassesRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: networkSidebarItemInjectable.id,
      title: "Ingress Classes",
      getIcon: () => React.createElement(Waypoints, { className: "h-4 w-4" }),
      onClick: () => {
        // 🎯 Ingress Classes 탭 생성 및 활성화
        createMainTab({
          title: "Ingress Classes",
          route: ingressClassRoute.path,
          icon: "category", // 🎨 Ingress Classes에 적합한 아이콘 (분류/카테고리)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, ingressClassRoute),
      isVisible: ingressClassRoute.isEnabled,
      orderNumber: 31,
    };
  },
  injectionToken: sidebarItemInjectionToken,
});

export default ingressClassesSidebarItemInjectable;
