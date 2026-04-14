/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import createStorageInjectable from "../../utils/create-storage/create-storage.injectable";
import { SPLIT_CONSTANTS } from "./split-types";

import type { MainTabStorageStateV2 } from "./main-tab.model";

/**
 * 🎯 목적: 메인 탭 상태의 영구 저장소 관리
 *
 * @description
 * - localStorage를 사용하여 탭 상태를 세션 간 유지
 * - 앱 재시작 후에도 이전에 열었던 탭들이 복원됨
 * - 활성 탭 정보도 함께 저장되어 사용자 작업 흐름 유지
 * - V2 형식: groups, splitLayout 지원
 *
 * 📝 주의사항:
 * - 브라우저의 localStorage 용량 제한 고려 (일반적으로 5-10MB)
 * - 탭 개수가 너무 많아지지 않도록 관리 필요
 *
 * 🔄 변경이력:
 * - 2025-09-25: 초기 생성 (localStorage 기반 탭 상태 저장)
 * - 2025-10-29: V2 형식으로 변경 (groups, splitLayout 지원)
 */

const defaultMainTabStorageState: MainTabStorageStateV2 = {
  version: 2,
  groups: [
    {
      id: "left",
      tabs: [],
      activeTabId: undefined,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    },
  ],
  splitLayout: {
    enabled: false,
    leftRatio: SPLIT_CONSTANTS.DEFAULT_LEFT_RATIO,
    activeGroupId: "left",
    orientation: SPLIT_CONSTANTS.DEFAULT_ORIENTATION,
  },
  activeTabId: undefined,
};

const mainTabStorageInjectable = getInjectable({
  id: "main-tab-storage",

  instantiate: (di) => {
    const createStorage = di.inject(createStorageInjectable);

    return createStorage("main-tabs", defaultMainTabStorageState);
  },

  causesSideEffects: true,
});

export { defaultMainTabStorageState };
export default mainTabStorageInjectable;
