/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Users } from "lucide-react";
import React from "react";
import serviceAccountsRouteInjectable from "../../../../common/front-end-routing/routes/cluster/user-management/service-accounts/service-accounts-route.injectable";
import routeIsActiveInjectable from "../../../routes/route-is-active.injectable";
import createMainTabInjectable from "../../main-tabs/create-main-tab.injectable";
import userManagementSidebarItemInjectable from "../user-management-sidebar-item.injectable";

const serviceAccountsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-service-accounts",

  instantiate: (di) => {
    const route = di.inject(serviceAccountsRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: userManagementSidebarItemInjectable.id,
      title: "Service Accounts",
      getIcon: () => <Users className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Service Accounts 탭 생성 및 활성화
        createMainTab({
          title: "Service Accounts",
          route: route.path,
          icon: "Users", // 🎨 Service Accounts에 적합한 아이콘 (lucide-react)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 10,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default serviceAccountsSidebarItemInjectable;
