/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Cog } from "lucide-react";
import React from "react";
import leasesRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/leases/leases-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import configSidebarItemInjectable from "../config/config-sidebar-item.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";

const leasesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-leases",

  instantiate: (di) => {
    const route = di.inject(leasesRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: configSidebarItemInjectable.id,
      title: "Leases",
      getIcon: () => <Cog className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Leases 탭 생성 및 활성화
        createMainTab({
          title: "Leases",
          route: route.path,
          icon: "Cog", // 🎨 Config 카테고리 통일 아이콘
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 80,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default leasesSidebarItemInjectable;
