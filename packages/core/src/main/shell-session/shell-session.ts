/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { performance } from "node:perf_hooks";
import { getOrInsertWith } from "@skuberplus/utilities";
import os from "os";
import path from "path";
import { TerminalChannels, type TerminalMessage } from "../../common/terminal/channels";
import { clearKubeconfigEnvVars } from "../utils/clear-kube-env-vars";

import type { Logger } from "@skuberplus/logger";

import type { IComputedValue } from "mobx";
import type * as pty from "node-pty";
import type WebSocket from "ws";

import type { EmitAppEvent } from "../../common/app-event-bus/emit-event.injectable";
import type { Cluster } from "../../common/cluster/cluster";
import type { Stat } from "../../common/fs/stat.injectable";
import type { ComputeShellEnvironment } from "../../features/shell-sync/main/compute-shell-environment.injectable";
import type { Kubectl } from "../kubectl/kubectl";
import type { ShellSessionProcesses } from "./processes.injectable";
import type { ShellSessionEnvs } from "./shell-envs.injectable";
import type { SpawnPty } from "./spawn-pty.injectable";

export class ShellOpenError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(`${message}`, options);
    this.name = this.constructor.name;
    Error.captureStackTrace(this);
  }
}

export enum WebSocketCloseEvent {
  /**
   * The connection successfully completed the purpose for which it was created.
   */
  NormalClosure = 1000,
  /**
   * The endpoint is going away, either because of a server failure or because
   * the browser is navigating away from the page that opened the connection.
   */
  GoingAway = 1001,
  /**
   * The endpoint is terminating the connection due to a protocol error.
   */
  ProtocolError = 1002,
  /**
   * The connection is being terminated because the endpoint received data of a
   * type it cannot accept. (For example, a text-only endpoint received binary
   * data.)
   */
  UnsupportedData = 1003,
  /**
   * Indicates that no status code was provided even though one was expected.
   */
  NoStatusReceived = 1005,
  /**
   * Indicates that a connection was closed abnormally (that is, with no close
   * frame being sent) when a status code is expected.
   */
  AbnormalClosure = 1006,
  /**
   *  The endpoint is terminating the connection because a message was received
   * that contained inconsistent data (e.g., non-UTF-8 data within a text message).
   */
  InvalidFramePayloadData = 1007,
  /**
   * The endpoint is terminating the connection because it received a message
   * that violates its policy. This is a generic status code, used when codes
   * 1003 and 1009 are not suitable.
   */
  PolicyViolation = 1008,
  /**
   * The endpoint is terminating the connection because a data frame was
   * received that is too large.
   */
  MessageTooBig = 1009,
  /**
   * The client is terminating the connection because it expected the server to
   * negotiate one or more extension, but the server didn't.
   */
  MissingExtension = 1010,
  /**
   * The server is terminating the connection because it encountered an
   * unexpected condition that prevented it from fulfilling the request.
   */
  InternalError = 1011,
  /**
   * The server is terminating the connection because it is restarting.
   */
  ServiceRestart = 1012,
  /**
   * The server is terminating the connection due to a temporary condition,
   * e.g. it is overloaded and is casting off some of its clients.
   */
  TryAgainLater = 1013,
  /**
   * The server was acting as a gateway or proxy and received an invalid
   * response from the upstream server. This is similar to 502 HTTP Status Code.
   */
  BadGateway = 1014,
  /**
   * Indicates that the connection was closed due to a failure to perform a TLS
   * handshake (e.g., the server certificate can't be verified).
   */
  TlsHandshake = 1015,
}

export interface ShellSessionDependencies {
  readonly isWindows: boolean;
  readonly isMac: boolean;
  readonly defaultShell: string;
  readonly logger: Logger;
  readonly userShellSetting: IComputedValue<string | null>;
  readonly appName: string;
  readonly buildVersion: string;
  readonly proxyKubeconfigPath: string;
  readonly directoryContainingKubectl: string;
  readonly shellSessionEnvs: ShellSessionEnvs;
  readonly shellSessionProcesses: ShellSessionProcesses;
  computeShellEnvironment: ComputeShellEnvironment;
  spawnPty: SpawnPty;
  emitAppEvent: EmitAppEvent;
  stat: Stat;
}

export interface ShellSessionArgs {
  kubectl: Kubectl;
  websocket: WebSocket;
  cluster: Cluster;
  tabId: string;
}

export abstract class ShellSession {
  abstract readonly ShellType: string;

