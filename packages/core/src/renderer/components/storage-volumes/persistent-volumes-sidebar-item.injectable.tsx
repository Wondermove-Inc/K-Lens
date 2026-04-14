/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { HardDrive } from "lucide-react";
import React from "react";
import persistentVolumesRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/persistent-volumes/persistent-volumes-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";
import storageSidebarItemInjectable from "../storage/storage-sidebar-item.injectable";

const persistentVolumesSidebarItemInjectable = getInjectable({
  id: "sidebar-item-persistent-volumes",

  instantiate: (di) => {
    const route = di.inject(persistentVolumesRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: storageSidebarItemInjectable.id,
      title: "Persistent Volumes",
      getIcon: () => <HardDrive className="h-4 w-4" />,
      onClick: () => {
        // 🎯 Persistent Volumes 탭 생성 및 활성화
        createMainTab({
          title: "Persistent Volumes",
          route: route.path,
          icon: "HardDrive", // 🎨 PV에 적합한 아이콘 (lucide-react)
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 20,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default persistentVolumesSidebarItemInjectable;
