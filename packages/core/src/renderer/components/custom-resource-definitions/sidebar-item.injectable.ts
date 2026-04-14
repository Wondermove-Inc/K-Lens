/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import customResourceDefinitionsRouteInjectable from "../../../common/front-end-routing/routes/cluster/custom-resources/custom-resource-definitions.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import customResourcesSidebarItemInjectable from "../custom-resources/sidebar-item.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";

/**
 * 🎯 목적: Custom Resource Definitions 사이드바 메뉴 아이템과 탭 생성 기능
 *
 * @description
 * - 사이드바 클릭 시 Custom Resource Definitions 목록 탭 생성
 * - 기존 탭이 있으면 활성화, 없으면 새로 생성
 * - Custom Resources 섹션 하위 메뉴로 표시
 *
 * 🔄 변경이력: 2025-09-29 - 탭 생성 기능 추가
 */

const customResourceDefinitionsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-custom-resource-definitions",
  instantiate: (di) => {
    const customResourceDefinitionsRoute = di.inject(customResourceDefinitionsRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: customResourcesSidebarItemInjectable.id,
      title: "Definitions",
      onClick: () => {
        // 🎯 탭 생성 및 활성화
        createMainTab({
          title: "Definitions",
          route: customResourceDefinitionsRoute.path,
        });
      },
      isActive: di.inject(routeIsActiveInjectable, customResourceDefinitionsRoute),
      isVisible: customResourceDefinitionsRoute.isEnabled,
      orderNumber: 0,
    };
  },
  injectionToken: sidebarItemInjectionToken,
});

export default customResourceDefinitionsSidebarItemInjectable;
