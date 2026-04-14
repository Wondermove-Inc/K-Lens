import { applicationFeature, startApplicationInjectionToken } from "@skuberplus/application";
import {
  applicationFeatureForElectronMain,
  beforeAnythingInjectionToken,
  beforeElectronIsReadyInjectionToken,
} from "@skuberplus/application-for-electron-main";

// ============================================
// 🛡️ 글로벌 에러 핸들러 (앱 크래시 방지)
// ============================================
// ECONNRESET, ETIMEDOUT 등 네트워크 에러로 인한 앱 종료 방지
process.on("uncaughtException", (error: Error) => {
  const ignorableErrors = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE", "ENOTFOUND"];
  const isIgnorable = ignorableErrors.some(
    (code) => error.message?.includes(code) || (error as NodeJS.ErrnoException).code === code,
  );

  if (isIgnorable) {
    console.warn("[Main] 네트워크 에러 (무시됨):", error.message);
  } else {
    console.error("[Main] Uncaught Exception:", error);
  }
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[Main] Unhandled Rejection:", reason);
});

import { createContainer } from "@ogre-tools/injectable";
import { autoRegister } from "@ogre-tools/injectable-extension-for-auto-registration";
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
import Module from "module";
import path from "path";
// 🎯 AI Assistant Main Feature (Extension Host 패턴 - Main Process에서 Agent 실행)
import { aiAssistantMainFeature } from "../../../packages/core/src/features/ai-assistant/ai-assistant-main.feature";
import { registerFileSystemIpcHandlers } from "./file-system/file-system-ipc-handler";

// 📝 FIX-030: kubectl apply handler는 packages/core/src/main/kubectl/*.injectable.ts로 이동
// (getRequestChannelListenerInjectable 패턴 사용 - messaging feature를 통해 자동 등록됨)

const environment = "main";

if (process.env.NODE_ENV !== "production") {
  // 🎯 목적: 개발 모드에서 skuberplus 루트 경로를 AppPath/NODE_PATH에 주입해 renderer external 모듈 탐색 보장
  const skuberplusRootDir = process.cwd();

  try {
    app.setAppPath(skuberplusRootDir);
  } catch (error) {
    console.warn("[DEV-NODE-PATH] app.setAppPath 실패", error);
  }

  const desiredPaths = [skuberplusRootDir, path.join(skuberplusRootDir, "node_modules")];
  const currentNodePath = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  const mergedNodePath = Array.from(new Set([...desiredPaths, ...currentNodePath].filter(Boolean)));

  process.env.NODE_PATH = mergedNodePath.join(path.delimiter);
  const moduleConstructor = Module as unknown as { _initPaths?: () => void };
  moduleConstructor._initPaths?.();
}

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
    aiAssistantMainFeature, // 🎯 AI Assistant Main (Extension Host - Main에서 Agent 실행)
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

// 🎯 파일 시스템 IPC 핸들러 등록 (Text Editor 기능용)
registerFileSystemIpcHandlers();

// 📝 FIX-030: kubectl apply/delete/diff handler는 packages/core에서 messaging 패턴으로 자동 등록됨
// (packages/core/src/main/kubectl/*.injectable.ts)

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

export {
  Mobx,
  Pty,
} from "@skuberplus/core/main";

export const LensExtensions = {
  Main,
  Common,
};
