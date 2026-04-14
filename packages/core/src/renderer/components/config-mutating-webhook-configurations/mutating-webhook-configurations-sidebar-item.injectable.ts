/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { Cog } from "lucide-react";
import React from "react";
import mutatingWebhookConfigurationsRouteInjectable from "../../../common/front-end-routing/routes/cluster/config/mutating-webhook-configurations/mutating-webhook-configurations-route.injectable";
import routeIsActiveInjectable from "../../routes/route-is-active.injectable";
import configSidebarItemInjectable from "../config/config-sidebar-item.injectable";
import createMainTabInjectable from "../main-tabs/create-main-tab.injectable";

/**
 * 🎯 목적: Mutating Webhook Configurations 사이드바 메뉴 아이템과 탭 생성 기능
 *
 * @description
 * - 사이드바 클릭 시 Mutating Webhook Configs 목록 탭 생성
 * - 기존 탭이 있으면 활성화, 없으면 새로 생성
 * - Config 섹션 하위 메뉴로 표시
 *
 * 🔄 변경이력: 2025-09-29 - 탭 생성 기능 추가
 */

const mutatingWebhookConfigurationsSidebarItemInjectable = getInjectable({
  id: "sidebar-item-mutating-webhook-configurations",

  instantiate: (di) => {
    const route = di.inject(mutatingWebhookConfigurationsRouteInjectable);
    const createMainTab = di.inject(createMainTabInjectable);

    return {
      parentId: configSidebarItemInjectable.id,
      title: "Mutating Webhook Configs",
      getIcon: () => React.createElement(Cog, { className: "h-4 w-4" }),
      onClick: () => {
        // 🎯 탭 생성 및 활성화
        createMainTab({
          title: "Mutating Webhook Configs",
          route: route.path,
        });
      },
      isActive: di.inject(routeIsActiveInjectable, route),
      isVisible: route.isEnabled,
      orderNumber: 100,
    };
  },

  injectionToken: sidebarItemInjectionToken,
});

export default mutatingWebhookConfigurationsSidebarItemInjectable;