  protected running = false;
  protected readonly terminalId: string;
  protected readonly kubectl: Kubectl;
  protected readonly websocket: WebSocket;
  protected readonly cluster: Cluster;
  private static envPromises = new Map<string, Promise<Record<string, string | undefined>>>();
  private static envRefreshInFlight = new Map<string, Promise<void>>();

  public static clearEnvCache() {
    ShellSession.envPromises.clear();
    ShellSession.envRefreshInFlight.clear();
  }

  protected abstract get cwd(): string | undefined;

  protected ensureShellProcess(
    shell: string,
    args: string[],
    env: Partial<Record<string, string>>,
    cwd: string,
  ): { shellProcess: pty.IPty; resume: boolean } {
    const spawnStart = performance.now();
    const resume = this.dependencies.shellSessionProcesses.has(this.terminalId);
    const shellProcess = getOrInsertWith(this.dependencies.shellSessionProcesses, this.terminalId, () =>
      this.dependencies.spawnPty(shell, args, {
        rows: 30,
        cols: 80,
        cwd,
        env,
        name: "xterm-256color",
        // WSL requires ConPTY for proper stdin forwarding; other Windows shells use WinPTY
        useConpty: this.shouldUseConpty(shell),
      }),
    );

    this.dependencies.logger.info(
      `[SHELL-SESSION]: PTY for ${this.terminalId} is ${resume ? "resumed" : "started"} with PID=${shellProcess.pid}`,
    );
    this.dependencies.logger.info(`[TIMING-MAIN] spawnPty 완료`, {
      clusterId: this.cluster.id,
      terminalId: this.terminalId,
      durationMs: Math.round(performance.now() - spawnStart),
      resumed: resume,
    });

    return { shellProcess, resume };
  }

  protected shouldUseConpty(shell: string): boolean {
    if (!this.dependencies.isWindows) {
      return false;
    }

    const shellBasename = path
      .basename(shell)
      .replace(/\.exe$/i, "")
      .toLowerCase();

    return shellBasename === "wsl";
  }

  constructor(
    protected readonly dependencies: ShellSessionDependencies,
    { kubectl, websocket, cluster, tabId: terminalId }: ShellSessionArgs,
  ) {
    this.kubectl = kubectl;
    this.websocket = websocket;
    this.cluster = cluster;
    this.terminalId = `${cluster.id}:${terminalId}`;
  }

  protected send(message: TerminalMessage): void {
    this.websocket.send(JSON.stringify(message));
  }

  protected async getCwd(env: Record<string, string | undefined>): Promise<string> {
    const cwdOptions = [this.cwd];

    if (this.dependencies.isWindows) {
      cwdOptions.push(env.USERPROFILE, os.homedir(), "C:\\");
    } else {
      cwdOptions.push(env.HOME, os.homedir());

      if (this.dependencies.isMac) {
        cwdOptions.push("/Users");
      } else {
        cwdOptions.push("/home");
      }
    }

    for (const potentialCwd of cwdOptions) {
      if (!potentialCwd) {
        continue;
      }

      try {
        const stats = await this.dependencies.stat(potentialCwd);

        if (stats.isDirectory()) {
          return potentialCwd;
        }
      } catch {
        // ignore error
      }
    }

    return "."; // Always valid
  }

