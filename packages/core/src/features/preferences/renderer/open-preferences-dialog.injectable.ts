/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Preferences Dialog를 여는 함수 제공
 *
 * Hotbar settings 버튼, Application Menu, Tray 등에서 호출됩니다.
 */

import { getInjectable } from "@ogre-tools/injectable";
import preferencesDialogStateInjectable from "./preferences-dialog-state.injectable";

export type OpenPreferencesDialog = (initialMenu?: string) => void;

const openPreferencesDialogInjectable = getInjectable({
  id: "open-preferences-dialog",
  instantiate: (di): OpenPreferencesDialog => {
    const state = di.inject(preferencesDialogStateInjectable);

    return (initialMenu?: string) => {
      state.initialMenu = initialMenu;
      state.isOpen = true;
    };
  },
});

export default openPreferencesDialogInjectable;
