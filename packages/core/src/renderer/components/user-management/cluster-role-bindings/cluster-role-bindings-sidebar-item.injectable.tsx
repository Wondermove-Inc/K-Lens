/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Users } from "lucide-react";
import React from "react";
import clusterRoleBindingsRouteInjectable from "../../../../common/front-end-routing/routes/cluster/user-management/cluster-role-bindings/cluster-role-bindings-route.injectable";
import routeIsActiveInjectable from "../../../routes/route-is-active.injectable";
import createMainTabInjectable from "../../main-tabs/create-main-tab.injectable";
import userManagementSidebarItemInjectable from "../user-management-sidebar-item.injectable";

const clusterRoleBindingsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-cluster-role-bindings",

  instantiate: (di) => {
    const route = di.inject(clusterRoleBindingsRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: userManagementSidebarItemInjectable.id,
      title: "Cluster Role Bindings",
      getIcon: () => <Users className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Cluster Role Bindings 탭 생성 및 활성화
        createMainTab({
          title: "Cluster Role Bindings",
          route: route.path,
          icon: "Link", // 🎨 Cluster Role Bindings에 적합한 아이콘 (lucide-react)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 40,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default clusterRoleBindingsSidebarItemInjectable;
