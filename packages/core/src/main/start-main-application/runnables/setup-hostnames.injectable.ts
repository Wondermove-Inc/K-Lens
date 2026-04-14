/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { beforeElectronIsReadyInjectionToken } from "@skuberplus/application-for-electron-main";
import electronAppInjectable from "../../electron-app/electron-app.injectable";

const setupHostnamesInjectable = getInjectable({
  id: "setup-hostnames",

  instantiate: (di) => ({
    run: () => {
      const app = di.inject(electronAppInjectable);

      app.commandLine.appendSwitch(
        "host-rules",
        [
          "MAP localhost 127.0.0.1",
          "MAP renderer.skuberplus.app 127.0.0.1",
          "MAP *.renderer.skuberplus.app 127.0.0.1",
        ].join(),
      );

      // 🎯 Mixed Content 허용: HTTPS 페이지에서 HTTP 리소스 로딩 가능
      // - Extension iframe의 HTTP 이미지/스타일시트 로딩 허용
      app.commandLine.appendSwitch("allow-running-insecure-content");

      // 🎯 Mixed Content 차단 완전 비활성화
      // - SignOz 같은 HTTP 서버의 리소스를 HTTPS 페이지에서 로드 가능하도록 설정
      // - Private Network Access(PNA) 차단 해제: 사설망(192.168.x.x 등)으로의 HTTP 서브리소스 요청 허용
      app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");

      return undefined;
    },
  }),

  injectionToken: beforeElectronIsReadyInjectionToken,
});

export default setupHostnamesInjectable;
