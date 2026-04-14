/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { performance } from "node:perf_hooks";
import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import emitAppEventInjectable from "../../../common/app-event-bus/emit-event.injectable";
import directoryForBinariesInjectable from "../../../common/app-paths/directory-for-binaries/directory-for-binaries.injectable";
import statInjectable from "../../../common/fs/stat.injectable";
import { ipcMainHandle } from "../../../common/ipc";
import getBasenameOfPathInjectable from "../../../common/path/get-basename.injectable";
import getDirnameOfPathInjectable from "../../../common/path/get-dirname.injectable";
import joinPathsInjectable from "../../../common/path/join-paths.injectable";
import appNameInjectable from "../../../common/vars/app-name.injectable";
import defaultShellInjectable from "../../../common/vars/default-shell.injectable";
import isMacInjectable from "../../../common/vars/is-mac.injectable";
import isWindowsInjectable from "../../../common/vars/is-windows.injectable";
import getClusterByIdInjectable from "../../../features/cluster/storage/common/get-by-id.injectable";
import computeShellEnvironmentInjectable from "../../../features/shell-sync/main/compute-shell-environment.injectable";
import userShellSettingInjectable from "../../../features/user-preferences/common/shell-setting.injectable";
import userPreferencesStateInjectable from "../../../features/user-preferences/common/state.injectable";
import { buildVersionInitializable } from "../../../features/vars/build-version/common/token";
import kubeAuthProxyServerInjectable from "../../cluster/kube-auth-proxy-server.injectable";
import kubeconfigManagerInjectable from "../../kubeconfig-manager/kubeconfig-manager.injectable";
import createKubectlInjectable from "../../kubectl/create-kubectl.injectable";
import shellSessionProcessesInjectable from "../processes.injectable";
import modifyTerminalShellEnvInjectable from "../shell-env-modifier/modify-terminal-shell-env.injectable";
import shellSessionEnvsInjectable from "../shell-envs.injectable";
import spawnPtyInjectable from "../spawn-pty.injectable";
import { LocalShellSession } from "./local-shell-session";

import type WebSocket from "ws";

import type { Cluster } from "../../../common/cluster/cluster";
import type { LocalShellSessionDependencies } from "./local-shell-session";

export interface OpenLocalShellSessionArgs {
  websocket: WebSocket;
  cluster: Cluster;
  tabId: string;
}

export type OpenLocalShellSession = (args: OpenLocalShellSessionArgs) => Promise<void>;

/**
 * 🎯 kubectl.binDir() Promise 캐시
 *
 * Lock 경합 제거를 위해 kubectl.binDir() 호출 결과를 캐싱합니다.
 * 동일한 설정 조합에 대해 Promise를 재사용하여 중복 실행을 방지합니다.
 *
 * 📝 주의사항:
 * - Promise 자체를 캐싱하여 동시 호출 시에도 단일 실행 보장
 * - 에러 발생 또는 빈 문자열 반환 시 즉시 캐시에서 제거
 * - 앱 재시작 시 자동으로 캐시 클리어됨 (자연스러운 무효화)
 *
 * TODO: 설정 변경 시 캐시 무효화 구현
 * - state.downloadKubectlBinaries 변경 감지
 * - state.kubectlBinariesPath 변경 감지
 * - dependencies.directoryForBinaries 변경 감지
 *
 * 구현 방법:
 * - MobX reaction() 사용하여 설정 변경 감지
 * - 설정 변경 이벤트 리스너 등록
 * - 또는 invalidateKubectlCache() 함수 제공
 *
 * 🔄 변경이력: 2025-10-29 - Lock 경합 해결을 위한 Promise 캐싱 추가
 */
const kubectlBinDirCache = new Map<string, Promise<string>>();

/**
 * 🎯 kubectl.binDir() 캐시 키 생성
 *
 * 버전 및 모든 설정 값을 조합하여 고유한 캐시 키를 생성합니다.
 *
 * @param version - kubectl 버전 (cluster.version.get())
 * @param downloadBinaries - 바이너리 다운로드 설정
 * @param binariesPath - 사용자 지정 바이너리 경로
 * @param directoryForBinaries - 기본 바이너리 디렉토리
 * @returns JSON 직렬화된 캐시 키
 */
function getKubectlCacheKey(
  version: string,
  downloadBinaries: boolean,
  binariesPath: string | undefined,
  directoryForBinaries: string,
): string {
  return JSON.stringify({
    version,
    downloadBinaries,
    binariesPath,
    directoryForBinaries,
  });
}

let prewarmHandlerRegistered = false;

