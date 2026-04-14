/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Skuber+ Observability 화면 컴포넌트
 *
 * 주요 기능:
 * - 모니터링 대시보드
 * - 로그 분석
 * - 메트릭 시각화
 *
 * 📝 주의사항:
 * - MainLayout의 hideHotbar={true} 사용 (hotbar/sidebar 영역 제거)
 * - 전체 화면 레이아웃
 * - Observability URL은 package.json의 config.observabilityUrl에서 설정
 *
 * 🔄 변경이력:
 * - 2025-12-02: 초기 생성 (전체 화면 레이아웃)
 * - 2025-12-02: MainLayout hideHotbar prop 사용으로 변경
 * - 2025-12-02: URL을 Injectable로 주입받도록 변경 (하드코딩 제거)
 * - 2025-12-29: URL 미등록 시 등록 UI 추가 (Storybook 디자인 적용)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import openPreferencesDialogInjectable from "../../../features/preferences/renderer/open-preferences-dialog.injectable";
import userPreferencesStateInjectable from "../../../features/user-preferences/common/state.injectable";
import navigateToUrlInjectable from "../../routes/navigate-to-url.injectable";
// 🎯 이전 Explorer URL 복원용 (Observability 복귀 시 사용)
import previousExplorerUrlInjectable from "../../routes/previous-explorer-url.injectable";
// 🎯 이전 Observability URL 복원용 (Explorer에서 돌아올 때 사용)
import previousObservabilityUrlInjectable from "../../routes/previous-observability-url.injectable";
import { MainLayout } from "../layout/main-layout";
import { Hotbar } from "../shadcn-ui/hotbar";
// 🎯 Hotbar 아이템 injectable import
import hotbarItemsInjectable from "../shadcn-ui/hotbar-items.injectable";
import { ObservabilityIntro } from "./observability-intro";

import type { IComputedValue, IObservableValue } from "mobx";

import type { NavigateToUrl } from "../../../common/front-end-routing/navigate-to-url-injection-token";
import type { UserPreferencesState } from "../../../features/user-preferences/common/state.injectable";
import type { HotbarItem } from "../shadcn-ui/hotbar";

interface Dependencies {
  userPreferencesState: UserPreferencesState;
  openPreferencesDialog: () => void;
  navigateToUrl: NavigateToUrl;
  // 🎯 Hotbar 아이템 injectable (MobX computed)
  hotbarItems: IComputedValue<HotbarItem[]>;
  // 🎯 이전 Explorer URL (Observability에서 복귀 시 사용)
  previousExplorerUrl: IObservableValue<string | null>;
  // 🎯 이전 Observability URL (Explorer에서 돌아올 때 사용)
  previousObservabilityUrl: IObservableValue<string | null>;
}

/**
 * 🎯 목적: Skuber+ Observability 메인 컴포넌트
 *
 * 📝 주요 기능:
 * - Observability 웹뷰를 iframe으로 표시
 * - URL 미등록 시 등록 UI 표시 (Storybook 디자인)
 * - Hotbar만 표시 (sidebar 숨김)
 * - URL 소스: Settings > Extension에서 추가한 URL (userPreferencesState.extensionUrls[0])
 * - Hotbar 네비게이션: Explorer 클릭 시 /welcome 페이지로 이동
 */
const NonInjectedObservability = observer(
  ({
    userPreferencesState,
    openPreferencesDialog,
    navigateToUrl,
    hotbarItems,
    previousExplorerUrl,
    previousObservabilityUrl,
  }: Dependencies) => {
    // 🎯 webview ref (did-navigate 이벤트 리스닝용)
    const webviewRef = React.useRef<Electron.WebviewTag>(null);

    // 🎯 Extension URL이 있으면 사용, 없으면 소개 화면 표시
    const extensionUrl = userPreferencesState.extensionUrls?.[0];
    const displayUrl = extensionUrl;

    // 🎯 did-navigate 이벤트 리스너: webview URL 변경 시 자동 저장
    React.useEffect(() => {
      const webview = webviewRef.current;

      if (!webview || !displayUrl) return;

      /**
       * 🎯 목적: webview 내부 네비게이션 URL 추적
       * did-navigate: 메인 프레임 네비게이션
       * did-navigate-in-page: 앵커 링크 등 in-page 네비게이션
       */
      const handleNavigate = (event: Electron.DidNavigateEvent) => {
        previousObservabilityUrl.set(event.url);
      };

      // 🎯 dom-ready 이벤트 후에 리스너 등록 (webview가 준비된 후)
      const setupListeners = () => {
        webview.removeEventListener("did-navigate", handleNavigate);
        webview.removeEventListener("did-navigate-in-page", handleNavigate);
        webview.addEventListener("did-navigate", handleNavigate);
        webview.addEventListener("did-navigate-in-page", handleNavigate);
      };

      webview.addEventListener("dom-ready", setupListeners);

      return () => {
        webview.removeEventListener("dom-ready", setupListeners);
        webview.removeEventListener("did-navigate", handleNavigate);
        webview.removeEventListener("did-navigate-in-page", handleNavigate);
      };
    }, [displayUrl, previousObservabilityUrl]);

    // 🎯 Hotbar 아이템 클릭 핸들러
    const handleItemClick = React.useCallback(
      (itemId: string) => {
        if (itemId === "explorer") {
          // 🎯 저장된 이전 URL로 복귀, 없으면 /welcome으로 이동
          const savedUrl = previousExplorerUrl.get();
          navigateToUrl(savedUrl || "/welcome");
        }
      },
      [navigateToUrl, previousExplorerUrl],
    );

    // 🎯 URL이 없을 때는 MainLayout 사용 (sidebar는 null)
    if (!displayUrl) {
      return (
        <>
          <MainLayout
            hotbar={
              <Hotbar
                items={hotbarItems.get()}
                activeItem="skuber-observability"
                onItemClick={handleItemClick}
                onSettingsClick={openPreferencesDialog}
              />
            }
            sidebar={null}
          >
            <ObservabilityIntro />
          </MainLayout>
        </>
      );
    }

    // 🎯 URL이 있을 때는 MainLayout 사용하여 webview 표시
    return (
      <>
        <MainLayout
          hotbar={
            <Hotbar
              items={hotbarItems.get()}
              activeItem="skuber-observability"
              onItemClick={handleItemClick}
              onSettingsClick={openPreferencesDialog}
            />
          }
          sidebar={null}
        >
          <div className="flex h-full w-full bg-background">
            <webview
              ref={webviewRef}
              src={previousObservabilityUrl.get() || displayUrl}
              className="h-full border-0 absolute"
              style={{ left: "48px", width: "calc(100% - 48px)" }}
              partition="persist:observability"
            />
          </div>
        </MainLayout>
      </>
    );
  },
);

export const Observability = withInjectables<Dependencies>(NonInjectedObservability, {
  getProps: (di) => ({
    userPreferencesState: di.inject(userPreferencesStateInjectable),
    openPreferencesDialog: di.inject(openPreferencesDialogInjectable),
    navigateToUrl: di.inject(navigateToUrlInjectable),
    // 🎯 Hotbar 아이템 injectable 주입
    hotbarItems: di.inject(hotbarItemsInjectable),
    // 🎯 이전 Explorer URL (Observability에서 복귀 시 사용)
    previousExplorerUrl: di.inject(previousExplorerUrlInjectable),
    // 🎯 이전 Observability URL (Explorer에서 돌아올 때 사용)
    previousObservabilityUrl: di.inject(previousObservabilityUrlInjectable),
  }),
});
