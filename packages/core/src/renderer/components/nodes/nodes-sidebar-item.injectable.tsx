/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Layers2 } from "lucide-react";
import React from "react";
import nodesRouteInjectable from "../../../common/front-end-routing/routes/cluster/nodes/nodes-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";

const nodesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-nodes",

  instantiate: (di) => {
    const route = di.inject(nodesRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: null,
      getIcon: () => <Layers2 className="h-4 w-4" />,
      title: "Nodes",
      onClick: () => {
        // 🎯 MainTab 생성 및 활성화
        createMainTab({
          title: "Nodes",
          route: route.path,
          icon: "Layers2", // 🎨 Nodes에 적합한 아이콘 (lucide-react)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 20,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default nodesSidebarItemInjectable;
