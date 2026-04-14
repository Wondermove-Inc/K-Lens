/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import activeThemeInjectable from "./active.injectable";

import type { IComputedValue } from "mobx";

import type { ThemeType } from "./lens-theme";

export type ActiveThemeType = IComputedValue<ThemeType>;

/**
 * Simplified - activeTheme now returns ThemeType directly
 *
 * Since active.injectable.ts now returns ThemeType instead of LensTheme object,
 * this injectable is now a simple alias/passthrough.
 *
 * Previously: activeTheme.get().type (extracted type from object)
 * Now: activeTheme.get() (already returns type)
 */
const activeThemeTypeInjectable = getInjectable({
  id: "active-theme-type",

  instantiate: (di) => {
    const activeTheme = di.inject(activeThemeInjectable);

    // activeTheme.get() now returns ThemeType directly, no need to access .type
    return activeTheme;
  },
});

export default activeThemeTypeInjectable;
