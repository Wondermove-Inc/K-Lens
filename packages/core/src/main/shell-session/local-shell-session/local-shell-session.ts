/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { performance } from "node:perf_hooks";
import { ShellSession } from "../shell-session";

import type { GetBasenameOfPath } from "../../../common/path/get-basename.injectable";
import type { GetDirnameOfPath } from "../../../common/path/get-dirname.injectable";
import type { JoinPaths } from "../../../common/path/join-paths.injectable";
import type { UserPreferencesState } from "../../../features/user-preferences/common/state.injectable";
import type { ModifyTerminalShellEnv } from "../shell-env-modifier/modify-terminal-shell-env.injectable";
import type { ShellSessionArgs, ShellSessionDependencies } from "../shell-session";

export interface LocalShellSessionDependencies extends ShellSessionDependencies {
  readonly directoryForBinaries: string;
  readonly state: UserPreferencesState;
  modifyTerminalShellEnv: ModifyTerminalShellEnv;
  joinPaths: JoinPaths;
  getDirnameOfPath: GetDirnameOfPath;
  getBasenameOfPath: GetBasenameOfPath;
}

export class LocalShellSession extends ShellSession {
  ShellType = "shell";

  constructor(
    protected readonly dependencies: LocalShellSessionDependencies,
    args: ShellSessionArgs,
  ) {
    super(dependencies, args);
  }

  protected getPathEntries(): string[] {
    return [this.dependencies.directoryForBinaries];
  }

  protected get cwd(): string | undefined {
    return this.cluster.preferences?.terminalCWD;
  }

  public async open() {
    const totalStart = performance.now();

    // extensions can modify the env
    const envStart = performance.now();
    const env = this.dependencies.modifyTerminalShellEnv(this.cluster.id, await this.getCachedShellEnv());
    this.dependencies.logger.info(`[TIMING-MAIN] getCachedShellEnv 완료`, {
      clusterId: this.cluster.id,
      terminalId: this.terminalId,
      durationMs: Math.round(performance.now() - envStart),
    });

    const shell = env.PTYSHELL;

    if (!shell) {
      throw new Error("PTYSHELL is not defined with the environment");
    }

    const shellArgsStart = performance.now();
    const args = await this.getShellArgs(shell);
    this.dependencies.logger.info(`[TIMING-MAIN] getShellArgs 완료`, {
      clusterId: this.cluster.id,
      terminalId: this.terminalId,
      durationMs: Math.round(performance.now() - shellArgsStart),
    });

    const openProcessStart = performance.now();
    await this.openShellProcess(shell, args, env);
    this.dependencies.logger.info(`[TIMING-MAIN] openShellProcess 완료`, {
      clusterId: this.cluster.id,
      terminalId: this.terminalId,
      durationMs: Math.round(performance.now() - openProcessStart),
    });

    this.dependencies.logger.info(`[TIMING-MAIN] LocalShellSession.open 내부 완료`, {
      clusterId: this.cluster.id,
      terminalId: this.terminalId,
      durationMs: Math.round(performance.now() - totalStart),
    });
  }

  protected async getShellArgs(shell: string): Promise<string[]> {
    const pathFromPreferences = this.dependencies.state.kubectlBinariesPath || this.kubectl.getBundledPath();
    const kubectlPathDir = this.dependencies.state.downloadKubectlBinaries
      ? this.dependencies.directoryContainingKubectl
      : this.dependencies.getDirnameOfPath(pathFromPreferences);

    const shellName = this.dependencies
      .getBasenameOfPath(shell)
      .replace(/\.exe$/i, "")
      .toLowerCase();

    switch (shellName) {
      case "powershell":
        return [
          "-NoExit",
          "-command",
          `& {$Env:PATH="${kubectlPathDir};${this.dependencies.directoryForBinaries};$Env:PATH"}`,
        ];
      case "bash":
        return [
          "--init-file",
          this.dependencies.joinPaths(this.dependencies.directoryContainingKubectl, ".bash_set_path"),
        ];
      case "fish":
        return [
          "--login",
          "--init-command",
          `export PATH="${kubectlPathDir}:${this.dependencies.directoryForBinaries}:$PATH"; export KUBECONFIG="${await this.dependencies.proxyKubeconfigPath}"`,
        ];
      case "zsh":
        return ["--login"];
      case "wsl": {
        // WSL에서 kubectl을 사용하기 위해 PATH에 kubectl/binaries 디렉토리 추가
        // 전략: WSLENV로 전달된 SKUBERPLUS_KUBECTL_DIR, SKUBERPLUS_BINARIES_DIR 변수를
        // bash -c에서 PATH에 추가한 후 exec bash로 인터랙티브 셸 시작
        // (PATH를 직접 WSLENV로 전달하면 /etc/profile이 리셋하므로 별도 변수 사용)
        const wslArgs: string[] = [];

        const wslDistribution = this.dependencies.state.wslDistribution;

        if (wslDistribution) {
          wslArgs.push("-d", wslDistribution);
        }

        // -e: 기본 셸 래퍼 없이 직접 실행 (WSL init/appendWindowsPath는 정상 동작)
        // bash -c: .exe 심링크 생성 → PATH 구성 → exec bash로 인터랙티브 셸 교체
        // WSL의 bash는 .exe 확장자를 자동으로 붙이지 않으므로,
        // /tmp에 확장자 없는 심링크를 만들어 kubectl 등의 명령어를 바로 사용 가능하게 함
        const initCmd = [
          "_SKB_BIN=$(mktemp -d)",
          'for f in "$SKUBERPLUS_KUBECTL_DIR"/*.exe "$SKUBERPLUS_BINARIES_DIR"/*.exe; do [ -f "$f" ] && ln -sf "$f" "$_SKB_BIN/$(basename "${f%.exe}")" 2>/dev/null; done',
          'export PATH="$_SKB_BIN:$SKUBERPLUS_KUBECTL_DIR:$SKUBERPLUS_BINARIES_DIR:$PATH"',
          "exec bash",
        ].join("; ");

        wslArgs.push("-e", "bash", "-c", initCmd);

        return wslArgs;
      }
      default:
        return [];
    }
  }
}
