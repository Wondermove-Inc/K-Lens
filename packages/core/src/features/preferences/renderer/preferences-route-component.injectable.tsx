/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Preferences Route 컴포넌트
 *
 * /preferences route 접근 시 자동으로 PreferencesDialog를 엽니다.
 * Dialog가 닫히면 자동으로 이전 페이지로 돌아갑니다.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { useEffect } from "react";
import { routeSpecificComponentInjectionToken } from "../../../renderer/routes/route-specific-component-injection-token";
import preferencesRouteInjectable from "../common/preferences-route.injectable";
import closePreferencesInjectable from "./close-preferences/close-preferences.injectable";
import openPreferencesDialogInjectable from "./open-preferences-dialog.injectable";

import type { OpenPreferencesDialog } from "./open-preferences-dialog.injectable";

/**
 * 🎯 목적: Route 컴포넌트 Dependencies
 */
interface Dependencies {
  openDialog: OpenPreferencesDialog;
  closePreferences: () => void;
}

/**
 * 🎯 목적: Preferences Route 컴포넌트
 *
 * /preferences route에 접근하면 자동으로 Dialog를 열고,
 * Dialog가 닫히면 이전 페이지로 돌아갑니다.
 */
const NonInjectedPreferencesRoute = observer(({ openDialog, closePreferences }: Dependencies) => {
  useEffect(() => {
    // Route 마운트 시 Dialog 자동 열기
    openDialog();
  }, [openDialog]);

  // 아무것도 렌더링하지 않음 - Dialog는 Sidebar에서 렌더링됨
  // 뒤 화면은 그대로 유지되고 Dialog만 모달로 열림
  return null;
});

const PreferencesRoute = withInjectables<Dependencies>(NonInjectedPreferencesRoute, {
  getProps: (di, props) => ({
    openDialog: di.inject(openPreferencesDialogInjectable),
    closePreferences: di.inject(closePreferencesInjectable),
    ...props,
  }),
});

const preferencesRouteComponentInjectable = getInjectable({
  id: "preferences-route-component",

  instantiate: (di) => ({
    route: di.inject(preferencesRouteInjectable),
    Component: PreferencesRoute,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default preferencesRouteComponentInjectable;
