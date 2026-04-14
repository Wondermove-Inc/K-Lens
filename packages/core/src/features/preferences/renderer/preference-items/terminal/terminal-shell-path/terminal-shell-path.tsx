/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import defaultShellInjectable from "../../../../../../common/vars/default-shell.injectable";
import isWindowsInjectable from "../../../../../../common/vars/is-windows.injectable";
import { Input } from "../../../../../../renderer/components/input";
import { SubTitle } from "../../../../../../renderer/components/layout/sub-title";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";

import type { UserPreferencesState } from "../../../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
  defaultShell: string;
  isWindows: boolean;
}

const NonInjectedTerminalShellPath = observer(({ state, defaultShell, isWindows }: Dependencies) => {
  // Windows에서 WSL이 활성화된 경우 Shell Path 입력 필드 숨김
  // WSL 사용 시 wsl.exe가 자동으로 설정되므로 별도 입력 불필요
  if (isWindows && state.wslEnabled) {
    return null;
  }

  return (
    <section id="shell">
      <SubTitle title="Terminal Shell Path" />
      <Input
        theme="round-black"
        placeholder={defaultShell}
        value={state.shell ?? ""}
        onChange={(value) => (state.shell = value)}
      />
    </section>
  );
});

export const TerminalShellPath = withInjectables<Dependencies>(NonInjectedTerminalShellPath, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
    defaultShell: di.inject(defaultShellInjectable),
    isWindows: di.inject(isWindowsInjectable),
  }),
});
