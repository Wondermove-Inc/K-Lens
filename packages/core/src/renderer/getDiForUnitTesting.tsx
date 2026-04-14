/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { createContainer, isInjectable } from "@ogre-tools/injectable";
import { registerMobX } from "@ogre-tools/injectable-extension-for-mobx";
import { registerInjectableReact } from "@ogre-tools/injectable-react";
import { animateFeature, requestAnimationFrameInjectable } from "@skuberplus/animate";
import { clusterSidebarFeature } from "@skuberplus/cluster-sidebar";
import { registerFeature } from "@skuberplus/feature-core";
import { kubeApiSpecificsFeature, storesAndApisCanBeCreatedInjectionToken } from "@skuberplus/kube-api-specifics";
import { setLegacyGlobalDiForExtensionApi } from "@skuberplus/legacy-global-di";
import { loggerFeature } from "@skuberplus/logger";
import { messagingFeature, testUtils as messagingTestUtils } from "@skuberplus/messaging";
import { notificationsFeature } from "@skuberplus/notifications";
import { randomFeature } from "@skuberplus/random";
import { routingFeature } from "@skuberplus/routing";
import { chunk, noop } from "lodash/fp";
import { runInAction } from "mobx";
// 🎯 클러스터 컨텍스트 관련 injectable 오버라이드용
import selectedNamespacesStorageInjectable from "../features/namespace-filtering/renderer/storage.injectable";
import userPreferencesStateInjectable from "../features/user-preferences/common/state.injectable";
import { getOverrideFsWithFakes } from "../test-utils/override-fs-with-fakes";
import clusterFrameContextForNamespacedResourcesInjectable from "./cluster-frame-context/for-namespaced-resources.injectable";
import hostedClusterIdInjectable from "./cluster-frame-context/hosted-cluster-id.injectable";
import terminalSpawningPoolInjectable from "./components/dock/terminal/terminal-spawning-pool.injectable";
import startTopbarStateSyncInjectable from "./components/layout/top-bar/start-state-sync.injectable";
import columnWidthStoreInjectable from "./components/table/column-width-store.injectable";
import webFrameInjectable from "./frames/cluster-frame/init-cluster-frame/frame-routing-id/web-frame/web-frame.injectable";
import initClusterFrameInjectable from "./frames/cluster-frame/init-cluster-frame/init-cluster-frame.injectable";
import legacyOnChannelListenInjectable from "./ipc/legacy-channel-listen.injectable";
import watchHistoryStateInjectable from "./remote-helpers/watch-history-state.injectable";
import currentlyInClusterFrameInjectable from "./routes/currently-in-cluster-frame.injectable";
import storesAndApisCanBeCreatedInjectable from "./stores-apis-can-be-created.injectable";
// 🎯 Electron injectable 오버라이드용
import ipcRendererInjectable from "./utils/channel/ipc-renderer.injectable";

import type { IpcRenderer, WebFrame } from "electron";

import type { GlobalOverride } from "../test-utils/get-global-override";

