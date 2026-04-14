/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeApplicationIsLoadingInjectionToken } from "@skuberplus/application";
import { ipcMainHandle } from "../../../../common/ipc";
import { LOG_WINDOW_OPEN_CHANNEL, LOG_WINDOW_REQUEST_INIT_CHANNEL } from "../../../../common/ipc/log-window-channel";
import lensProxyPortInjectable from "../../../lens-proxy/lens-proxy-port.injectable";
import createLogWindowInjectable from "./create-log-window.injectable";

import type { LogWindowOpenPayload } from "../../../../common/ipc/log-window-channel";

/**
 * 🎯 목적: 로그 창 관련 IPC 핸들러 등록
 *
 * 📝 동작:
 * 1. LOG_WINDOW_OPEN_CHANNEL 수신 시 새 로그 창 생성
 * 2. 창 생성 후 start() 호출하여 화면에 표시
 */
const setupLogWindowHandlersInjectable = getInjectable({
  id: "setup-log-window-handlers",

  instantiate: (di) => ({
    run: async () => {
      const createLogWindow = di.inject(createLogWindowInjectable);
      const lensProxyPort = di.inject(lensProxyPortInjectable);

      // 창별 payload 저장소 (Renderer가 요청 시 반환)
      const payloadStore = new Map<string, LogWindowOpenPayload>();

      ipcMainHandle(LOG_WINDOW_OPEN_CHANNEL, async (_event, payload: LogWindowOpenPayload) => {
        try {
          // payload 저장 (Renderer에서 request-init으로 가져감)
          payloadStore.set(payload.windowId, payload);

          const logWindow = createLogWindow(payload);

          await logWindow.start();

          return { success: true, windowId: payload.windowId };
        } catch (error) {
          console.error("[LogWindowHandler] Failed to create log window:", error);

          return { success: false, error: String(error) };
        }
      });

      // Renderer가 준비되면 초기 데이터 요청
      ipcMainHandle(LOG_WINDOW_REQUEST_INIT_CHANNEL, async (_event, windowId: string) => {
        const payload = payloadStore.get(windowId);

        if (!payload) {
          console.error("[LogWindowHandler] No payload found for windowId:", windowId);

          return null;
        }

        const proxyPort = lensProxyPort.get();

        // 반환 후 정리
        payloadStore.delete(windowId);

        return { ...payload, proxyPort };
      });
    },
  }),

  injectionToken: beforeApplicationIsLoadingInjectionToken,
});

export default setupLogWindowHandlersInjectable;
