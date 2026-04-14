/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import sidebarStorageInjectable from "./sidebar-storage.injectable";

/**
 * 🎯 목적: Sidebar 열림/닫힘 토글 공용 액션
 *
 * - Hotbar Explorer, Topbar Panel Controls 등 여러 위치에서 동일 로직 사용
 * - 사용자가 조절한 폭은 유지됨 (기본 폭으로 리셋하려면 ResizeHandle 더블클릭)
 */
const toggleSidebarVisibilityInjectable = getInjectable({
  id: "toggle-sidebar-visibility",

  instantiate: (di) => {
    const sidebarStorage = di.inject(sidebarStorageInjectable);

    return () => {
      const currentState = sidebarStorage.get();

      sidebarStorage.merge({
        isOpen: !currentState.isOpen,
      });
    };
  },
  causesSideEffects: true,
});

export default toggleSidebarVisibilityInjectable;
