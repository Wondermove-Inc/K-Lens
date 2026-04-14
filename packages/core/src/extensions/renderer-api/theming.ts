/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { asLegacyGlobalForExtensionApi } from "@skuberplus/legacy-global-di";
import activeThemeInjectable from "../../renderer/themes/active.injectable";

import type { ThemeType } from "../../renderer/themes/lens-theme";

/**
 * 🎯 PHASE 3: activeTheme now returns ThemeType instead of LensTheme object
 *
 * Breaking Change for Extensions:
 * - Previously: activeTheme.get() returned LensTheme object with colors
 * - Now: activeTheme.get() returns ThemeType ("dark" | "light")
 *
 * Migration for Extensions:
 * - Before: const theme = activeTheme.get(); theme.type === "dark"
 * - After: const themeType = activeTheme.get(); themeType === "dark"
 *
 * @deprecated Extensions should use CSS variables from global.css instead of accessing theme colors
 */
export const activeTheme = asLegacyGlobalForExtensionApi(activeThemeInjectable);

/**
 * Get the active theme type
 *
 * @returns ThemeType ("dark" | "light")
 * @deprecated This hides the reactivity of active theme, use {@link activeTheme} instead
 */
export function getActiveTheme(): ThemeType {
  return activeTheme.get();
}

export type { ThemeType };