const openLocalShellSessionInjectable = getInjectable({
  id: "open-local-shell-session",

  instantiate: (di): OpenLocalShellSession => {
    const createKubectl = di.inject(createKubectlInjectable);
    const getClusterById = di.inject(getClusterByIdInjectable);
    const logger = di.inject(loggerInjectionToken);

    if (!prewarmHandlerRegistered) {
      ipcMainHandle("cluster:prewarm-kube-auth-proxy", async (_event, clusterId: string) => {
        const cluster = getClusterById(clusterId);

        if (!cluster) {
          logger.warn(`[TIMING-MAIN] 프록시 선기동 실패 - clusterId 없음`, { clusterId });

          return false;
        }

        const proxyServer = di.inject(kubeAuthProxyServerInjectable, cluster);
        const start = performance.now();

        await proxyServer.ensureRunning();

        logger.info(`[TIMING-MAIN] kube-auth-proxy 선기동 완료`, {
          clusterId: cluster.id,
          durationMs: Math.round(performance.now() - start),
        });

        return true;
      });

      prewarmHandlerRegistered = true;
    }

    const dependencies: Omit<LocalShellSessionDependencies, "proxyKubeconfigPath" | "directoryContainingKubectl"> = {
      directoryForBinaries: di.inject(directoryForBinariesInjectable),
      isMac: di.inject(isMacInjectable),
      isWindows: di.inject(isWindowsInjectable),
      defaultShell: di.inject(defaultShellInjectable),
      logger,
      state: di.inject(userPreferencesStateInjectable),
      userShellSetting: di.inject(userShellSettingInjectable),
      appName: di.inject(appNameInjectable),
      buildVersion: di.inject(buildVersionInitializable.stateToken),
      shellSessionEnvs: di.inject(shellSessionEnvsInjectable),
      shellSessionProcesses: di.inject(shellSessionProcessesInjectable),
      modifyTerminalShellEnv: di.inject(modifyTerminalShellEnvInjectable),
      emitAppEvent: di.inject(emitAppEventInjectable),
      getDirnameOfPath: di.inject(getDirnameOfPathInjectable),
      joinPaths: di.inject(joinPathsInjectable),
      getBasenameOfPath: di.inject(getBasenameOfPathInjectable),
      computeShellEnvironment: di.inject(computeShellEnvironmentInjectable),
      spawnPty: di.inject(spawnPtyInjectable),
      stat: di.inject(statInjectable),
    };

    return async (args) => {
      const totalStart = performance.now();
      let shellOpenSuccessful = false;

      const kubectl = createKubectl(args.cluster.version.get());
      const kubeconfigManager = di.inject(kubeconfigManagerInjectable, args.cluster);
      const ensurePathStart = performance.now();
      const proxyKubeconfigPath = await kubeconfigManager.ensurePath();

      dependencies.logger.info(`[TIMING-MAIN] kubeconfigManager.ensurePath 완료`, {
        clusterId: args.cluster.id,
        tabId: args.tabId,
        durationMs: Math.round(performance.now() - ensurePathStart),
      });

      // 🎯 kubectl.binDir() Promise 캐싱으로 Lock 경합 제거
      const cacheKey = getKubectlCacheKey(
        args.cluster.version.get(),
        dependencies.state.downloadKubectlBinaries,
        dependencies.state.kubectlBinariesPath,
        dependencies.directoryForBinaries,
      );

      let directoryPromise = kubectlBinDirCache.get(cacheKey);

      if (!directoryPromise) {
        dependencies.logger.info("[KUBECTL-CACHE] Cache miss, executing binDir()", { cacheKey });

        const binDirStart = performance.now();

        directoryPromise = kubectl
          .binDir()
          .then((dir) => {
            if (!dir) {
              kubectlBinDirCache.delete(cacheKey);
              throw new Error("kubectl.binDir() returned empty path");
            }
            dependencies.logger.info("[KUBECTL-CACHE] binDir() success, cached", {
              cacheKey,
              durationMs: Math.round(performance.now() - binDirStart),
            });

            return dir;
          })
          .catch((error) => {
            dependencies.logger.error("[KUBECTL-CACHE] binDir() failed, removing from cache", { cacheKey, error });
            kubectlBinDirCache.delete(cacheKey);
            throw error;
          });

        kubectlBinDirCache.set(cacheKey, directoryPromise);
      } else {
        dependencies.logger.info("[KUBECTL-CACHE] Cache hit, reusing promise", { cacheKey });
      }

      const directoryContainingKubectl = await directoryPromise;
      dependencies.logger.info(`[TIMING-MAIN] kubectl.binDir 완료`, {
        clusterId: args.cluster.id,
        tabId: args.tabId,
        cacheKey,
      });

      const session = new LocalShellSession(
        {
          ...dependencies,
          proxyKubeconfigPath,
          directoryContainingKubectl,
        },
        { kubectl, ...args },
      );

      try {
        const openStart = performance.now();

        await session.open();

        shellOpenSuccessful = true;

        dependencies.logger.info(`[TIMING-MAIN] LocalShellSession.open 완료`, {
          clusterId: args.cluster.id,
          tabId: args.tabId,
          durationMs: Math.round(performance.now() - openStart),
        });
      } finally {
        dependencies.logger.info(`[TIMING-MAIN] Shell 세션 전체 종료`, {
          clusterId: args.cluster.id,
          tabId: args.tabId,
          durationMs: Math.round(performance.now() - totalStart),
          success: shellOpenSuccessful,
        });
      }
    };
  },
});

export default openLocalShellSessionInjectable;
