/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Layers } from "lucide-react";
import React from "react";
import namespacesRouteInjectable from "../../../common/front-end-routing/routes/cluster/namespaces/namespaces-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";

const namespacesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-namespaces",

  instantiate: (di) => {
    const route = di.inject(namespacesRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: null,
      getIcon: () => <Layers className="h-4 w-4" />,
      title: "Namespaces",
      onClick: () => {
        // 🎯 MainTab 생성 및 활성화
        createMainTab({
          title: "Namespaces",
          route: route.path,
          icon: "Layers", // 🎨 icon name 전달 (lucide-react)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 70,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default namespacesSidebarItemInjectable;
