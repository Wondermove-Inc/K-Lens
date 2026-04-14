/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import createStorageInjectable from "../../../utils/create-storage/create-storage.injectable";

export interface SidebarStorageState {
  width: number;
  expanded: {
    [itemId: string]: boolean;
  };
  isOpen: boolean; // 🔄 추가: Sidebar 열림/닫힘 상태
}

export const defaultSidebarWidth = 310;

const sidebarStorageInjectable = getInjectable({
  id: "sidebar-storage",

  instantiate: (di) => {
    const createStorage = di.inject(createStorageInjectable);

    const storage = createStorage("sidebar", {
      width: defaultSidebarWidth,
      expanded: {},
      isOpen: true, // 🔄 추가: 기본적으로 Sidebar 열려있음
    });

    // 🎯 앱 시작 시 사이드바를 열린 상태로 초기화 (폭은 localStorage에서 복원된 값 유지)
    storage.merge({ isOpen: true });

    return storage;
  },
});

export default sidebarStorageInjectable;
