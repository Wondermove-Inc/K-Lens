/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import isWindowsInjectable from "../../../common/vars/is-windows.injectable";
import userInfoInjectable from "../../../common/vars/user-info.injectable";
import userPreferencesStateInjectable from "./state.injectable";

const userShellSettingInjectable = getInjectable({
  id: "user-shell-setting",
  instantiate: (di) => {
    const state = di.inject(userPreferencesStateInjectable);
    const userInfo = di.inject(userInfoInjectable);
    const isWindows = di.inject(isWindowsInjectable);

    return computed(() => {
      // Windows에서 WSL이 활성화된 경우 wsl.exe 반환
      if (isWindows && state.wslEnabled) {
        return "wsl.exe";
      }

      return state.shell || userInfo.shell;
    });
  },
});

export default userShellSettingInjectable;
