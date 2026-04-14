// 🎯 목적: CSS 로드 순서 - SkuberPlus 기존 스타일 먼저, shadcn globals.css 나중 (우선권 부여)
import "@skuberplus/core/styles";
import "@skuberplus/button/styles";
import "@skuberplus/error-boundary/styles";
import "@skuberplus/tooltip/styles";
import "@skuberplus/resizing-anchor/styles";
import "@skuberplus/icon/styles";
import "@skuberplus/animate/styles";
import "@skuberplus/notifications/styles";
import "@skuberplus/spinner/styles";
import "./shadcn-theme-overrides.css";
// 🎯 shadcn globals.css를 마지막에 로드하여 Tailwind 유틸리티 클래스가 우선권을 갖도록 설정
import "@skuberplus/core/globals.css";
// 🎯 목적: 기본 테마 클래스를 적용하여 globals.css 토큰이 활성화되도록 설정
// DOM이 완전히 로드된 후 실행되도록 보장
function applyDefaultTheme() {
  const htmlElement = document.documentElement;
  const hasAnyThemeClass = Array.from(htmlElement.classList).some((className) => className.startsWith("theme-"));

  // 🎯 목적: 초기 진입 시 테마 클래스가 전혀 없을 때만 기본 테마를 주입
  // ⚠️ 중요: 사용자 설정으로 적용된 테마를 DOMContentLoaded 훅이 다시 덮어쓰지 않도록 방지
  if (hasAnyThemeClass) {
    console.log("[THEME-INIT] Skip: theme-* class already present", htmlElement.classList.value);
    return;
  }

  const defaultThemeClasses = ["theme-default-dark", "theme-blue-dark"];
  console.log("[THEME-INIT] Applying default theme classes:", defaultThemeClasses);

  for (const themeClass of defaultThemeClasses) {
    htmlElement.classList.add(themeClass);
  }

  console.log("[THEME-INIT] Final classList:", htmlElement.classList.value);
}
// 즉시 실행 + DOMContentLoaded에서도 실행 (보험)
if (typeof document !== "undefined") {
  applyDefaultTheme();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyDefaultTheme);
  }
}

import { createContainer } from "@ogre-tools/injectable";
import { autoRegister } from "@ogre-tools/injectable-extension-for-auto-registration";
import { registerMobX } from "@ogre-tools/injectable-extension-for-mobx";
import { registerInjectableReact } from "@ogre-tools/injectable-react";
import { animateFeature } from "@skuberplus/animate";
import { applicationFeature, startApplicationInjectionToken } from "@skuberplus/application";
import { clusterSidebarFeature } from "@skuberplus/cluster-sidebar";
import {
  commonExtensionApi as Common,
  metricsFeature,
  rendererExtensionApi as Renderer,
  registerLensCore,
} from "@skuberplus/core/renderer";
import { registerFeature } from "@skuberplus/feature-core";
import { keyboardShortcutsFeature } from "@skuberplus/keyboard-shortcuts";
import { kubeApiSpecificsFeature } from "@skuberplus/kube-api-specifics";
import { kubernetesMetricsServerFeature } from "@skuberplus/kubernetes-metrics-server";
import { loggerFeature } from "@skuberplus/logger";
import { messagingFeatureForRenderer } from "@skuberplus/messaging-for-renderer";
import { notificationsFeature } from "@skuberplus/notifications";
import { randomFeature } from "@skuberplus/random";
import { reactApplicationFeature } from "@skuberplus/react-application";
import { routingFeature } from "@skuberplus/routing";
import { runInAction } from "mobx";

const environment = "renderer";
const di = createContainer(environment, {
  detectCycles: false,
});
// 🎯 목적: 디버깅 편의를 위해 renderer DI 컨테이너를 window에 노출한다.
// ⚠️ 중요: 문제 해결 후 반드시 제거할 것 (현재는 조사 목적)
globalThis.__rendererDi = di;
runInAction(() => {
  registerMobX(di);
  registerInjectableReact(di);
  registerLensCore(di, environment);
  registerFeature(di, loggerFeature);
  registerFeature(
    di,
    applicationFeature,
    messagingFeatureForRenderer,
    keyboardShortcutsFeature,
    reactApplicationFeature,
    routingFeature,
    metricsFeature,
    animateFeature,
    clusterSidebarFeature,
    randomFeature,
    kubeApiSpecificsFeature,
    kubernetesMetricsServerFeature,
    notificationsFeature,
  );
  autoRegister({
    di,
    targetModule: module,
    getRequireContexts: () => [
      require.context("./", true, CONTEXT_MATCHER_FOR_NON_FEATURES),
      require.context("../common", true, CONTEXT_MATCHER_FOR_NON_FEATURES),
    ],
  });
});
const startApplication = di.inject(startApplicationInjectionToken);
startApplication();

export {
  Mobx,
  MobxReact,
  React,
  ReactDOM,
  ReactJsxRuntime,
  ReactRouter,
  ReactRouterDom,
} from "@skuberplus/core/renderer";
export const LensExtensions = {
  Renderer,
  Common,
};
//# sourceMappingURL=index.js.map
