/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Users } from "lucide-react";
import React from "react";
import rolesRouteInjectable from "../../../../common/front-end-routing/routes/cluster/user-management/roles/roles-route.injectable";
import routeIsActiveInjectable from "../../../routes/route-is-active.injectable";
import createMainTabInjectable from "../../main-tabs/create-main-tab.injectable";
import userManagementSidebarItemInjectable from "../user-management-sidebar-item.injectable";

const rolesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-roles",

  instantiate: (di) => {
    const route = di.inject(rolesRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: userManagementSidebarItemInjectable.id,
      title: "Roles",
      getIcon: () => <Users className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Roles 탭 생성 및 활성화
        createMainTab({
          title: "Roles",
          route: route.path,
          icon: "UserCog", // 🎨 Roles에 적합한 아이콘 (lucide-react)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 30,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default rolesSidebarItemInjectable;
