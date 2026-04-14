/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import lensColorThemePreferenceInjectable from "../../features/user-preferences/common/lens-color-theme.injectable";
import systemThemeConfigurationInjectable from "./system-theme.injectable";

import type { ThemeType } from "./lens-theme";

/**
 * Simplified to return ThemeType only
 *
 * Status: PHASE 2 COMPLETE - Returns ThemeType ("dark" | "light")
 * Changes:
 * - Removed stub-themes.ts dependency
 * - Returns simple ThemeType string instead of full LensTheme object
 * - Actual theming is done via CSS variables in global.css
 * - HTML classes (theme-default-dark/light) control theme application
 *
 * Migration Path:
 * - ✅ PHASE 1: Used stub themes directly
 * - ✅ PHASE 2: Return ThemeType only (current)
 * - PHASE 3: Remove LensTheme dependency entirely from codebase
 *
 * @see global.css - CSS variables for theme colors
 * @see setup-apply-active-theme.injectable.ts - HTML class application
 */
const activeThemeInjectable = getInjectable({
  id: "active-theme",
  instantiate: (di) => {
    const lensColorThemePreference = di.inject(lensColorThemePreferenceInjectable);
    const systemThemeConfiguration = di.inject(systemThemeConfigurationInjectable);

    return computed((): ThemeType => {
      const pref = lensColorThemePreference.get();

      if (pref.useSystemTheme) {
        // Return system theme type directly
        return systemThemeConfiguration.get();
      }

      // lensThemeId 값 기반으로 ThemeType 결정
      // 예: "Light", "lens-light" → "light"
      // 예: "Dark", "lens-dark" → "dark"
      const themeId = pref.lensThemeId.toLowerCase();
      return themeId.includes("light") ? "light" : "dark";
    });
  },
});

export default activeThemeInjectable;
