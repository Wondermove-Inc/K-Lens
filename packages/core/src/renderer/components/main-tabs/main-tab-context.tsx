/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";

import type { EditorGroupId, MainTab } from "./main-tab.model";

/**
 * 🎯 목적: 메인 탭 렌더링 시 현재 그룹과 탭 정보를 하위 컴포넌트와 공유합니다.
 *
 * @description
 * - Split 모드에서도 각 그룹별 활성 탭을 정확히 전달하기 위함
 * - 편집 뷰처럼 탭 ID가 필요한 컴포넌트에서 사용
 *
 * 📝 사용법:
 * - MainTabContainer에서 Provider로 감싸고, 하위에서는 useMainTabContext()로 소비
 * - 컨텍스트가 없을 경우 예외를 던져 잘못된 사용을 조기에 탐지
 */
interface MainTabContextValue {
  /** 📂 현재 렌더링 중인 그룹 ID */
  groupId: EditorGroupId;

  /** 🏷️ 해당 그룹에서 활성화된 탭 정보 */
  tab: MainTab;
}

const MainTabContext = React.createContext<MainTabContextValue | null>(null);

export const MainTabContextProvider = MainTabContext.Provider;

export const useOptionalMainTabContext = (): MainTabContextValue | null => React.useContext(MainTabContext);

export const useMainTabContext = (): MainTabContextValue => {
  const context = useOptionalMainTabContext();

  if (!context) {
    throw new Error("MainTabContext가 설정되지 않은 영역에서 useMainTabContext를 호출했습니다.");
  }

  return context;
};
