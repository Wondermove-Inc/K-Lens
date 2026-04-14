/**
 * 🎯 목적: WSL (Windows Subsystem for Linux) 서비스
 * 📝 기능:
 *   - WSL 설치 상태 확인
 *   - WSL 배포판 목록 조회
 * 🔄 변경이력:
 *   - 2026-02-03: WSL UX 개선 - 초기 구현
 * @module main/wsl/wsl-service
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { execSync } from "child_process";
import isWindowsInjectable from "../../common/vars/is-windows.injectable";

import type { WslDistrosResponse, WslStatusResponse } from "../../common/ipc/wsl";

export interface WslService {
  /** WSL 설치 상태 확인 */
  checkInstalled(): WslStatusResponse;
  /** WSL 배포판 목록 조회 */
  getDistributions(): Promise<WslDistrosResponse>;
}

const wslServiceInjectable = getInjectable({
  id: "wsl-service",

  instantiate: (di): WslService => {
    const logger = di.inject(loggerInjectionToken);
    const isWindows = di.inject(isWindowsInjectable);

    return {
      checkInstalled(): WslStatusResponse {
        if (!isWindows) {
          return { installed: false, error: "WSL is only available on Windows" };
        }

        try {
          // wsl --version 실행으로 WSL 설치 여부 확인
          execSync("wsl --version", {
            encoding: "utf-8",
            timeout: 5000,
            windowsHide: true,
          });

          return { installed: true };
        } catch (error) {
          logger.debug("[WSL-SERVICE]: WSL is not installed or not accessible", { error });

          return { installed: false };
        }
      },

      async getDistributions(): Promise<WslDistrosResponse> {
        if (!isWindows) {
          return {
            success: false,
            distros: [],
            error: "WSL is only available on Windows",
          };
        }

        try {
          // wsl -l -q 실행 (quiet 모드로 배포판 이름만 출력)
          // Windows WSL 출력은 UTF-16LE 인코딩을 사용
          const result = execSync("wsl -l -q", {
            encoding: "buffer",
            timeout: 10000,
            windowsHide: true,
          });

          // UTF-16LE 디코딩 및 null 문자 제거
          const text = result.toString("utf16le").replace(/\0/g, "").trim();
          const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

          if (lines.length === 0) {
            return {
              success: true,
              distros: [],
              error: "No WSL distributions installed",
            };
          }

          // wsl -l 실행 (기본 배포판 확인용)
          // 기본 배포판은 이름 뒤에 "(Default)"가 붙음
          const verboseResult = execSync("wsl -l", {
            encoding: "buffer",
            timeout: 10000,
            windowsHide: true,
          });

          const verboseText = verboseResult.toString("utf16le").replace(/\0/g, "").trim();
          const verboseLines = verboseText.split(/\r?\n/).filter((line) => line.trim() !== "");

          // "(Default)" 또는 "(기본값)" 등 찾기
          let defaultDistro: string | undefined;

          for (const line of verboseLines) {
            if (line.includes("(Default)") || line.includes("(기본값)")) {
              // "Ubuntu-22.04 (Default)" → "Ubuntu-22.04"
              const match = line.match(/^([^\s(]+)/);

              if (match) {
                defaultDistro = match[1].trim();
              }
              break;
            }
          }

          // 첫 번째 배포판을 기본값으로 설정 (Default 표시가 없는 경우)
          if (!defaultDistro && lines.length > 0) {
            defaultDistro = lines[0];
          }

          logger.debug("[WSL-SERVICE]: Retrieved WSL distributions", {
            distros: lines,
            defaultDistro,
          });

          return {
            success: true,
            distros: lines,
            defaultDistro,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          logger.error("[WSL-SERVICE]: Failed to get WSL distributions", { error: errorMessage });

          return {
            success: false,
            distros: [],
            error: `Failed to get WSL distributions: ${errorMessage}`,
          };
        }
      },
    };
  },
});

export default wslServiceInjectable;
