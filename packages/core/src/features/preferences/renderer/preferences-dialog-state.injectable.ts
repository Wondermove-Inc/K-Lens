/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Preferences Dialog의 열림/닫힘 상태 관리
 *
 * MobX observable을 사용하여 Dialog의 상태를 전역적으로 관리합니다.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { observable } from "mobx";

export interface PreferencesDialogState {
  isOpen: boolean;
  initialMenu?: string; // 🔄 추가: Dialog 열릴 때 활성화할 초기 메뉴 (예: "LLM Models")
}

const preferencesDialogStateInjectable = getInjectable({
  id: "preferences-dialog-state",
  instantiate: (): PreferencesDialogState =>
    observable({
      isOpen: false,
      initialMenu: undefined,
    }),
  causesSideEffects: true,
});

export default preferencesDialogStateInjectable;