  protected async openShellProcess(shell: string, args: string[], env: Record<string, string | undefined>) {
    const cwdStart = performance.now();
    const cwd = await this.getCwd(env);
    this.dependencies.logger.info(`[TIMING-MAIN] getCwd 완료`, {
      clusterId: this.cluster.id,
      terminalId: this.terminalId,
      durationMs: Math.round(performance.now() - cwdStart),
    });

    const ensureStart = performance.now();
    const { shellProcess, resume } = this.ensureShellProcess(shell, args, env, cwd);
    this.dependencies.logger.info(`[TIMING-MAIN] ensureShellProcess 완료`, {
      clusterId: this.cluster.id,
      terminalId: this.terminalId,
      durationMs: Math.round(performance.now() - ensureStart),
      resumed: resume,
    });

    if (resume) {
      this.send({ type: TerminalChannels.CONNECTED });
    }

    this.running = true;
    shellProcess.onData((data) => this.send({ type: TerminalChannels.STDOUT, data }));
    shellProcess.onExit(({ exitCode }) => {
      this.dependencies.logger.info(
        `[SHELL-SESSION]: shell has exited for ${this.terminalId} closed with exitcode=${exitCode}`,
      );

      // This might already be false because of the kill() within the websocket.on("close") handler
      if (this.running) {
        this.running = false;

        this.send({
          type: TerminalChannels.STDOUT,
          data: `\n\x1b[0m\x1b[1m[Process exited with code ${exitCode}]`,
        });
      }
    });

    this.websocket
      .on("message", (rawData: unknown): void => {
        if (!this.running) {
          return void this.dependencies.logger.debug(
            `[SHELL-SESSION]: received message from ${this.terminalId}, but shellProcess isn't running`,
          );
        }

        if (!(rawData instanceof Buffer)) {
          return void this.dependencies.logger.error(`[SHELL-SESSION]: Received message non-buffer message.`, {
            rawData,
          });
        }

        const data = rawData.toString();

        try {
          const message: TerminalMessage = JSON.parse(data);

          switch (message.type) {
            case TerminalChannels.STDIN:
              shellProcess.write(message.data);
              break;
            case TerminalChannels.RESIZE:
              shellProcess.resize(message.data.width, message.data.height);
              break;
            case TerminalChannels.PING:
              this.dependencies.logger.silly(`[SHELL-SESSION]: ${this.terminalId} ping!`);
              break;
            default:
              this.dependencies.logger.warn(
                `[SHELL-SESSION]: unknown or unhandleable message type for ${this.terminalId}`,
                message,
              );
              break;
          }
        } catch (error) {
          this.dependencies.logger.error(`[SHELL-SESSION]: failed to handle message for ${this.terminalId}`, error);
        }
      })
      .once("close", (code) => {
        this.dependencies.logger.info(
          `[SHELL-SESSION]: websocket for ${this.terminalId} closed with code=${WebSocketCloseEvent[code]}(${code})`,
          { cluster: this.cluster.getMeta() },
        );

        const stopShellSession =
          this.running &&
          ((code !== WebSocketCloseEvent.AbnormalClosure && code !== WebSocketCloseEvent.GoingAway) ||
            this.cluster.disconnected.get());

        if (stopShellSession) {
          this.running = false;

          try {
            this.dependencies.logger.info(
              `[SHELL-SESSION]: Killing shell process (pid=${shellProcess.pid}) for ${this.terminalId}`,
            );
            shellProcess.kill();
            this.dependencies.shellSessionProcesses.delete(this.terminalId);
          } catch (error) {
            this.dependencies.logger.warn(
              `[SHELL-SESSION]: failed to kill shell process (pid=${shellProcess.pid}) for ${this.terminalId}`,
              error,
            );
          }
        }
      });

    this.dependencies.emitAppEvent({ name: this.ShellType, action: "open" });
  }

  protected getPathEntries(): string[] {
    return [];
  }

  protected async getCachedShellEnv() {
    const { id: clusterId } = this.cluster;

    const cachedEnv = this.dependencies.shellSessionEnvs.get(clusterId);

    if (cachedEnv) {
      this.dependencies.logger.info(`[TIMING-MAIN] getCachedShellEnv 캐시 HIT`, {
        clusterId,
        terminalId: this.terminalId,
      });

      if (!ShellSession.envRefreshInFlight.has(clusterId)) {
        const refreshStart = performance.now();
        const refreshPromise = this.getShellEnv()
          .then((shellEnv) => {
            this.dependencies.shellSessionEnvs.set(clusterId, shellEnv);
            ShellSession.envPromises.set(clusterId, Promise.resolve(shellEnv));
            this.dependencies.logger.info(`[TIMING-MAIN] getShellEnv 배경 갱신 완료`, {
              clusterId,
              terminalId: this.terminalId,
              durationMs: Math.round(performance.now() - refreshStart),
            });
          })
          .catch((error) => {
            this.dependencies.logger.warn("[SHELL-SESSION]: shell env refresh failed", {
              clusterId,
              error,
            });
            ShellSession.envPromises.delete(clusterId);
          })
          .finally(() => {
            ShellSession.envRefreshInFlight.delete(clusterId);
          });

        ShellSession.envRefreshInFlight.set(clusterId, refreshPromise);
      }

      return cachedEnv;
    }

    let envPromise = ShellSession.envPromises.get(clusterId);

    if (!envPromise) {
      const computeStart = performance.now();
      envPromise = this.getShellEnv()
        .then((shellEnv) => {
          this.dependencies.shellSessionEnvs.set(clusterId, shellEnv);
          ShellSession.envPromises.set(clusterId, Promise.resolve(shellEnv));
          this.dependencies.logger.info(`[TIMING-MAIN] getShellEnv 캐시 MISS 완료`, {
            clusterId,
            terminalId: this.terminalId,
            durationMs: Math.round(performance.now() - computeStart),
          });

          return shellEnv;
        })
        .catch((error) => {
          ShellSession.envPromises.delete(clusterId);
          this.dependencies.logger.error(`[TIMING-MAIN] getShellEnv 실패`, {
            clusterId,
            terminalId: this.terminalId,
            durationMs: Math.round(performance.now() - computeStart),
            error,
          });
          throw error;
        });

      ShellSession.envPromises.set(clusterId, envPromise);
      this.dependencies.logger.info(`[TIMING-MAIN] getCachedShellEnv 캐시 MISS`, {
        clusterId,
        terminalId: this.terminalId,
      });
    } else {
      this.dependencies.logger.info(`[TIMING-MAIN] getCachedShellEnv Promise HIT`, {
        clusterId,
        terminalId: this.terminalId,
      });
    }

    return envPromise;
  }