export const getDiForUnitTesting = () => {
  const environment = "renderer";
  const di = createContainer(environment, {
    detectCycles: false,
  });

  registerMobX(di);
  registerInjectableReact(di);
  setLegacyGlobalDiForExtensionApi(di, environment);

  di.permitSideEffects(storesAndApisCanBeCreatedInjectable);
  di.permitSideEffects(storesAndApisCanBeCreatedInjectionToken);

  runInAction(() => {
    registerFeature(
      di,
      messagingFeature,
      messagingTestUtils.messagingFeatureForUnitTesting,
      routingFeature,
      loggerFeature,
      animateFeature,
      clusterSidebarFeature,
      randomFeature,
      kubeApiSpecificsFeature,
      notificationsFeature,
    );
  });

  // ⚠️ 테스트: 스토어/Api 생성 부수효과가 필요하므로 차단하지 않습니다.

  runInAction(() => {
    const allInjectables = global.injectablePaths.renderer.paths
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

  for (const globalOverridePath of global.injectablePaths.renderer.globalOverridePaths) {
    const globalOverride = require(globalOverridePath).default as GlobalOverride<unknown, unknown, unknown>;

    di.override(globalOverride.injectable, globalOverride.overridingInstantiate);
  }

  [startTopbarStateSyncInjectable].forEach((injectable) => {
    di.override(injectable, () => ({
      id: injectable.id,
      run: () => {},
    }));
  });

  di.override(terminalSpawningPoolInjectable, () => document.createElement("div"));
  di.override(hostedClusterIdInjectable, () => undefined);

  di.override(legacyOnChannelListenInjectable, () => () => noop);

  di.override(requestAnimationFrameInjectable, () => (callback) => callback());
  di.override(watchHistoryStateInjectable, () => () => () => {});

  getOverrideFsWithFakes()(di);
  di.permitSideEffects(columnWidthStoreInjectable);
  di.override(storesAndApisCanBeCreatedInjectable, () => true);
  di.override(storesAndApisCanBeCreatedInjectionToken, () => true);

  // 🎯 Electron ipcRenderer 모의 객체 오버라이드
  const mockIpcRenderer = {
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    removeListener: jest.fn().mockReturnThis(),
    removeAllListeners: jest.fn().mockReturnThis(),
    addListener: jest.fn().mockReturnThis(),
    setMaxListeners: jest.fn().mockReturnThis(),
    getMaxListeners: jest.fn().mockReturnValue(10),
    listeners: jest.fn().mockReturnValue([]),
    rawListeners: jest.fn().mockReturnValue([]),
    emit: jest.fn().mockReturnValue(false),
    listenerCount: jest.fn().mockReturnValue(0),
    prependListener: jest.fn().mockReturnThis(),
    prependOnceListener: jest.fn().mockReturnThis(),
    eventNames: jest.fn().mockReturnValue([]),
    send: jest.fn(),
    invoke: jest.fn().mockResolvedValue(undefined),
    sendSync: jest.fn(),
    postMessage: jest.fn(),
    sendToHost: jest.fn(),
  } as unknown as IpcRenderer;

  di.override(ipcRendererInjectable, () => mockIpcRenderer);

  // 🎯 Electron webFrame 모의 객체 오버라이드
  const mockWebFrame = {
    setZoomFactor: jest.fn(),
    getZoomFactor: jest.fn().mockReturnValue(1),
    setZoomLevel: jest.fn(),
    getZoomLevel: jest.fn().mockReturnValue(0),
    setVisualZoomLevelLimits: jest.fn().mockResolvedValue(undefined),
    executeJavaScript: jest.fn().mockResolvedValue(undefined),
    executeJavaScriptInIsolatedWorld: jest.fn().mockResolvedValue(undefined),
    setIsolatedWorldInfo: jest.fn(),
    getResourceUsage: jest.fn().mockReturnValue({ images: { size: 0, liveSize: 0 } }),
    clearCache: jest.fn(),
    getFrameForSelector: jest.fn().mockReturnValue(null),
    findFrameByName: jest.fn().mockReturnValue(null),
    findFrameByRoutingId: jest.fn().mockReturnValue(null),
    isWordMisspelled: jest.fn().mockReturnValue(false),
    getWordSuggestions: jest.fn().mockReturnValue([]),
    insertText: jest.fn().mockResolvedValue(undefined),
    insertCSS: jest.fn().mockResolvedValue(""),
    removeInsertedCSS: jest.fn().mockResolvedValue(undefined),
    top: null,
    opener: null,
    parent: null,
    firstChild: null,
    nextSibling: null,
    routingId: 0,
  } as unknown as WebFrame;

  di.override(webFrameInjectable, () => mockWebFrame);

  // 🎯 selectedNamespacesStorage 모의 객체 오버라이드
  // hostedCluster가 없는 환경에서 assertion 에러 방지
  // 상태를 제대로 추적하는 mock 생성
  let mockStorageValue: string[] = [];
  const mockSelectedNamespacesStorage = {
    get: jest.fn(() => mockStorageValue),
    set: jest.fn((value: string[]) => {
      mockStorageValue = value;
    }),
    merge: jest.fn((value: string[]) => {
      mockStorageValue = value;
    }),
    reset: jest.fn(() => {
      mockStorageValue = [];
    }),
    toJSON: jest.fn(() => mockStorageValue),
    whenReady: Promise.resolve(),
  };
  di.override(selectedNamespacesStorageInjectable, () => mockSelectedNamespacesStorage as any);

  // 🎯 clusterFrameContextForNamespacedResources 모의 객체 오버라이드
  // hostedCluster가 없는 환경에서 assertion 에러 방지
  const mockClusterFrameContext = {
    isLoadingAll: () => false,
    isGlobalWatchEnabled: () => false,
    allNamespaces: [],
    contextNamespaces: [],
    hasSelectedAll: false,
  };
  di.override(clusterFrameContextForNamespacedResourcesInjectable, () => mockClusterFrameContext);

  // 🎯 initClusterFrame 비활성화 (함수 타입 반환)
  di.override(initClusterFrameInjectable, () => async () => {});

  // 🎯 currentlyInClusterFrame 오버라이드
  // process.isMainFrame이 Jest에서 정의되지 않을 수 있음
  di.override(currentlyInClusterFrameInjectable, () => false);

  // 🎯 userPreferencesState 기본값 설정
  // 빈 객체로 시작하면 colorTheme 등이 undefined → active theme에서 에러 발생
  const state = di.inject(userPreferencesStateInjectable);
  Object.assign(state, { colorTheme: "lens-dark" });

  return di;
};
