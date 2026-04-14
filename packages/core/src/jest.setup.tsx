/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import skuberplusFetch from "@skuberplus/node-fetch";
// glob은 자체 타입을 제공
import * as glob from "glob";
import { enableMapSet, setAutoFreeze } from "immer";
import { configure } from "mobx";
import path from "path";
import React from "react";
import { TextDecoder as TextDecoderNode, TextEncoder } from "util";

import "./test-utils/setup-shadcn-radix-mocks";

// 🎯 shadcn 컴포넌트는 테스트에서 Radix hook을 호출하면서 Invalid hook call을 유발하기 때문에
//    공통 mock을 선행 로드해 안전한 DOM stub으로 대체한다.

import type * as K8slensTooltip from "@skuberplus/tooltip";

declare global {
  interface InjectablePaths {
    paths: string[];
    globalOverridePaths: string[];
  }

  var injectablePaths: Record<"main" | "renderer", InjectablePaths>;
}

configure({
  // Needed because we want to use jest.spyOn()
  // ref https://github.com/mobxjs/mobx/issues/2784
  safeDescriptors: false,
  enforceActions: "never",
});

setAutoFreeze(false); // allow to merge mobx observables
enableMapSet(); // allow to merge maps and sets

// Mock __non_webpack_require__ for tests
globalThis.__non_webpack_require__ = jest.fn();

global.fail = ((error = "Test failed without explicit error") => {
  console.error(error);
}) as any;

process.on("unhandledRejection", (err: any) => {
  global.fail(err);
});

global.fetch = skuberplusFetch as unknown as typeof fetch;

global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
global.TextDecoder = TextDecoderNode as unknown as typeof TextDecoder;

global.ResizeObserver = class {
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
};

// 🎯 JSDOM에서 scrollIntoView가 지원되지 않으므로 mock 추가
if (typeof window !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = jest.fn();
}

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

// 🎯 Electron 모의 객체 (팩토리 함수 내부에서 완전히 정의)
jest.mock("electron", () => {
  const createMockIpcRenderer = () => {
    const mock: Record<string, jest.Mock | any> = {
      send: jest.fn(),
      invoke: jest.fn().mockResolvedValue({}),
      sendSync: jest.fn(),
      postMessage: jest.fn(),
      emit: jest.fn(),
      listenerCount: jest.fn().mockReturnValue(0),
      getMaxListeners: jest.fn().mockReturnValue(10),
      listeners: jest.fn().mockReturnValue([]),
      rawListeners: jest.fn().mockReturnValue([]),
      eventNames: jest.fn().mockReturnValue([]),
    };
    // 체이닝 지원 메서드들
    mock.on = jest.fn(() => mock);
    mock.once = jest.fn(() => mock);
    mock.off = jest.fn(() => mock);
    mock.removeListener = jest.fn(() => mock);
    mock.removeAllListeners = jest.fn(() => mock);
    mock.addListener = jest.fn(() => mock);
    mock.setMaxListeners = jest.fn(() => mock);
    mock.prependListener = jest.fn(() => mock);
    mock.prependOnceListener = jest.fn(() => mock);
    return mock;
  };

  return {
    __esModule: true,
    ipcRenderer: createMockIpcRenderer(),
    ipcMain: {
      on: jest.fn(),
      once: jest.fn(),
      handle: jest.fn(),
      handleOnce: jest.fn(),
      removeHandler: jest.fn(),
      removeListener: jest.fn(),
    },
    shell: {
      openExternal: jest.fn().mockResolvedValue(undefined),
      openPath: jest.fn().mockResolvedValue(""),
      showItemInFolder: jest.fn(),
    },
    clipboard: {
      writeText: jest.fn(),
      readText: jest.fn().mockReturnValue(""),
    },
    app: {
      getVersion: jest.fn().mockReturnValue("3.0.0"),
      getLocale: jest.fn().mockReturnValue("en"),
      getPath: jest.fn().mockReturnValue("tmp"),
      getName: jest.fn().mockReturnValue("DAIVE"),
      isReady: jest.fn().mockReturnValue(true),
      whenReady: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn(),
      on: jest.fn(),
    },
    dialog: {
      showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
      showSaveDialog: jest.fn().mockResolvedValue({ canceled: true, filePath: "" }),
      showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
      showErrorBox: jest.fn(),
    },
    BrowserWindow: Object.assign(
      jest.fn().mockImplementation(() => ({
        loadURL: jest.fn(),
        on: jest.fn(),
        webContents: { send: jest.fn(), on: jest.fn() },
      })),
      {
        getAllWindows: jest.fn().mockReturnValue([]),
        getFocusedWindow: jest.fn().mockReturnValue(null),
        fromWebContents: jest.fn().mockReturnValue(null),
        fromId: jest.fn().mockReturnValue(null),
      },
    ),
    nativeTheme: {
      shouldUseDarkColors: false,
      themeSource: "system",
      on: jest.fn(),
      once: jest.fn(),
    },
    safeStorage: {
      isEncryptionAvailable: jest.fn().mockReturnValue(true),
      encryptString: jest.fn((text: string) => Buffer.from(`encrypted:${text}`)),
      decryptString: jest.fn((buffer: Buffer) => buffer.toString().replace("encrypted:", "")),
    },
  };
});

