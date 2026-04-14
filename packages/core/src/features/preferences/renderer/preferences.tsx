/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Preferences 컴포넌트
 *
 * Route 접근 시 PreferencesDialog를 엽니다.
 * Dialog는 Sidebar에서 렌더링되므로 이 컴포넌트는 아무것도 렌더링하지 않습니다.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { useEffect } from "react";
import openPreferencesDialogInjectable from "./open-preferences-dialog.injectable";

import type { OpenPreferencesDialog } from "./open-preferences-dialog.injectable";

/**
 * 🎯 목적: Preferences Dependencies 인터페이스
 */
interface Dependencies {
  openDialog: OpenPreferencesDialog;
}

/**
 * 🎯 목적: Preferences 컴포넌트
 *
 * 컴포넌트 마운트 시 Dialog를 열고, 아무것도 렌더링하지 않습니다.
 * Dialog는 Sidebar에서 렌더링되며, 뒤 화면은 그대로 유지됩니다.
 */
const NonInjectedPreferences = observer(({ openDialog }: Dependencies) => {
  useEffect(() => {
    // 컴포넌트 마운트 시 Dialog 자동 열기
    openDialog();
  }, [openDialog]);

  // 아무것도 렌더링하지 않음 - Dialog는 Sidebar에서 렌더링됨
  return null;
});

/**
 * 🎯 목적: DI 패턴 적용된 Preferences export
 */
export const Preferences = withInjectables<Dependencies>(NonInjectedPreferences, {
  getProps: (di, props) => ({
    openDialog: di.inject(openPreferencesDialogInjectable),
    ...props,
  }),
});
