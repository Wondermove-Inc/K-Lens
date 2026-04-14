/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemsInjectable } from "@skuberplus/cluster-sidebar";
import { computed } from "mobx";
import mainTabStoreInjectable from "../components/main-tabs/main-tab-store.injectable";

const siblingTabsInjectable = getInjectable({
  id: "sibling-tabs",

  instantiate: (di) => {
    const sidebarItems = di.inject(sidebarItemsInjectable);
    const mainTabStore = di.inject(mainTabStoreInjectable);

    return computed(() => {
      // 🔥 핵심 로직: MainTab이 하나라도 있으면 기존 sibling tabs 완전 비활성화
      // 🎯 목적: 크롬 스타일 탭과 기존 TabLayout 시스템 간의 중복 방지
      if (mainTabStore.hasTabs) {
        return [];
      }

      // 🔄 기존 로직: MainTab이 없을 때만 사이드바의 children을 탭으로 표시
      // 📝 주의사항: 하위 호환성 보장 - createMainTab을 사용하지 않는 리소스는 기존 방식 유지
      return (
        sidebarItems
          .get()
          .find(({ isActive }) => isActive.get())
          ?.children.filter(({ isVisible }) => isVisible.get()) ?? []
      );
    });
  },
});

export default siblingTabsInjectable;