// 🎯 ipc 모듈: getLegacyGlobalDiForExtensionApi() 의존 함수를 noop으로 대체
// 원인: getApplicationBuilder에서 main+renderer DI를 동시에 생성하면
//       legacyGlobalDis.size > 1 → "multiple containers" 에러 발생
// 범위: ipcMainHandle, ipcMainOn, ipcRendererOn, broadcastMessage 모두
//       getLegacyGlobalDiForExtensionApi()를 내부에서 호출함
// 참고: 개별 테스트에서 실제 IPC 동작이 필요하면 jest.requireActual로 복원 가능
jest.mock("./common/ipc/ipc", () => ({
  ...jest.requireActual("./common/ipc/ipc"),
  ipcMainHandle: jest.fn(),
  ipcMainOn: jest.fn(() => jest.fn()),
  ipcRendererOn: jest.fn(() => jest.fn()),
  broadcastMessage: jest.fn(),
}));

jest.mock("@hello-pangea/dnd");
jest.mock("./renderer/components/monaco-editor/monaco-editor");
jest.mock("@skuberplus/tooltip", () => ({
  ...jest.requireActual("@skuberplus/tooltip"),
  withTooltip: ((Target) =>
    ({ tooltip, tooltipOverrideDisabled, ...props }: any) => {
      if (tooltip) {
        const testId = props["data-testid"];

        return (
          <>
            <Target {...props} />
            <div data-testid={testId && `tooltip-content-for-${testId}`}>{tooltip.children || tooltip}</div>
          </>
        );
      }

      return <Target {...props} />;
    }) as typeof K8slensTooltip.withTooltip,
}));
jest.mock("monaco-editor");

const getInjectables = (environment: "renderer" | "main", filePathGlob: string) =>
  [
    ...glob.sync(`./{common,extensions,${environment},test-env}/**/${filePathGlob}`, {
      cwd: __dirname,
    }),

    ...glob.sync(`./features/**/{${environment},common}/**/${filePathGlob}`, {
      cwd: __dirname,
    }),
  ].map((x) => path.resolve(__dirname, x));

global.injectablePaths = {
  renderer: {
    globalOverridePaths: getInjectables("renderer", "*.global-override-for-injectable.{ts,tsx}"),
    paths: getInjectables("renderer", "*.injectable.{ts,tsx}"),
  },
  main: {
    globalOverridePaths: getInjectables("main", "*.global-override-for-injectable.{ts,tsx}"),
    paths: getInjectables("main", "*.injectable.{ts,tsx}"),
  },
};
