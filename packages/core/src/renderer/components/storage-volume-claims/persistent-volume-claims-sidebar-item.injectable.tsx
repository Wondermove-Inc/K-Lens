/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { HardDrive } from "lucide-react";
import React from "react";
import persistentVolumeClaimsRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/persistent-volume-claims/persistent-volume-claims-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";
import storageSidebarItemInjectable from "../storage/storage-sidebar-item.injectable";

const persistentVolumeClaimsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-persistent-volume-claims",

  instantiate: (di) => {
    const route = di.inject(persistentVolumeClaimsRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: storageSidebarItemInjectable.id,
      title: "Persistent Volume Claims",
      getIcon: () => <HardDrive className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Persistent Volume Claims 탭 생성 및 활성화
        createMainTab({
          title: "Persistent Volume Claims",
          route: route.path,
          icon: "HardDrive", // 🎨 Storage 카테고리 통일 아이콘
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 10,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default persistentVolumeClaimsSidebarItemInjectable;
