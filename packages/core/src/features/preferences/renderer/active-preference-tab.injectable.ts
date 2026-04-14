/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Preferences Dialog 활성 탭 상태 관리
 *
 * ClusterSettingsDialog의 active-tabs.injectable.ts 패턴을 따라
 * hash 기반으로 현재 활성화된 Preference 탭을 관리합니다.
 *
 * 📝 주의사항:
 * - URL hash (#tabId)를 사용하여 탭 상태 저장
 * - URL 경로를 변경하지 않고 hash만 변경하므로 모달과 충돌 없음
 * - 기본 탭: "app" (Application 설정)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { observableHistoryInjectionToken } from "@skuberplus/routing";
import { action, computed } from "mobx";
import preferencesCompositeInjectable from "./preference-items/preferences-composite.injectable";

import type { Composite } from "../../../common/utils/composite/get-composite/get-composite";
import type { PreferenceItemTypes, PreferenceTab } from "./preference-items/preference-item-injection-token";
import type { PreferenceTabsRoot } from "./preference-items/preference-tab-root";

/**
 * 🎯 목적: 활성 Preference 탭 정보
 */
export interface ActivePreferenceTabDetails {
  /**
   * 현재 활성 탭 ID
   */
  tabId: string;

  /**
   * 현재 활성 탭의 Composite 구조
   */
  tabComposite: Composite<PreferenceTab> | undefined;
}

/**
 * 🎯 목적: 활성 Preference 탭 인터페이스
 */
export interface ActivePreferenceTab {
  /**
   * 현재 활성 탭 정보 가져오기
   */
  get: () => ActivePreferenceTabDetails;

  /**
   * 활성 탭 변경하기
   */
  set: (tabId: string) => void;
}

const activePreferenceTabInjectable = getInjectable({
  id: "active-preference-tab",

  instantiate: (di): ActivePreferenceTab => {
    const observableHistory = di.inject(observableHistoryInjectionToken);
    const preferencesComposite = di.inject(preferencesCompositeInjectable);

    /**
     * 🎯 목적: Preferences Composite에서 모든 탭 추출
     */
    const getAllTabs = computed(() => {
      const composite = preferencesComposite.get();
      const tabs: Composite<PreferenceTab>[] = [];

      const collectTabs = (comp: Composite<PreferenceItemTypes | PreferenceTabsRoot>) => {
        if (comp.value.kind === "tab") {
          tabs.push(comp as Composite<PreferenceTab>);
        }

        comp.children.forEach(collectTabs);
      };

      collectTabs(composite);

      return tabs;
    });

    return {
      get: () => {
        const tabs = getAllTabs.get();
        const defaultTabId = "app"; // 기본 탭: Application
        const hashTabId = observableHistory.location.hash.slice(1); // # 제거
        const tabId = hashTabId || defaultTabId;

        // tabId에 해당하는 tab composite 찾기
        const tabComposite = tabs.find((tab) => tab.value.pathId === tabId);

        return {
          tabId,
          tabComposite,
        };
      },

      set: action((tabId: string) => {
        // hash를 업데이트하여 탭 전환 (URL 경로는 변경하지 않음)
        observableHistory.merge({ hash: tabId }, true);
      }),
    };
  },
});

export default activePreferenceTabInjectable;
