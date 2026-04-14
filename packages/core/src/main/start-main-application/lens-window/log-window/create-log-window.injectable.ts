/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { runInAction } from "mobx";
import lensProxyPortInjectable from "../../../lens-proxy/lens-proxy-port.injectable";
import createLensWindowInjectable from "../application-window/create-lens-window.injectable";
import { logWindowInjectionToken } from "./log-window-injection-token";

import type { LogWindowOpenPayload } from "../../../../common/ipc/log-window-channel";
import type { LensWindow } from "../application-window/create-lens-window.injectable";

export type CreateLogWindow = (payload: LogWindowOpenPayload) => LensWindow;

/**
 * 🎯 목적: 독립 로그 창을 동적으로 생성하는 injectable
 *
 * 📝 동작:
 * 1. LogWindowOpenPayload를 받아 새 BrowserWindow 생성
 * 2. /log-window?windowId=xxx URL로 로그 창 렌더러 로드
 * 3. dom-ready 시 초기 데이터(LogWindowInitData) 전송
 *
 * 🔄 사용:
 * - Dock의 Detach 버튼 클릭 시 IPC 핸들러에서 호출
 */
const createLogWindowInjectable = getInjectable({
  id: "create-log-window",

  instantiate:
    (parentDi) =>
    (payload: LogWindowOpenPayload): LensWindow => {
      const windowInjectableId = `log-window-for-${payload.windowId}`;

      // 🎯 이미 등록된 창이 있는지 체크 (중복 방지)
      try {
        const existingWindows = parentDi.injectMany(logWindowInjectionToken);
        const existingWindow = existingWindows.find((w) => w.id === payload.windowId);

        if (existingWindow) {
          return existingWindow;
        }
      } catch {
        // 등록된 창이 없으면 계속 진행
      }

      const windowInjectable = getInjectable({
        id: windowInjectableId,

        instantiate: (di) => {
          const createLensWindow = di.inject(createLensWindowInjectable);
          const lensProxyPort = di.inject(lensProxyPortInjectable);
          const proxyPort = lensProxyPort.get();

          const lensWindow = createLensWindow({
            id: payload.windowId,
            title: `Logs: ${payload.podName} / ${payload.container}`,
            defaultHeight: 600,
            defaultWidth: 1000,
            minWidth: 1000,
            getContentSource: () => ({
              // 클러스터 서브도메인을 사용하지 않음: clusterFrames Map 충돌 방지
              // (같은 clusterId로 두 번째 프레임 등록 시 부모 창의 프레임 등록을 덮어씀)
              // API 호출은 standalone-log-view-model에서 클러스터 서브도메인으로 직접 fetch
              url: `https://renderer.skuberplus.app:${proxyPort}/log-window?windowId=${payload.windowId}`,
            }),
            resizable: true,
            windowFrameUtilitiesAreShown: true,
            centered: true,
            titleBarStyle: "default",

            onClose: () => {
              runInAction(() => {
                parentDi.deregister(windowInjectable);
              });
            },
          });

          return lensWindow;
        },

        injectionToken: logWindowInjectionToken,
      });

      runInAction(() => {
        parentDi.register(windowInjectable);
      });

      return parentDi.inject(windowInjectable);
    },
});

export default createLogWindowInjectable;
