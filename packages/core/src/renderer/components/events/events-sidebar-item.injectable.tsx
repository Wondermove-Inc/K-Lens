/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Bell } from "lucide-react";
import React from "react";
import eventsRouteInjectable from "../../../common/front-end-routing/routes/cluster/events/events-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";

const eventsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-events",

  instantiate: (di) => {
    const route = di.inject(eventsRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: null,
      getIcon: () => <Bell className="h-4 w-4" />,
      title: "Events",
      onClick: () => {
        // 🎯 MainTab 생성 및 활성화
        createMainTab({
          title: "Events",
          route: route.path,
          icon: "Bell", // 🎨 icon name 전달 (lucide-react)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 80,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default eventsSidebarItemInjectable;