  protected async getShellEnv() {
    const shell = this.dependencies.userShellSetting.get() || this.dependencies.defaultShell;
    const result = await this.dependencies.computeShellEnvironment(shell);
    const rawEnv = (() => {
      if (result.callWasSuccessful) {
        return result.response ?? process.env;
      }

      return process.env;
    })();

    const env = clearKubeconfigEnvVars(JSON.parse(JSON.stringify(rawEnv)));
    const pathStr = [this.dependencies.directoryContainingKubectl, ...this.getPathEntries(), env.PATH].join(
      path.delimiter,
    );

    delete env.DEBUG; // don't pass DEBUG into shells

    if (this.dependencies.isWindows) {
      env.PTYSHELL = shell || "powershell.exe";
      env.PATH = pathStr;
      env.LENS_SESSION = "true";
      // WSL에서 kubectl PATH를 설정하기 위한 별도 변수
      // PATH 자체를 WSLENV로 전달하면 /etc/profile이 리셋하므로,
      // 별도 변수로 전달 후 WSL 셸 시작 시 PATH에 추가
      env.SKUBERPLUS_KUBECTL_DIR = this.dependencies.directoryContainingKubectl;
      env.SKUBERPLUS_BINARIES_DIR = [...this.getPathEntries()].join(path.delimiter);
      // WSLENV: Windows 환경변수를 WSL로 전달
      // - KUBECONFIG/up: 경로 변환 + Win→WSL 방향
      // - LENS_SESSION/u: Win→WSL 방향만
      // - SKUBERPLUS_KUBECTL_DIR/up: kubectl 디렉토리 경로 변환
      // - SKUBERPLUS_BINARIES_DIR/up: 바이너리 디렉토리 경로 변환
      env.WSLENV = [env.WSLENV, "KUBECONFIG/up:LENS_SESSION/u:SKUBERPLUS_KUBECTL_DIR/up:SKUBERPLUS_BINARIES_DIR/up"]
        .filter(Boolean)
        .join(":");
    } else if (shell !== undefined) {
      env.PTYSHELL = shell;
      env.PATH = pathStr;
    } else {
      env.PTYSHELL = ""; // blank runs the system default shell
    }

    if (path.basename(env.PTYSHELL) === "zsh") {
      env.OLD_ZDOTDIR = env.ZDOTDIR || env.HOME;
      env.ZDOTDIR = this.dependencies.directoryContainingKubectl;
      env.DISABLE_AUTO_UPDATE = "true";
    }

    env.PTYPID = process.pid.toString();
    env.KUBECONFIG = this.dependencies.proxyKubeconfigPath;
    env.TERM_PROGRAM = this.dependencies.appName;
    env.TERM_PROGRAM_VERSION = this.dependencies.buildVersion;

    if (this.cluster.preferences.httpsProxy) {
      env.HTTPS_PROXY = this.cluster.preferences.httpsProxy;
    }

    env.NO_PROXY = ["localhost", "127.0.0.1", env.NO_PROXY].filter(Boolean).join();

    // UTF-8 인코딩 보장 (LANG이 없거나 UTF-8이 아닌 경우 fallback)
    if (!env.LANG || !env.LANG.includes("UTF-8")) {
      env.LANG = "en_US.UTF-8";
    }
    if (!env.LC_CTYPE || !env.LC_CTYPE.includes("UTF-8")) {
      env.LC_CTYPE = "UTF-8";
    }

    return env;
  }

  protected exit(code = WebSocketCloseEvent.NormalClosure) {
    if (this.websocket.readyState == this.websocket.OPEN) {
      this.websocket.close(code);
    }
  }
}
