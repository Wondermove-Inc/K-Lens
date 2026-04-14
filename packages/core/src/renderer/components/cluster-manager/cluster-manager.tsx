/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./cluster-manager.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { buildURL } from "@skuberplus/utilities";
import { observer } from "mobx-react-lite";
import React from "react";
import { Redirect } from "react-router";
import welcomeRouteInjectable from "../../../common/front-end-routing/routes/welcome/welcome-route.injectable";
import closePreferencesDialogInjectable from "../../../features/preferences/renderer/close-preferences-dialog.injectable";
import preferencesDialogStateInjectable from "../../../features/preferences/renderer/preferences-dialog-state.injectable";
import watchForGeneralEntityNavigationInjectable from "../../api/helpers/watch-for-general-entity-navigation.injectable";
import currentPathInjectable from "../../routes/current-path.injectable";
import currentRouteComponentInjectable from "../../routes/current-route-component.injectable";
import { DeleteClusterDialog } from "../delete-cluster-dialog";
import { TopBar } from "../layout/top-bar/top-bar";
import { PreferencesDialog } from "../preferences-dialog/preferences-dialog";
import { StatusBar } from "../status-bar/status-bar";

import type { IComputedValue } from "mobx";

import type { PreferencesDialogState } from "../../../features/preferences/renderer/preferences-dialog-state.injectable";
import type { WatchForGeneralEntityNavigation } from "../../api/helpers/watch-for-general-entity-navigation.injectable";

interface Dependencies {
  currentRouteComponent: IComputedValue<React.ElementType | undefined>;
  welcomeUrl: string;
  watchForGeneralEntityNavigation: WatchForGeneralEntityNavigation;
  currentPath: IComputedValue<string>;
  preferencesDialogState: PreferencesDialogState; // 🎯 PreferencesDialog 상태
  closePreferencesDialog: () => void; // 🎯 PreferencesDialog 닫기 함수
}

const NonInjectedClusterManager = ({
  currentRouteComponent,
  currentPath,
  welcomeUrl,
  watchForGeneralEntityNavigation,
  preferencesDialogState,
  closePreferencesDialog,
}: Dependencies) => {
  React.useEffect(() => {
    const dispose = watchForGeneralEntityNavigation();

    return () => {
      dispose();
    };
  }, [watchForGeneralEntityNavigation]);

  const Component = currentRouteComponent.get();

  let content: React.ReactNode = null;

  if (Component) {
    content = <Component />;
  } else {
    const path = currentPath.get();

    content =
      path !== welcomeUrl ? (
        <Redirect exact to={welcomeUrl} />
      ) : (
        <div className="error">
          <h2>ERROR!!</h2>
          <p>
            No matching route for the current path: <code>{path}</code> which is the welcomeUrl. This is a bug.
          </p>
        </div>
      );
  }

  // 🎯 목적: TopBar 기반 레이아웃 (AI Chat Panel은 Cluster Frame으로 이동)
  return (
    <div className="ClusterManager">
      {/* 🎯 상단 TopBar - NavigationControls 포함 */}
      <TopBar />

      {/* 🎯 메인 콘텐츠 영역 */}
      <main>
        {/* 🎯 메인 레이아웃 wrapper */}
        <div className="main-layout-wrapper">
          {/* 🎯 ClusterFrameHandler가 iframe을 렌더링할 위치 (#lens-views 필수) */}
          <div id="lens-views" className="flex flex-row flex-1 overflow-hidden">
            {/* 🎯 메인 콘텐츠 (flex-1으로 남은 공간 차지) */}
            <div className="flex flex-1 overflow-hidden">{content}</div>
          </div>

          {/* ⚠️ AI Chat Panel은 Cluster Frame으로 이동 (ai-chat-panel-cluster-frame-child-component.injectable.tsx) */}
        </div>
      </main>

      {/* 🎯 하단 StatusBar */}
      <StatusBar />

      {/* 🎯 Modal */}
      <DeleteClusterDialog />

      {/* 🎯 PreferencesDialog 모달 */}
      <PreferencesDialog isOpen={preferencesDialogState.isOpen} onOpenChange={closePreferencesDialog} />
    </div>
  );
};

export const ClusterManager = withInjectables<Dependencies>(observer(NonInjectedClusterManager), {
  getProps: (di) => ({
    currentRouteComponent: di.inject(currentRouteComponentInjectable),
    welcomeUrl: buildURL(di.inject(welcomeRouteInjectable).path),
    watchForGeneralEntityNavigation: di.inject(watchForGeneralEntityNavigationInjectable),
    currentPath: di.inject(currentPathInjectable),
    preferencesDialogState: di.inject(preferencesDialogStateInjectable), // 🎯 PreferencesDialog 상태 주입
    closePreferencesDialog: di.inject(closePreferencesDialogInjectable), // 🎯 PreferencesDialog 닫기 함수 주입
  }),
});
