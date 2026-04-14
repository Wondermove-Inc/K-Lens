/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Users } from "lucide-react";
import React from "react";
import podSecurityPoliciesRouteInjectable from "../../../common/front-end-routing/routes/cluster/user-management/pod-security-policies/pod-security-policies-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";
import userManagementSidebarItemInjectable from "../user-management/user-management-sidebar-item.injectable";

const podSecurityPoliciesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-pod-security-policies",

  instantiate: (di) => {
    const route = di.inject(podSecurityPoliciesRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: userManagementSidebarItemInjectable.id,
      title: "Pod Security Policies",
      getIcon: () => <Users className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Pod Security Policies 탭 생성 및 활성화
        createMainTab({
          title: "Pod Security Policies",
          route: route.path,
          icon: "ShieldCheck", // 🎨 Pod Security Policies에 적합한 아이콘 (lucide-react)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 60,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default podSecurityPoliciesSidebarItemInjectable;
