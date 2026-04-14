/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { performance } from "node:perf_hooks";
import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import defaultShellInjectable from "../../../common/vars/default-shell.injectable";
import isWindowsInjectable from "../../../common/vars/is-windows.injectable";
import computeUnixShellEnvironmentInjectable from "./compute-unix-shell-environment.injectable";

import type { AsyncResult } from "@skuberplus/utilities";

export type EnvironmentVariables = Partial<Record<string, string>>;
export type ComputeShellEnvironment = (shell?: string | null) => AsyncResult<EnvironmentVariables | undefined, string>;

type ShellEnvPromise = AsyncResult<EnvironmentVariables | undefined, string>;

const shellEnvPromiseCache = new Map<string, ShellEnvPromise>();

export const clearComputeShellEnvironmentCache = () => {
  shellEnvPromiseCache.clear();
};

const describeShell = (shell?: string | null) => {
  if (shell === undefined) return "undefined";
  if (shell === null) return "null";

  return `"${shell}"`;
};

const computeShellEnvironmentInjectable = getInjectable({
  id: "compute-shell-environment",
  instantiate: (di): ComputeShellEnvironment => {
    const logger = di.inject(loggerInjectionToken);
    const isWindows = di.inject(isWindowsInjectable);
    const computeUnixShellEnvironment = di.inject(computeUnixShellEnvironmentInjectable);
    const defaultShell = di.inject(defaultShellInjectable);

    const getCacheKey = (shell?: string | null) => {
      const resolved = shell ?? defaultShell ?? "";

      return `${isWindows ? "win" : "unix"}:${resolved}`;
    };

    if (isWindows) {
      return async (shell) => {
        const cacheKey = getCacheKey(shell);
        let promise = shellEnvPromiseCache.get(cacheKey);

        if (!promise) {
          logger.warn(`[COMPUTE-SHELL-ENV] 🔴 캐시 MISS - 새로 계산 시작 +0ms`, {
            shell: describeShell(shell),
            cacheKey,
            cacheSize: shellEnvPromiseCache.size,
            existingKeys: Array.from(shellEnvPromiseCache.keys()),
          });

          const newPromise: ShellEnvPromise = Promise.resolve({
            callWasSuccessful: true,
            response: undefined,
          });

          shellEnvPromiseCache.set(cacheKey, newPromise);
          promise = newPromise;
        } else {
          logger.info(`[COMPUTE-SHELL-ENV] ✅ 캐시 HIT - 기존 Promise 재사용 +0ms`, {
            shell: describeShell(shell),
            cacheKey,
            cacheSize: shellEnvPromiseCache.size,
          });
        }

        return promise;
      };
    }

    return async (shell) => {
      const cacheKey = getCacheKey(shell);
      let promise = shellEnvPromiseCache.get(cacheKey);

      if (!promise) {
        logger.warn(`[COMPUTE-SHELL-ENV] 🔴 캐시 MISS - 새로 계산 시작 +0ms`, {
          shell: describeShell(shell),
          cacheKey,
          cacheSize: shellEnvPromiseCache.size,
          existingKeys: Array.from(shellEnvPromiseCache.keys()),
        });

        const newPromise: ShellEnvPromise = (async () => {
          const controller = new AbortController();
          const timeoutHandle = setTimeout(() => controller.abort(), 30_000);
          const start = performance.now();

          try {
            const result = await computeUnixShellEnvironment(shell || defaultShell, { signal: controller.signal });

            clearTimeout(timeoutHandle);

            if (result.callWasSuccessful) {
              logger.info(
                `[COMPUTE-SHELL-ENV] ✅ 계산 완료 (캐시에 저장) +${Math.round(performance.now() - start)}ms`,
                {
                  shell: describeShell(shell),
                  cacheKey,
                },
              );

              return result;
            }

            shellEnvPromiseCache.delete(cacheKey);

            if (controller.signal.aborted) {
              logger.warn(`[COMPUTE-SHELL-ENV] ⚠️ 계산 중단 - 타임아웃 +${Math.round(performance.now() - start)}ms`, {
                shell: describeShell(shell),
                cacheKey,
              });

              return {
                callWasSuccessful: false as const,
                error: `Resolving shell environment is taking very long. Please review your shell configuration.`,
              };
            }

            logger.warn(
              `[COMPUTE-SHELL-ENV] ⚠️ 계산 실패 - 결과 캐시 안 함 +${Math.round(performance.now() - start)}ms`,
              {
                shell: describeShell(shell),
                cacheKey,
                error: result.error,
              },
            );

            return result;
          } catch (error) {
            clearTimeout(timeoutHandle);
            shellEnvPromiseCache.delete(cacheKey);

            logger.error(`[COMPUTE-SHELL-ENV] ❌ 계산 실패 +${Math.round(performance.now() - start)}ms`, {
              shell: describeShell(shell),
              cacheKey,
              error: error instanceof Error ? error.message : String(error),
            });

            return {
              callWasSuccessful: false as const,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })();

        shellEnvPromiseCache.set(cacheKey, newPromise);
        promise = newPromise;
      } else {
        logger.info(`[COMPUTE-SHELL-ENV] ✅ 캐시 HIT - 기존 Promise 재사용 +0ms`, {
          shell: describeShell(shell),
          cacheKey,
          cacheSize: shellEnvPromiseCache.size,
        });
      }

      return promise;
    };
  },
});

export default computeShellEnvironmentInjectable;
