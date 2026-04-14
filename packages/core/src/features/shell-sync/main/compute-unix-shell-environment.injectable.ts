/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { object } from "@skuberplus/utilities";
import getBasenameOfPathInjectable from "../../../common/path/get-basename.injectable";
import spawnInjectable from "../../../main/child-process/spawn.injectable";
import randomUUIDInjectable from "../../../main/crypto/random-uuid.injectable";
import processEnvInjectable from "./env.injectable";
import processExecPathInjectable from "./execPath.injectable";

import type { AsyncResult } from "@skuberplus/utilities";

import type { EnvironmentVariables } from "./compute-shell-environment.injectable";

export interface UnixShellEnvOptions {
  signal: AbortSignal;
}

export type ComputeUnixShellEnvironment = (
  shell: string,
  opts: UnixShellEnvOptions,
) => AsyncResult<EnvironmentVariables, string>;

/**
 * @param src The object containing the current environment variables
 * @param overrides The environment variables that want to be overridden before passing the env to a child process
 * @returns The combination of environment variables and a function which resets an object of environment variables to the values the keys corresponded to in `src` (rather than `overrides`)
 */
const getResetProcessEnv = (
  src: Partial<Record<string, string>>,
  overrides: Partial<Record<string, string>>,
): {
  resetEnvPairs: (target: Partial<Record<string, string>>) => void;
  env: Partial<Record<string, string>>;
} => {
  const originals = object.entries(overrides).map(([name]) => [name, src[name]] as const);

  return {
    env: {
      ...src,
      ...overrides,
    },
    resetEnvPairs: (target) => {
      for (const [name, originalValue] of originals) {
        if (typeof originalValue === "string") {
          target[name] = originalValue;
        } else {
          delete target[name];
        }
      }
    },
  };
};

