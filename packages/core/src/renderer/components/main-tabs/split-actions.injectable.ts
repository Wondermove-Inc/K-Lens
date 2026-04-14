/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Split 관련 액션 로직
 *
 * @description
 * - splitTabRight: 현재 탭을 오른쪽으로 split
 * - closeSplit: Split 닫고 merge
 * - moveTabToOtherGroup: 탭을 반대 그룹으로 이동
 * - focusLeftGroup, focusRightGroup: 그룹 포커스 전환
 *
 * 📝 주의사항:
 * - splitTabRight는 isSplitActive가 false일 때만 동작
 * - closeSplit, moveTabToOtherGroup은 isSplitActive가 true일 때만 동작
 * - focusRightGroup은 isSplitActive가 true일 때만 동작
 *
 * 🔄 변경이력: 2025-10-29 - Level 5 Split 액션 구현
 */
import { getInjectable } from "@ogre-tools/injectable";
import * as uuid from "uuid";
import navigateInjectable from "../../navigation/navigate.injectable";
import mainTabStoreInjectable from "./main-tab-store.injectable";
import { SPLIT_CONSTANTS } from "./split-types";

import type { Navigate } from "../../navigation/navigate.injectable";
import type { MainTabId } from "./main-tab.model";
import type { MainTabStore } from "./main-tab-store";

export interface SplitActions {
  /** 현재 활성 탭을 오른쪽으로 split */
  splitTabRight(): void;

  /** 현재 활성 탭을 아래쪽으로 split */
  splitTabDown(): void;

  /** Split 닫고 merge (모든 탭을 왼쪽 그룹으로) */
  closeSplit(): void;

  /** 탭을 다른 그룹으로 이동 */
  moveTabToOtherGroup(tabId: MainTabId): void;

  /** 좌측 그룹 포커스 */
  focusLeftGroup(): void;

  /** 우측 그룹 포커스 */
  focusRightGroup(): void;
}

