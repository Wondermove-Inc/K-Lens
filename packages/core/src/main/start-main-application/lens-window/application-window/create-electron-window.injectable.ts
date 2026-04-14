/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { applicationInformationToken } from "@skuberplus/application";
import { loggerInjectionToken } from "@skuberplus/logger";
import { BrowserWindow, screen } from "electron";
import pathExistsSyncInjectable from "../../../../common/fs/path-exists-sync.injectable";
import getAbsolutePathInjectable from "../../../../common/path/get-absolute-path.injectable";
import openLinkInBrowserInjectable from "../../../../common/utils/open-link-in-browser.injectable";
import isLinuxInjectable from "../../../../common/vars/is-linux.injectable";
import lensResourcesDirInjectable from "../../../../common/vars/lens-resources-dir.injectable";
import applicationWindowStateInjectable from "./application-window-state.injectable";
import sessionCertificateVerifierInjectable from "./session-certificate-verifier.injectable";

import type { RequireExactlyOne } from "type-fest";

import type { ElectronWindow } from "./create-lens-window.injectable";

export type ElectronWindowTitleBarStyle = "hiddenInset" | "hidden" | "default" | "customButtonsOnHover";

export interface FileSource {
  file: string;
}
export interface UrlSource {
  url: string;
}
export type ContentSource = RequireExactlyOne<FileSource & UrlSource>;

export interface ElectronWindowConfiguration {
  id: string;
  title: string;
  defaultHeight: number;
  defaultWidth: number;
  minWidth?: number;
  minHeight?: number;
  getContentSource: () => ContentSource;
  resizable: boolean;
  windowFrameUtilitiesAreShown: boolean;
  centered: boolean;
  titleBarStyle?: ElectronWindowTitleBarStyle;
  beforeOpen?: () => Promise<void>;
  onClose: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onDomReady?: () => void;
}

export type CreateElectronWindow = (config: ElectronWindowConfiguration) => ElectronWindow;

