/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Cog } from "lucide-react";
import React from "react";
import runtimeClassesRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/runtime-classes/runtime-classes-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import configSidebarItemInjectable from "../config/config-sidebar-item.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";

const runtimeClassesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-runtime-classes",

  instantiate: (di) => {
    const route = di.inject(runtimeClassesRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: configSidebarItemInjectable.id,
      title: "Runtime Classes",
      getIcon: () => <Cog className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Runtime Classes 탭 생성 및 활성화
        createMainTab({
          title: "Runtime Classes",
          route: route.path,
          icon: "Cog", // 🎨 Config 카테고리 통일 아이콘
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 70,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default runtimeClassesSidebarItemInjectable;
