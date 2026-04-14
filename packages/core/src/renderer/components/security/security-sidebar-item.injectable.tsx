/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: Registers the Security menu item in the sidebar.
 * Added sidebar Security section
 *
 *  Pattern: Same structure as cluster-overview-sidebar-item.injectable.tsx.
 * orderNumber: 71 — placed just below Namespaces(70)
 *
 * @packageDocumentation
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { ShieldCheck } from "lucide-react";
import React from "react";
import securityRouteInjectable from "../../../common/front-end-routing/routes/cluster/security/security-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";

const securitySidebarItemInjectable = getInjectable({
  id: "sidebar-item-security",

  instantiate: (di) => {
    const route = di.inject(securityRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: null,
      title: "Security",
      getIcon: () => <ShieldCheck className="h-4 w-4" />,
      onClick: () => {
        createMainTab({
          title: "Security",
          route: route.path,
          icon: "ShieldCheck",
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 71,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default securitySidebarItemInjectable;
