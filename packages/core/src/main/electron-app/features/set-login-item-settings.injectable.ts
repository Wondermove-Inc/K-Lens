/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import electronAppInjectable from "../electron-app.injectable";

import type { Settings } from "electron";

export type SetLoginItemSettings = (settings: Settings) => void;

const setLoginItemSettingsInjectable = getInjectable({
  id: "set-login-item-settings",
  instantiate: (di): SetLoginItemSettings => {
    const electronApp = di.inject(electronAppInjectable);

    const isDevQuietMode = process.env.DAIVE_DEV_LOG_MODE === "quiet";

    return (settings) => {
      if (isDevQuietMode) {
        return;
      }

      electronApp.setLoginItemSettings(settings);
    };
  },
});

export default setLoginItemSettingsInjectable;
