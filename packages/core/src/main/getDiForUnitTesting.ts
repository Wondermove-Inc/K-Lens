/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { createContainer, isInjectable } from "@ogre-tools/injectable";
import { registerMobX } from "@ogre-tools/injectable-extension-for-mobx";
import { registerFeature } from "@skuberplus/feature-core";
import { kubeApiSpecificsFeature } from "@skuberplus/kube-api-specifics";
import { setLegacyGlobalDiForExtensionApi } from "@skuberplus/legacy-global-di";
import { loggerFeature } from "@skuberplus/logger";
import { messagingFeature, testUtils as messagingTestUtils } from "@skuberplus/messaging";
import { notificationsFeature } from "@skuberplus/notifications";
import { randomFeature } from "@skuberplus/random";
import { chunk } from "lodash/fp";
import { runInAction } from "mobx";
import broadcastMessageInjectable from "../common/ipc/broadcast-message.injectable";
import setupSyncingOfWeblinksInjectable from "../features/weblinks/main/setup-syncing-of-weblinks.injectable";
import { getOverrideFsWithFakes } from "../test-utils/override-fs-with-fakes";
import spawnInjectable from "./child-process/spawn.injectable";
import initializeClusterManagerInjectable from "./cluster/initialize-manager.injectable";
// 🎯 AI Assistant 테스트용: Electron safeStorage mock
import electronSafeStorageInjectable from "./electron-app/electron-safe-storage.injectable";
import setupApplicationNameInjectable from "./electron-app/runnables/setup-application-name.injectable";
import setupDeepLinkingInjectable from "./electron-app/runnables/setup-deep-linking.injectable";
import setupDeviceShutdownInjectable from "./electron-app/runnables/setup-device-shutdown.injectable";
import setupIpcMainHandlersInjectable from "./electron-app/runnables/setup-ipc-main-handlers/setup-ipc-main-handlers.injectable";
import setupMainWindowVisibilityAfterActivationInjectable from "./electron-app/runnables/setup-main-window-visibility-after-activation.injectable";
import shellEnvCacheInvalidatorInjectable from "./shell-session/shell-env-cache-invalidator.injectable";
import waitUntilBundledExtensionsAreLoadedInjectable from "./start-main-application/lens-window/application-window/wait-until-bundled-extensions-are-loaded.injectable";
import setupLogWindowHandlersInjectable from "./start-main-application/lens-window/log-window/setup-log-window-handlers.injectable";
import initializeExtensionsInjectable from "./start-main-application/runnables/initialize-extensions.injectable";
import setupLensProxyInjectable from "./start-main-application/runnables/setup-lens-proxy.injectable";
import setupWslHandlersInjectable from "./wsl/setup-wsl-handlers.injectable";

import type { DiContainer } from "@ogre-tools/injectable";

import type { GlobalOverride } from "../test-utils/get-global-override";

export function getDiForUnitTesting() {
  const environment = "main";
  const di = createContainer(environment, {
    detectCycles: false,
  });

  registerMobX(di);
  setLegacyGlobalDiForExtensionApi(di, environment);

  runInAction(() => {
    registerFeature(
      di,
      messagingFeature,
      messagingTestUtils.messagingFeatureForUnitTesting,
      loggerFeature,
      randomFeature,
      kubeApiSpecificsFeature,
      notificationsFeature,
    );
  });

  di.preventSideEffects();

  runInAction(() => {
    const allInjectables = global.injectablePaths.main.paths
      .map((path) => require(path))
      .flatMap(Object.values)
      .filter(isInjectable);

    // named export + default export로 같은 객체가 두 번 포함되는 경우 제거 (참조 동일)
    const seen = new Set<unknown>();
    const injectables = allInjectables.filter((injectable) => {
      if (seen.has(injectable)) return false;
      seen.add(injectable);
      return true;
    });

    for (const block of chunk(100)(injectables)) {
      di.register(...block);
    }
  });

  for (const globalOverridePath of global.injectablePaths.main.globalOverridePaths) {
    const globalOverride = require(globalOverridePath).default as GlobalOverride<unknown, unknown, unknown>;

    di.override(globalOverride.injectable, globalOverride.overridingInstantiate);
  }

  di.override(waitUntilBundledExtensionsAreLoadedInjectable, () => async () => {});

  overrideRunnablesHavingSideEffects(di);
  overrideElectronFeatures(di);
  getOverrideFsWithFakes()(di);

  di.override(broadcastMessageInjectable, () => (channel) => {
    throw new Error(`Tried to broadcast message to channel "${channel}" over IPC without explicit override.`);
  });
  di.override(spawnInjectable, () => () => {
    return {
      stderr: { on: jest.fn(), removeAllListeners: jest.fn() },
      stdout: { on: jest.fn(), removeAllListeners: jest.fn() },
      on: jest.fn(),
    } as never;
  });

  return di;
}

// TODO: Reorganize code in Runnables to get rid of requirement for override
const overrideRunnablesHavingSideEffects = (di: DiContainer) => {
  [
    initializeExtensionsInjectable,
    initializeClusterManagerInjectable,
    setupIpcMainHandlersInjectable,
    setupLensProxyInjectable,
    setupSyncingOfWeblinksInjectable,
    setupWslHandlersInjectable,
    setupLogWindowHandlersInjectable,
    shellEnvCacheInvalidatorInjectable,
  ].forEach((injectable) => {
    di.override(injectable, () => ({
      id: injectable.id,
      run: () => {},
    }));
  });
};

const overrideElectronFeatures = (di: DiContainer) => {
  [
    setupMainWindowVisibilityAfterActivationInjectable,
    setupDeviceShutdownInjectable,
    setupDeepLinkingInjectable,
    setupApplicationNameInjectable,
  ].forEach((injectable) => {
    di.override(injectable, () => ({
      id: injectable.id,
      run: () => {},
    }));
  });

  // 🎯 AI Assistant 테스트용: Electron safeStorage mock
  di.override(electronSafeStorageInjectable, () => ({
    isEncryptionAvailable: () => true,
    encryptString: (plainText: string) => Buffer.from(`encrypted:${plainText}`),
    decryptString: (encrypted: Buffer) => encrypted.toString().replace("encrypted:", ""),
    getSelectedStorageBackend: () => "basic_text" as const,
    setUsePlainTextEncryption: () => {},
  }));
};
