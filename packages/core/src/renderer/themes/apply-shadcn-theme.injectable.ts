/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import userPreferencesStateInjectable from "../../features/user-preferences/common/state.injectable";
import { DEFAULT_SHADCN_THEME_ID, SHADCN_THEMES } from "./shadcn-theme-types";
import { SHADCN_THEME_VARIABLES } from "./shadcn-theme-variables";

import type { ShadcnThemeId } from "./shadcn-theme-types";

/**
 * Function type for applying a shadcn theme.
 * Note: inline styles are used due to Tailwind CSS v4 build constraints.
 */
export type ApplyShadcnTheme = (themeId: ShadcnThemeId) => void;

/**
 * Injectable service that applies a shadcn theme to the document.
 * - Toggles HTML class + applies CSS variables as inline styles
 * - Persists theme selection in user preferences (auto-saved via MobX reaction)
 * - Falls back to default theme on error
 * Note: inline style approach added 2025-11-28 to work around Tailwind v4 CSS build issues.
 */
const applyShadcnThemeInjectable = getInjectable({
  id: "apply-shadcn-theme",
  instantiate: (di): ApplyShadcnTheme => {
    const logger = di.inject(loggerInjectionToken);
    const state = di.inject(userPreferencesStateInjectable);

    return (themeId) => {
      try {
        // Validate theme ID
        const theme = SHADCN_THEMES.find((t) => t.id === themeId);

        if (!theme) {
          logger.warn(`[SHADCN-THEME] Invalid theme ID: ${themeId}, falling back to default`);
          themeId = DEFAULT_SHADCN_THEME_ID;
        }

        const htmlElement = document.documentElement;

        // 1. Remove all existing theme classes
        const existingThemeClasses = Array.from(htmlElement.classList).filter((className) =>
          className.startsWith("theme-"),
        );

        for (const className of existingThemeClasses) {
          htmlElement.classList.remove(className);
        }

        // 2. Add new theme class (single class only)
        // Format: "theme-{color}-{mode}" (e.g. "theme-blue-dark")
        const colorThemeClass = `theme-${themeId}`;

        htmlElement.classList.add(colorThemeClass);

        // 3. Apply CSS variables as inline styles
        // Resolves Tailwind CSS v4 build-time variable merge/purge issues.
        const themeVariables = SHADCN_THEME_VARIABLES[themeId];

        if (themeVariables) {
          for (const [varName, value] of Object.entries(themeVariables)) {
            htmlElement.style.setProperty(varName, value);
          }

          logger.info(`[SHADCN-THEME] Applied ${Object.keys(themeVariables).length} CSS variables`);
        }

        // 4. Sync dark/light mode with Lens theme system
        //    Tailwind JIT requires the .dark class on <html> for dark: utilities to activate.
        const themeInfo = SHADCN_THEMES.find((t) => t.id === themeId);
        const isDark = themeInfo?.mode === "dark";

        if (isDark) {
          htmlElement.classList.add("dark");
        } else {
          htmlElement.classList.remove("dark");
        }

        if (themeInfo) {
          state.colorTheme = isDark ? "Dark" : "Light";
        }

        // 5. Persist theme selection (auto-saved to conf via MobX reaction)
        state.shadcnTheme = themeId;

        logger.info(`[SHADCN-THEME] Applied theme: ${themeId}`);
      } catch (error) {
        logger.error("[SHADCN-THEME] Failed to apply theme", error);

        // Fall back to default theme on error
        applyFallbackTheme(document.documentElement, state, DEFAULT_SHADCN_THEME_ID);
      }
    };
  },
  causesSideEffects: true,
});

/**
 * Applies the fallback theme when an error occurs during theme application.
 */
function applyFallbackTheme(
  htmlElement: HTMLElement,
  state: { shadcnTheme: ShadcnThemeId },
  fallbackThemeId: ShadcnThemeId,
): void {
  // Remove existing theme classes
  const existingThemeClasses = Array.from(htmlElement.classList).filter((className) => className.startsWith("theme-"));

  for (const className of existingThemeClasses) {
    htmlElement.classList.remove(className);
  }

  // Add fallback theme class + reset Tailwind dark mode
  htmlElement.classList.add(`theme-${fallbackThemeId}`);
  htmlElement.classList.remove("dark");

  // Apply fallback theme CSS variables
  const fallbackVariables = SHADCN_THEME_VARIABLES[fallbackThemeId];

  if (fallbackVariables) {
    for (const [varName, value] of Object.entries(fallbackVariables)) {
      htmlElement.style.setProperty(varName, value);
    }
  }

  state.shadcnTheme = fallbackThemeId;
}

export default applyShadcnThemeInjectable;
