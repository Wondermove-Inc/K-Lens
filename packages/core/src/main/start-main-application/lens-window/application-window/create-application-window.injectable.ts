/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { runInAction } from "mobx";
import emitAppEventInjectable from "../../../../common/app-event-bus/emit-event.injectable";
import appNameInjectable from "../../../../common/vars/app-name.injectable";
import isMacInjectable from "../../../../common/vars/is-mac.injectable";
import lensProxyPortInjectable from "../../../lens-proxy/lens-proxy-port.injectable";
import { applicationWindowInjectionToken } from "./application-window-injection-token";
import createLensWindowInjectable from "./create-lens-window.injectable";
import waitUntilBundledExtensionsAreLoadedInjectable from "./wait-until-bundled-extensions-are-loaded.injectable";

const createApplicationWindowInjectable = getInjectable({
  id: "create-application-window",

  instantiate: (parentDi) => (id: string) => {
    const windowInjectableId = `application-window-for-${id}`;

    // 🎯 이미 등록된 injectable이 있는지 체크 (중복 등록 방지)
    try {
      const existingWindows = parentDi.injectMany(applicationWindowInjectionToken);
      const existingWindow = existingWindows.find((w) => w.id === id);

      if (existingWindow) {
        // ✅ 이미 등록된 window가 있으면 재사용
        return existingWindow;
      }
    } catch {
      // 등록된 window가 없으면 계속 진행
    }

    const windowInjectable = getInjectable({
      id: windowInjectableId,

      instantiate: (di) => {
        const createLensWindow = di.inject(createLensWindowInjectable);
        const isMac = di.inject(isMacInjectable);
        const applicationName = di.inject(appNameInjectable);
        const waitUntilBundledExtensionsAreLoaded = di.inject(waitUntilBundledExtensionsAreLoadedInjectable);
        const lensProxyPort = di.inject(lensProxyPortInjectable);
        const emitAppEvent = di.inject(emitAppEventInjectable);

        return createLensWindow({
          id,
          title: applicationName,
          defaultHeight: 900,
          defaultWidth: 1440,
          getContentSource: () => ({
            url: `https://renderer.skuberplus.app:${lensProxyPort.get()}`,
          }),
          resizable: true,
          // 🎯 macOS에서는 frame을 표시하여 -webkit-app-region: drag가 동작하도록 함
          // Windows/Linux에서는 frameless로 설정
          windowFrameUtilitiesAreShown: isMac,
          titleBarStyle: isMac ? "hiddenInset" : "hidden",
          centered: false,
          onFocus: () => {
            emitAppEvent({ name: "app", action: "focus" });
          },
          onBlur: () => {
            emitAppEvent({ name: "app", action: "blur" });
          },
          onDomReady: () => {
            emitAppEvent({ name: "app", action: "dom-ready" });
          },

          onClose: () => {
            runInAction(() => {
              parentDi.deregister(windowInjectable);
            });
          },

          beforeOpen: waitUntilBundledExtensionsAreLoaded,
        });
      },

      injectionToken: applicationWindowInjectionToken,
    });

    runInAction(() => {
      parentDi.register(windowInjectable);
    });

    return parentDi.inject(windowInjectable);
  },
});

export default createApplicationWindowInjectable;