const createElectronWindowInjectable = getInjectable({
  id: "create-electron-window",

  instantiate: (di): CreateElectronWindow => {
    const logger = di.inject(loggerInjectionToken);
    const openLinkInBrowser = di.inject(openLinkInBrowserInjectable);
    const getAbsolutePath = di.inject(getAbsolutePathInjectable);
    const lensResourcesDir = di.inject(lensResourcesDirInjectable);
    const isLinux = di.inject(isLinuxInjectable);
    const applicationInformation = di.inject(applicationInformationToken);
    const pathExistsSync = di.inject(pathExistsSyncInjectable);
    const sessionCertificateVerifier = di.inject(sessionCertificateVerifierInjectable);

    return (configuration) => {
      const applicationWindowState = di.inject(applicationWindowStateInjectable, {
        id: configuration.id,
        defaultHeight: configuration.defaultHeight,
        defaultWidth: configuration.defaultWidth,
      });

      const { width, height, x, y } = applicationWindowState;
      const isSplashWindow = configuration.id === "splash";

      /**
       * 🎯 목적: 스플래시 창을 메인 앱창이 뜨는 모니터 중앙에 맞추기 위한 좌표 계산
       */
      const getSplashWindowPosition = () => {
        const mainWindowState = di.inject(applicationWindowStateInjectable, {
          id: "first-application-window",
          defaultHeight: 900,
          defaultWidth: 1440,
        });
        const mainBounds = {
          x: mainWindowState.x ?? 0,
          y: mainWindowState.y ?? 0,
          width: mainWindowState.width,
          height: mainWindowState.height,
        };
        const targetDisplay =
          Number.isFinite(mainWindowState.x) && Number.isFinite(mainWindowState.y)
            ? screen.getDisplayMatching(mainBounds)
            : screen.getPrimaryDisplay();
        const { x: areaX, y: areaY, width: areaWidth, height: areaHeight } = targetDisplay.workArea;

        // ⚠️ 스플래시 위치는 window-state의 x/y를 무시하고 모니터 중앙으로 강제 배치
        return {
          x: Math.round(areaX + (areaWidth - width) / 2),
          y: Math.round(areaY + (areaHeight - height) / 2),
        };
      };

      const splashWindowPosition = isSplashWindow ? getSplashWindowPosition() : undefined;
      const browserWindow = new BrowserWindow({
        x: splashWindowPosition?.x ?? x,
        y: splashWindowPosition?.y ?? y,
        width,
        height,
        title: configuration.title,
        resizable: configuration.resizable,
        center: isSplashWindow ? false : configuration.centered,
        frame: configuration.windowFrameUtilitiesAreShown,
        show: false,
        minWidth: configuration.minWidth ?? 700, // accommodate 800 x 600 display minimum
        minHeight: configuration.minHeight ?? 500, // accommodate 800 x 600 display minimum
        titleBarStyle: configuration.titleBarStyle,
        backgroundColor: "#1e2124",
        webPreferences: {
          // 🎯 최소화/숨김 시 Chromium 타이머 throttle 방지 (토큰 갱신 스케줄러 정상 동작 보장)
          backgroundThrottling: false,
          nodeIntegration: true,
          nodeIntegrationInSubFrames: true,
          contextIsolation: false,
          // 🎯 webSecurity: true (기본값)
          // - Ollama는 IPC를 통해 Main Process에서 fetch하므로 비활성화 불필요
          // 🎯 Ollama 등 로컬 서버 접근을 위해 webSecurity 비활성화
          webSecurity: false,
          // 🎯 webview 태그 활성화 (Extension iframe 로딩용)
          webviewTag: true,
          // 🎯 Mixed Content (HTTPS에서 HTTP 로드) 허용
          allowRunningInsecureContent: true,
          // 🎯 iframe 내부 리소스도 Mixed Content 허용
          enableBlinkFeatures: "AllowContentInitiatedDataUrlNavigations",
          // 🆕 외부 파일 드래그 시 파일 URL로 네비게이션 방지
          navigateOnDragDrop: false,
        },
      });

      if (isLinux) {
        const iconFileName = [
          getAbsolutePath(lensResourcesDir, `../${applicationInformation.name}.png`),
          `/usr/share/icons/hicolor/512x512/apps/${applicationInformation.name}.png`,
        ].find(pathExistsSync);

        if (iconFileName != null) {
          try {
            browserWindow.setIcon(iconFileName);
          } catch (err) {
            logger.warn(`Error while setting window icon ${err}`);
          }
        } else {
          logger.warn(`No suitable icon found for task bar.`);
        }
      }

      applicationWindowState.manage(browserWindow);

      browserWindow.webContents.session.setCertificateVerifyProc(sessionCertificateVerifier);

      // 🎯 목적: Extension URL iframe을 위한 CSP 및 Mixed Content 설정
      // - 모든 IP 주소 및 로컬 네트워크 URL 허용
      // - HTTP 리소스 로딩 허용 (Mixed Content)
      const session = browserWindow.webContents.session;

      // 🎯 HTTP 리소스 요청 허용 (Mixed Content 차단 우회)
      session.webRequest.onBeforeRequest((_details, callback) => {
        // HTTP 이미지/스크립트 요청을 차단하지 않고 통과
        callback({ cancel: false });
      });

      session.webRequest.onHeadersReceived((details, callback) => {
        const headers = details.responseHeaders || {};

        // 🎯 CSP 완전 제거 (Mixed Content 차단 방지)
        // - SignOz 같은 외부 iframe에서 HTTP 리소스 로딩을 막는 CSP 정책 제거
        delete headers["content-security-policy"];
        delete headers["content-security-policy-report-only"];

        // 🎯 X-Frame-Options 제거 (iframe 로딩 허용)
        delete headers["x-frame-options"];

        // 🎯 Mixed Content 허용 헤더 추가
        headers["Content-Security-Policy"] = ["upgrade-insecure-requests"];

        callback({ responseHeaders: headers });
      });

      browserWindow
        .on("focus", () => {
          configuration.onFocus?.();
        })
        .on("blur", () => {
          configuration.onBlur?.();
        })
        .on("closed", () => {
          configuration.onClose();
          applicationWindowState.unmanage();
        })
        .webContents.on("dom-ready", () => {
          configuration.onDomReady?.();
        })
        .on("did-fail-load", (_event, code, desc, validatedURL) => {
          // 🚨 창 로드 실패 시 상세 정보 로깅
          logger.error(`[CREATE-ELECTRON-WINDOW]: ❌ Failed to load window "${configuration.id}"`, {
            code,
            desc,
            url: validatedURL,
            windowId: configuration.id,
          });

          // 🔍 스플래시 창 로드 실패인 경우 추가 정보 출력
          if (configuration.id === "splash") {
            logger.error("[CREATE-ELECTRON-WINDOW]: 🚨 스플래시 창 로드 실패!");
            logger.error("[CREATE-ELECTRON-WINDOW]: 프로덕션 빌드에서 static 디렉토리가 패키징되었는지 확인하세요.");
            logger.error(`[CREATE-ELECTRON-WINDOW]: 시도한 URL: ${validatedURL}`);
          }
        })
        .on("did-finish-load", () => {
          logger.info(`[CREATE-ELECTRON-WINDOW]: ✅ Window "${configuration.id}" loaded successfully`);
        })
        .setWindowOpenHandler((details) => {
          openLinkInBrowser(details.url).catch((error) => {
            logger.error("[CREATE-ELECTRON-WINDOW]: failed to open browser", {
              error,
            });
          });

          return { action: "deny" };
        });

      return {
        loadFile: async (filePath) => {
          logger.info(
            `[CREATE-ELECTRON-WINDOW]: Loading content for window "${configuration.id}" from file: ${filePath}...`,
          );

          await browserWindow.loadFile(filePath);
        },

        loadUrl: async (url) => {
          logger.info(`[CREATE-ELECTRON-WINDOW]: Loading content for window "${configuration.id}" from url: ${url}...`);

          await browserWindow.loadURL(url);
        },

        show: () => browserWindow.show(),
        close: () => browserWindow.close(),
        send: ({ channel, data, frameInfo }) => {
          if (frameInfo) {
            browserWindow.webContents.sendToFrame([frameInfo.processId, frameInfo.frameId], channel, data);
          } else {
            browserWindow.webContents.send(channel, data);
          }
        },

        reload: () => {
          const wc = browserWindow.webContents;

          wc.reload();
          wc.navigationHistory.clear();
        },
      };
    };
  },

  causesSideEffects: true,
});

export default createElectronWindowInjectable;
