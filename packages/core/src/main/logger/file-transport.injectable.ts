/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerTransportInjectionToken } from "@skuberplus/logger";
import { transports } from "winston";
import appPathsStateInjectable from "../../common/app-paths/app-paths-state.injectable";

// 🎯 Lazy Loading을 통한 App paths 초기화 순서 문제 해결
//
// 문제: winston logger가 인스턴스화될 때 di.injectMany()로 모든 transport를 즉시 인스턴스화하는데,
//       이때 app paths가 아직 설정되지 않아서 "Tried to get app paths before state is setupped" 에러 발생
//
// 해결: Transport를 Proxy로 래핑하여 실제 로그 메서드 호출 시점에 lazy하게 인스턴스화
//       - winston logger 생성 시점: Proxy 객체만 생성 (app paths 불필요)
//       - 실제 log 호출 시점: beforeAnything()가 이미 실행되어 app paths 설정 완료
const fileLoggerTransportInjectable = getInjectable({
  id: "file-logger-transport",
  instantiate: (di) => {
    let realTransport: transports.FileTransportInstance | null = null;

    // 실제 transport를 lazy하게 생성하는 함수
    const getOrCreateTransport = () => {
      if (!realTransport) {
        // appPathsState를 inject한 후 .get()을 호출하여 app paths 객체를 얻고, .logs 속성에 접근
        const appPathsState = di.inject(appPathsStateInjectable);
        const dirname = appPathsState.get().logs;

        realTransport = new transports.File({
          handleExceptions: false,
          level: "debug",
          filename: "lens.log",
          dirname,
          maxsize: 1024 * 1024,
          maxFiles: 16,
          tailable: true,
        });
      }
      return realTransport;
    };

    // Proxy를 사용하여 메서드 호출을 실제 transport로 전달
    return new Proxy({} as transports.FileTransportInstance, {
      get(_target, prop) {
        const transport = getOrCreateTransport();
        const value = (transport as any)[prop];

        // 함수인 경우 바인딩 유지
        if (typeof value === "function") {
          return value.bind(transport);
        }
        return value;
      },
      set(_target, prop, value) {
        const transport = getOrCreateTransport();
        (transport as any)[prop] = value;
        return true;
      },
    });
  },
  injectionToken: loggerTransportInjectionToken,
  decorable: false,
});

export default fileLoggerTransportInjectable;