const splitActionsInjectable = getInjectable({
  id: "split-actions",
  instantiate: (di): SplitActions => {
    const mainTabStore = di.inject(mainTabStoreInjectable) as MainTabStore;
    const navigate = di.inject(navigateInjectable) as Navigate;

    return {
      /**
       * 🎯 목적: 현재 활성 탭을 오른쪽으로 split
       *
       * @description
       * 1. 이미 split 활성화된 경우 → 아무 동작 없음
       * 2. 현재 활성 탭 복사 → 우측 그룹 생성
       * 3. 우측 그룹 활성화 및 navigate
       *
       * 📝 주의사항:
       * - 탭 ID는 uuid.v4()로 새로 생성 (충돌 방지)
       * - 활성 탭이 없으면 경고만 출력하고 종료
       *
       * 🔄 변경이력: 2025-10-29 - 초기 생성
       */
      splitTabRight() {
        // 🛡️ 이미 split 활성화되었으면 무시
        if (mainTabStore.isSplitActive) {
          console.warn("[Split Actions] Split already active");
          return;
        }

        // 🔍 현재 활성 탭 확인
        const activeTab = mainTabStore.activeTab;
        if (!activeTab) {
          console.warn("[Split Actions] No active tab to split");
          return;
        }

        try {
          // 🔧 Split 방향 설정 및 비율 초기화
          mainTabStore.setSplitOrientation("horizontal");
          mainTabStore.setSplitRatio(SPLIT_CONSTANTS.DEFAULT_LEFT_RATIO);

          // 1️⃣ 우측 그룹 생성
          mainTabStore.createGroup("right");

          // 2️⃣ 현재 탭 복사 → 우측 그룹
          const copiedTab = {
            ...activeTab,
            id: uuid.v4(), // 🔥 uuid로 새 ID 생성 (충돌 방지)
            createdAt: new Date(),
            lastActiveAt: new Date(),
          };

          mainTabStore.addTabToGroup(copiedTab, "right");

          // 3️⃣ 우측 그룹 활성화
          mainTabStore.activateGroup("right");
          navigate(copiedTab.route);
        } catch (error) {
          console.error("[Split Actions] Failed to split tab right", error);
        }
      },

      /**
       * 🎯 목적: 현재 활성 탭을 아래쪽으로 split
       */
      splitTabDown() {
        if (mainTabStore.isSplitActive) {
          console.warn("[Split Actions] Split already active");
          return;
        }

        const activeTab = mainTabStore.activeTab;
        if (!activeTab) {
          console.warn("[Split Actions] No active tab to split");
          return;
        }

        try {
          mainTabStore.setSplitOrientation("vertical");
          mainTabStore.setSplitRatio(SPLIT_CONSTANTS.DEFAULT_LEFT_RATIO);

          mainTabStore.createGroup("right");

          const copiedTab = {
            ...activeTab,
            id: uuid.v4(),
            createdAt: new Date(),
            lastActiveAt: new Date(),
          };

          mainTabStore.addTabToGroup(copiedTab, "right");
          mainTabStore.activateGroup("right");
          navigate(copiedTab.route);
        } catch (error) {
          console.error("[Split Actions] Failed to split tab down", error);
        }
      },

      /**
       * 🎯 목적: Split 닫고 merge
       *
       * @description
       * 1. 우측 그룹의 탭들을 좌측으로 이동 (중복 제거)
       * 2. 우측 그룹 닫기
       * 3. 좌측 그룹 활성화
       *
       * 📝 주의사항:
       * - closeGroup()이 내부적으로 merge 수행
       * - Split 비활성 상태에서 호출하면 경고만 출력
       *
       * 🔄 변경이력: 2025-10-29 - 초기 생성
       */
      closeSplit() {
        // 🛡️ Split 비활성 상태에서 호출 방지
        if (!mainTabStore.isSplitActive) {
          console.warn("[Split Actions] Split not active");
          return;
        }

        try {
          // 우측 그룹 닫기 (내부적으로 merge 수행)
          mainTabStore.closeGroup("right");

          // 좌측 그룹 활성화
          this.focusLeftGroup();
        } catch (error) {
          console.error("[Split Actions] Failed to close split", error);
        }
      },

      /**
       * 🎯 목적: 탭을 다른 그룹으로 이동
       *
       * @param tabId - 이동할 탭 ID
       *
       * @description
       * 1. 탭이 속한 그룹 찾기
       * 2. 반대 그룹 ID 결정
       * 3. moveTabToGroup() 호출
       *
       * 📝 주의사항:
       * - Split 비활성 상태에서는 동작하지 않음
       * - 탭을 찾지 못하면 경고만 출력
       *
       * 🔄 변경이력: 2025-10-29 - 초기 생성
       */
      moveTabToOtherGroup(tabId: MainTabId) {
        // 🛡️ Split 비활성 상태에서 호출 방지
        if (!mainTabStore.isSplitActive) {
          console.warn("[Split Actions] Split not active");
          return;
        }

        // 🔍 탭이 속한 그룹 찾기
        const sourceGroup = mainTabStore.groups.find((g) => g.tabs.some((t) => t.id === tabId));

        if (!sourceGroup) {
          console.warn(`[Split Actions] Tab ${tabId} not found`);
          return;
        }

        // 🔄 반대 그룹으로 이동
        const targetGroupId = sourceGroup.id === "left" ? "right" : "left";

        try {
          mainTabStore.moveTabToGroup(tabId, targetGroupId);
        } catch (error) {
          console.error("[Split Actions] Failed to move tab to other group", error);
        }
      },

      /**
       * 🎯 목적: 좌측 그룹 포커스
       *
       * @description
       * 1. activateGroup("left") 호출
       * 2. 좌측 그룹의 활성 탭으로 navigate
       *
       * 📝 주의사항:
       * - 항상 동작 (Split 비활성 시에도)
       * - 활성 탭이 없으면 navigate 스킵
       *
       * 🔄 변경이력: 2025-10-29 - 초기 생성
       */
      focusLeftGroup() {
        mainTabStore.activateGroup("left");

        // 좌측 그룹의 활성 탭으로 navigate
        const leftGroup = mainTabStore.leftGroup;
        if (leftGroup?.activeTabId) {
          const activeTab = leftGroup.tabs.find((t) => t.id === leftGroup.activeTabId);
          if (activeTab) {
            navigate(activeTab.route);
          }
        }
      },

      /**
       * 🎯 목적: 우측 그룹 포커스
       *
       * @description
       * 1. Split 활성 상태 확인
       * 2. activateGroup("right") 호출
       * 3. 우측 그룹의 활성 탭으로 navigate
       *
       * 📝 주의사항:
       * - Split 비활성 상태에서는 동작하지 않음
       * - 활성 탭이 없으면 navigate 스킵
       *
       * 🔄 변경이력: 2025-10-29 - 초기 생성
       */
      focusRightGroup() {
        // 🛡️ Split 비활성 상태에서 호출 방지
        if (!mainTabStore.isSplitActive) {
          console.warn("[Split Actions] Split not active");
          return;
        }

        mainTabStore.activateGroup("right");

        // 우측 그룹의 활성 탭으로 navigate
        const rightGroup = mainTabStore.rightGroup;
        if (rightGroup?.activeTabId) {
          const activeTab = rightGroup.tabs.find((t) => t.id === rightGroup.activeTabId);
          if (activeTab) {
            navigate(activeTab.route);
          }
        }
      },
    };
  },
});

export default splitActionsInjectable;
