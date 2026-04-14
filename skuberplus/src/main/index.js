import { createContainer } from "@ogre-tools/injectable";
import { autoRegister } from "@ogre-tools/injectable-extension-for-auto-registration";
import { applicationFeature, startApplicationInjectionToken } from "@skuberplus/application";
import {
  applicationFeatureForElectronMain,
  beforeAnythingInjectionToken,
  beforeElectronIsReadyInjectionToken,
} from "@skuberplus/application-for-electron-main";
import {
  commonExtensionApi as Common,
  mainExtensionApi as Main,
  registerLensCore,
  registerMobX,
} from "@skuberplus/core/main";
import { registerFeature } from "@skuberplus/feature-core";
import { kubeApiSpecificsFeature } from "@skuberplus/kube-api-specifics";
import { kubernetesMetricsServerFeature } from "@skuberplus/kubernetes-metrics-server";
import { loggerFeature } from "@skuberplus/logger";
import { messagingFeatureForMain } from "@skuberplus/messaging-for-main";
import { prometheusFeature } from "@skuberplus/prometheus";
import { randomFeature } from "@skuberplus/random";
import { runManySyncFor } from "@skuberplus/run-many";
import { app } from "electron";
import { runInAction } from "mobx";

const environment = "main";
const di = createContainer(environment, {
  detectCycles: false,
});
runInAction(() => {
  // 🎯 CRITICAL: registerMobX를 runInAction 안에서 호출해야 함 (Renderer 패턴과 동일)
  registerMobX(di);
  registerLensCore(di, environment);
  // 🎯 Renderer 패턴 따라 loggerFeature를 먼저 등록
  registerFeature(di, loggerFeature);
  registerFeature(
    di,
    applicationFeatureForElectronMain,
    applicationFeature,
    prometheusFeature,
    kubernetesMetricsServerFeature,
    messagingFeatureForMain,
    randomFeature,
    kubeApiSpecificsFeature,
  );
  // 🎯 Main process의 .injectable.ts 파일들을 자동 등록
  // registerFeature() 이후에 호출하여 MobX 충돌 방지 (Renderer 패턴과 동일)
  autoRegister({
    di,
    targetModule: module,
    getRequireContexts: () => [
      require.context("./", true, CONTEXT_MATCHER_FOR_NON_FEATURES),
      require.context("../common", true, CONTEXT_MATCHER_FOR_NON_FEATURES),
    ],
  });
});
// 🎯 중요: startApplication을 inject하기 전에 초기화 단계를 순서대로 실행
// 1. beforeAnything() - setup-app-paths가 포함되어 있어 앱 경로가 초기화됨
// 2. beforeElectronIsReady() - certificate 생성 등 Electron 준비 전 초기화
// 3. await app.whenReady() - Electron 앱이 완전히 준비될 때까지 대기 (Tray, Session 등 사용 가능)
const runManySync = runManySyncFor(di);
const beforeAnything = runManySync(beforeAnythingInjectionToken);
const beforeElectronIsReady = runManySync(beforeElectronIsReadyInjectionToken);
beforeAnything();
beforeElectronIsReady();
const startApplication = di.inject(startApplicationInjectionToken);
// 🎯 async 컨텍스트로 래핑하여 app.whenReady() 대기 후 startApplication 실행
// Electron app 모듈을 직접 사용하여 DI 복잡도 제거
(async () => {
  await app.whenReady();
  await startApplication();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

export { Mobx, Pty } from "@skuberplus/core/main";
export const LensExtensions = {
  Main,
  Common,
};
//# sourceMappingURL=index.js.map
