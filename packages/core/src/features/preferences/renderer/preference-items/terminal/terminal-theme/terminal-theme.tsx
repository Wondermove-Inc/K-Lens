/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import { SubTitle } from "../../../../../../renderer/components/layout/sub-title";
import { Select } from "../../../../../../renderer/components/select";
import { availableThemes } from "../../../../../../renderer/themes/stub-themes";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";

import type { UserPreferencesState } from "../../../../../user-preferences/common/state.injectable";

/**
 * 🎯 Updated to use stub themes
 * - Removed lensThemeDeclarationInjectionToken import
 * - Now uses availableThemes from stub-themes.ts
 */

interface Dependencies {
  state: UserPreferencesState;
}

const NonInjectedTerminalTheme = observer(({ state }: Dependencies) => {
  const themeOptions = [
    {
      value: "", // TODO: replace with a sentinel value that isn't string (and serialize it differently)
      label: "Match SkuberPlus Theme",
    },
    ...availableThemes.map((theme) => ({
      value: theme.name,
      label: theme.name,
    })),
  ];

  return (
    <section id="terminalTheme">
      <SubTitle title="Terminal theme" />
      <Select
        id="terminal-theme-input"
        themeName="lens"
        options={themeOptions}
        value={state.terminalTheme}
        onChange={(option) => (state.terminalTheme = option?.value ?? "")}
      />
    </section>
  );
});

export const TerminalTheme = withInjectables<Dependencies>(NonInjectedTerminalTheme, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
  }),
});
