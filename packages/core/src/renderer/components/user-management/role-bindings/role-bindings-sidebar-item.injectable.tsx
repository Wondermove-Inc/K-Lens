/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Users } from "lucide-react";
import React from "react";
import roleBindingsRouteInjectable from "../../../../common/front-end-routing/routes/cluster/user-management/role-bindings/role-bindings-route.injectable";
import routeIsActiveInjectable from "../../../routes/route-is-active.injectable";
import createMainTabInjectable from "../../main-tabs/create-main-tab.injectable";
import userManagementSidebarItemInjectable from "../user-management-sidebar-item.injectable";

const roleBindingsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-role-bindings",

  instantiate: (di) => {
    const route = di.inject(roleBindingsRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: userManagementSidebarItemInjectable.id,
      title: "Role Bindings",
      getIcon: () => <Users className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Role Bindings 탭 생성 및 활성화
        createMainTab({
          title: "Role Bindings",
          route: route.path,
          icon: "Link2", // 🎨 Role Bindings에 적합한 아이콘 (lucide-react)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 50,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default roleBindingsSidebarItemInjectable;
