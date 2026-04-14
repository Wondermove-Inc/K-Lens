/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Preferences Dialog를 닫는 함수 제공
 *
 * Dialog의 ESC 키, X 버튼, 또는 외부 클릭 시 호출됩니다.
 */

import { getInjectable } from "@ogre-tools/injectable";
import preferencesDialogStateInjectable from "./preferences-dialog-state.injectable";

export type ClosePreferencesDialog = () => void;

const closePreferencesDialogInjectable = getInjectable({
  id: "close-preferences-dialog",
  instantiate: (di): ClosePreferencesDialog => {
    const state = di.inject(preferencesDialogStateInjectable);

    return () => {
      state.isOpen = false;
    };
  },
});

export default closePreferencesDialogInjectable;