const computeUnixShellEnvironmentInjectable = getInjectable({
  id: "compute-unix-shell-environment",
  instantiate: (di): ComputeUnixShellEnvironment => {
    const powerShellName = /^pwsh(-preview)?(\.exe)?$/i;
    const cshLikeShellName = /^(t?csh)(\.exe)?$/i;
    const fishLikeShellName = /^fish(\.exe)?$/i;

    const getBasenameOfPath = di.inject(getBasenameOfPathInjectable);
    const spawn = di.inject(spawnInjectable);
    const logger = di.inject(loggerInjectionToken);
    const randomUUID = di.inject(randomUUIDInjectable);
    const processExecPath = di.inject(processExecPathInjectable);
    const processEnv = di.inject(processEnvInjectable);

    const getShellSpecifics = (shellName: string) => {
      const mark = randomUUID().replace(/-/g, "");
      const regex = new RegExp(`${mark}(\\{.*\\})${mark}`);

      if (powerShellName.test(shellName)) {
        // Older versions of PowerShell removes double quotes sometimes so we use "double single quotes" which is how
        // you escape single quotes inside of a single quoted string.
        return {
          command: `Command '${processExecPath}' -e 'process.stdout.write(\\"${mark}\\" + JSON.stringify(process.env) + \\"${mark}\\")'`,
          shellArgs: ["-Login"],
          regex,
        };
      }

      let command = `'${processExecPath}' -e 'process.stdout.write("${mark}" + JSON.stringify(process.env) + "${mark}")'`;
      const shellArgs = ["-l"];

      if (fishLikeShellName.test(shellName)) {
        shellArgs.push("-c", command);
        command = "";
      } else if (!cshLikeShellName.test(shellName)) {
        // zsh (at least, maybe others) don't load RC files when in non-interactive mode, even when using -l (login) option
        shellArgs.push("-i");
        command = ` ${command}`; // This prevents the command from being added to the history
      } else {
        // Some shells don't support any other options when providing the -l (login) shell option
      }

      return { command, shellArgs, regex };
    };

    return async (shellPath, opts) => {
      const { resetEnvPairs, env } = getResetProcessEnv(processEnv, {
        ELECTRON_RUN_AS_NODE: "1",
        ELECTRON_NO_ATTACH_CONSOLE: "1",
        ITERM_SHELL_INTEGRATION_INSTALLED: "1", // ITerm2 shell integration breaks output
        TERM: "screen-256color-bce", // required for fish
        VSCODE_SHELL_INTEGRATION: "1", // VS Code shell integration breaks output
      });
      const shellName = getBasenameOfPath(shellPath);
      const { command, shellArgs, regex } = getShellSpecifics(shellName);

      logger.info(`[UNIX-SHELL-ENV]: running against ${shellPath}`, { command, shellArgs });

      return new Promise((resolve) => {
        const shellProcess = spawn(shellPath, shellArgs, {
          signal: opts.signal,
          detached: true,
          env,
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];

        const getErrorContext = (other: object = {}) => {
          const context = {
            ...other,
            stdout: Buffer.concat(stdout).toString("utf-8"),
            stderr: Buffer.concat(stderr).toString("utf-8"),
          };

          return JSON.stringify(context, null, 4);
        };

        shellProcess.stdout.on("data", (b) => stdout.push(b));
        shellProcess.stderr.on("data", (b) => stderr.push(b));

        shellProcess.on("error", (error) => {
          if (opts.signal.aborted) {
            resolve({
              callWasSuccessful: false,
              error: `timeout: ${getErrorContext()}`,
            });
          } else {
            resolve({
              callWasSuccessful: false,
              error: `Failed to spawn ${shellPath}: ${getErrorContext({ error: String(error) })}`,
            });
          }
        });
        shellProcess.on("close", (code, signal) => {
          if (code || signal) {
            return resolve({
              callWasSuccessful: false,
              error: `Shell did not exit successfully: ${getErrorContext({ code, signal })}`,
            });
          }

          try {
            const rawOutput = Buffer.concat(stdout).toString("utf-8");

            logger.silly(`[UNIX-SHELL-ENV]: got the following output`, { rawOutput });

            const matchedOutput = regex.exec(rawOutput)?.[1];

            if (!matchedOutput) {
              return resolve({
                callWasSuccessful: false,
                error: "Something has blocked the shell from producing the environment variables",
              });
            }

            const resolvedEnv = JSON.parse(matchedOutput) as Partial<Record<string, string>>;

            resetEnvPairs(resolvedEnv);
            resolve({
              callWasSuccessful: true,
              response: resolvedEnv,
            });
          } catch (err) {
            resolve({
              callWasSuccessful: false,
              error: String(err),
            });
          }
        });

        // 🎯 근본 해결: 'spawn' 이벤트 후 stdin 쓰기 (프로세스가 완전히 시작된 후)
        // 'spawn' 이벤트는 프로세스가 성공적으로 시작되고 stdin이 사용 가능할 때 발생
        shellProcess.on("spawn", () => {
          // 🛡️ 방어적 프로그래밍: stdin 에러 핸들링 (경쟁 상태 대비)
          shellProcess.stdin.on("error", (error) => {
            // EPIPE는 shell이 stdin을 읽기 전에 종료된 경우 발생 가능
            // (예: zsh가 .zshrc에서 에러를 만나 즉시 종료)
            if ((error as NodeJS.ErrnoException).code === "EPIPE") {
              logger.silly(`[UNIX-SHELL-ENV]: stdin closed before command was written (shell exited early)`);
            } else {
              logger.warn(`[UNIX-SHELL-ENV]: stdin error`, { error: String(error) });
            }
          });

          try {
            shellProcess.stdin.end(command);
          } catch (error) {
            // stdin.end()의 동기 에러 처리
            if ((error as NodeJS.ErrnoException).code === "EPIPE") {
              logger.silly(`[UNIX-SHELL-ENV]: Failed to write to stdin (shell exited early)`);
            } else {
              logger.warn(`[UNIX-SHELL-ENV]: Failed to write command to stdin`, { error: String(error) });
            }
          }
        });
      });
    };
  },
  causesSideEffects: true,
});

export default computeUnixShellEnvironmentInjectable;
