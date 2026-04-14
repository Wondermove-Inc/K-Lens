/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Cog } from "lucide-react";
import React from "react";
import limitRangesRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/limit-ranges/limit-ranges-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import configSidebarItemInjectable from "../config/config-sidebar-item.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";

const limitRangesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-limit-ranges",

  instantiate: (di) => {
    const route = di.inject(limitRangesRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: configSidebarItemInjectable.id,
      title: "Limit Ranges",
      getIcon: () => <Cog className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Limit Ranges 탭 생성 및 활성화
        createMainTab({
          title: "Limit Ranges",
          route: route.path,
          icon: "Cog", // 🎨 Config 카테고리 통일 아이콘
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 40,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default limitRangesSidebarItemInjectable;
