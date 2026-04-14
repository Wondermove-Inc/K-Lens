/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { MonacoTheme } from "../components/monaco-editor";

/**
 * 🎯 PHASE 4: Simplified Type System
 *
 * Theme type for the application
 * - "dark": Dark theme (default)
 * - "light": Light theme
 *
 * All color values are now defined in CSS variables (global.css)
 */
export type ThemeType = "dark" | "light";

/**
 * @deprecated Use ThemeType instead. LensThemeType is kept for backward compatibility.
 */
export type LensThemeType = ThemeType;

/**
 * @deprecated Theme ID is no longer used. Use ThemeType directly.
 */
export type ThemeId = string;

/**
 * @deprecated Simplified Lens theme interface (stub only)
 *
 * This interface is kept for backward compatibility with stub-themes.ts
 * All actual theming is now done via:
 * - CSS variables in global.css
 * - HTML class application (theme-default-dark / theme-default-light)
 *
 * Migration Complete:
 * - ✅ PHASE 1: Removed all theme injectable files
 * - ✅ PHASE 2: active.injectable.ts returns ThemeType only
 * - ✅ PHASE 3: All components migrated to CSS variables
 * - ✅ PHASE 4: Type definitions simplified (current)
 *
 * @see global.css - CSS variables for all theme colors
 * @see setup-apply-active-theme.injectable.ts - HTML class application
 */
export interface LensTheme {
  name: string;
  type: ThemeType;
  description: string;
  author: string;
  monacoTheme: MonacoTheme;
  isDefault?: boolean;
  /**
   * @deprecated Color values are now in CSS variables (global.css)
   * This field is kept as empty object for stub compatibility
   */
  colors: Record<string, string>;
}

/**
 * @deprecated Color names are now CSS variable names (global.css)
 * This type is no longer used in the codebase
 */
export type LensColorName = string;
