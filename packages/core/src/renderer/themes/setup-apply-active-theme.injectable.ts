/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import initializeSystemThemeTypeInjectable from "../../features/theme/system-type/renderer/initialize.injectable";
import initUserStoreInjectable from "../../features/user-preferences/renderer/load-storage.injectable";
import { beforeFrameStartsSecondInjectionToken } from "../before-frame-starts/tokens";
import activeThemeInjectable from "./active.injectable";

import type { ThemeType } from "./lens-theme";

/**
 * Simplified to HTML element class toggle
 *
 * Status: PHASE 2 COMPLETE
 * Changes:
 * - Uses document.documentElement instead of document.body
 * - Uses theme-default-dark/light classes (matches global.css selectors)
 * - Receives ThemeType directly from active.injectable.ts
 * - Removes opposite theme class when switching
 *
 * Migration Path:
 * - ✅ PHASE 1: Body class toggle (removed)
 * - ✅ PHASE 2: HTML element class toggle (current)
 * - PHASE 3: Further simplification if needed
 *
 * @see global.css - :where(.theme-default-dark) and :where(.theme-default-light) selectors
 * @see active.injectable.ts - Returns ThemeType
 */
const setupApplyActiveThemeInjectable = getInjectable({
  id: "setup-apply-active-theme",
  instantiate: (di) => ({
    run: () => {
      const activeTheme = di.inject(activeThemeInjectable);

      /**
       * Apply theme by toggling HTML element classes
       *
       * - Uses HTML element (document.documentElement) instead of body
       * - Applies theme-default-dark or theme-default-light class
       * - These classes match selectors in global.css:
       *   :where(.theme-default-dark) { CSS variables for dark theme }
       *   :where(.theme-default-light) { CSS variables for light theme }
       * - Removes opposite theme class to ensure clean state
       */
      const applyTheme = (themeType: ThemeType) => {
        // Remove both theme classes first (clean slate)
        document.documentElement.classList.remove("theme-default-light", "theme-default-dark");

        // Add the appropriate theme class
        const themeClass = themeType === "light" ? "theme-default-light" : "theme-default-dark";
        document.documentElement.classList.add(themeClass);
      };

      reaction(() => activeTheme.get(), applyTheme, {
        fireImmediately: true,
      });
    },
    runAfter: [initializeSystemThemeTypeInjectable, initUserStoreInjectable],
  }),
  injectionToken: beforeFrameStartsSecondInjectionToken,
});

export default setupApplyActiveThemeInjectable;
