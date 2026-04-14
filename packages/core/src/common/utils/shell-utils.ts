/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 호스트 쉘 타입 enum
 * - Windows: PowerShell, CMD, Git Bash
 * - Unix: WSL, Bash, Zsh
 */
export enum HostShellType {
  POWERSHELL = "powershell",
  CMD = "cmd",
  WSL = "wsl",
  BASH = "bash",
  ZSH = "zsh",
  GIT_BASH = "git-bash",
  UNKNOWN = "unknown",
}

/**
 * Pod OS 타입 enum
 */
export enum PodOsType {
  LINUX = "linux",
  WINDOWS = "windows",
}

/**
 * navigator.platform으로 Windows 호스트 감지 (런타임에 정확)
 * process.platform은 Electron renderer에서 빌드 시점 값이 고정될 수 있음
 */
export function isWindowsHost(): boolean {
  if (typeof navigator !== "undefined" && navigator.platform) {
    return navigator.platform.toLowerCase().includes("win");
  }
  return false;
}

/**
 * 쉘 경로에서 쉘 타입 감지
 * @param shellPath - 사용자 설정의 쉘 경로 (예: "wsl.exe", "bash.exe", "powershell.exe")
 */
export function getHostShellType(shellPath: string | undefined): HostShellType {
  if (!shellPath) {
    // 기본값: 플랫폼에 따라 결정
    return isWindowsHost() ? HostShellType.POWERSHELL : HostShellType.BASH;
  }

  const lowerPath = shellPath.toLowerCase();

  // WSL 감지
  if (lowerPath.includes("wsl")) {
    return HostShellType.WSL;
  }

  // Git Bash 감지
  if (lowerPath.includes("git") && lowerPath.includes("bash")) {
    return HostShellType.GIT_BASH;
  }

  // PowerShell 감지 (pwsh 포함)
  if (lowerPath.includes("powershell") || lowerPath.includes("pwsh")) {
    return HostShellType.POWERSHELL;
  }

  // CMD 감지
  if (lowerPath.includes("cmd")) {
    return HostShellType.CMD;
  }

  // Zsh 감지
  if (lowerPath.includes("zsh")) {
    return HostShellType.ZSH;
  }

  // Bash 감지 (마지막에 체크 - Git Bash와 겹치지 않도록)
  if (lowerPath.includes("bash")) {
    return HostShellType.BASH;
  }

  return HostShellType.UNKNOWN;
}

/**
 * Unix 계열 쉘인지 확인 (exec 프리픽스가 필요한 쉘)
 */
export function isUnixShell(shellType: HostShellType): boolean {
  return [HostShellType.WSL, HostShellType.BASH, HostShellType.ZSH, HostShellType.GIT_BASH].includes(shellType);
}

/**
 * kubectl exec 명령어 빌드 옵션
 */
export interface KubectlExecOptions {
  /** kubectl 실행 파일 경로 */
  kubectlPath: string;
  /** Pod namespace */
  namespace: string;
  /** Pod 이름 */
  podName: string;
  /** 컨테이너 이름 (선택) */
  containerName?: string;
  /** Pod OS 타입 (string으로 받아서 내부에서 판단) */
  podOs?: string;
  /** 호스트 쉘 경로 (사용자 설정) */
  hostShellPath?: string;
}

/**
 * kubectl exec 명령어 빌드
 *
 * 명령어 조합 매트릭스:
 * | 호스트 쉘 | Pod OS | exec 프리픽스 | Pod 쉘 명령어 |
 * |---|---|---|---|
 * | PowerShell/CMD | Linux | 없음 | sh |
 * | PowerShell/CMD | Windows | 없음 | powershell |
 * | WSL/Git Bash/bash | Linux | exec | sh -c "clear; (bash || ash || sh)" |
 * | WSL/Git Bash/bash | Windows | exec | powershell |
 *
 * @returns 명령어 문자열 (터미널에 전송할 전체 명령어)
 */
export function buildKubectlExecCommand(options: KubectlExecOptions): string {
  const { kubectlPath, namespace, podName, containerName, podOs, hostShellPath } = options;

  const hostShellType = getHostShellType(hostShellPath);
  const needsExecPrefix = isUnixShell(hostShellType);
  const isWindowsPod = podOs === "windows";

  const commandParts: string[] = [];

  // Unix 쉘에서만 exec 프리픽스 추가
  if (needsExecPrefix) {
    commandParts.push("exec");
  }

  // kubectl exec 기본 명령어
  commandParts.push(kubectlPath, "exec", "-i", "-t", "-n", namespace, podName);

  // 컨테이너 지정
  if (containerName) {
    commandParts.push("-c", containerName);
  }

  // 쉘 명령어 구분자
  commandParts.push("--");

  // Pod OS에 따른 쉘 명령어
  if (isWindowsPod) {
    // Windows Pod: PowerShell 실행
    commandParts.push("powershell");
  } else if (needsExecPrefix) {
    // Unix 호스트 + Linux Pod: 복잡한 쉘 명령어 (따옴표 사용 가능)
    commandParts.push('sh -c "clear; (bash || ash || sh)"');
  } else {
    // Windows 호스트(PowerShell/CMD) + Linux Pod: 단순 sh
    commandParts.push("sh");
  }

  return commandParts.join(" ");
}

/**
 * kubectl attach 명령어 빌드 옵션
 */
export interface KubectlAttachOptions {
  /** kubectl 실행 파일 경로 */
  kubectlPath: string;
  /** Pod namespace */
  namespace: string;
  /** Pod 이름 */
  podName: string;
  /** 컨테이너 이름 (선택) */
  containerName?: string;
  /** 호스트 쉘 경로 (사용자 설정) */
  hostShellPath?: string;
}

/**
 * kubectl attach 명령어 빌드
 *
 * Attach는 Shell과 달리 쉘 명령어가 없음
 * - Shell: kubectl exec -it pod -- sh (쉘 실행)
 * - Attach: kubectl attach -it pod (기존 프로세스에 연결)
 *
 * @returns 명령어 문자열
 */
export function buildKubectlAttachCommand(options: KubectlAttachOptions): string {
  const { kubectlPath, namespace, podName, containerName, hostShellPath } = options;

  const hostShellType = getHostShellType(hostShellPath);
  const needsExecPrefix = isUnixShell(hostShellType);

  const commandParts: string[] = [];

  // Unix 쉘에서만 exec 프리픽스 추가
  if (needsExecPrefix) {
    commandParts.push("exec");
  }

  // kubectl attach 기본 명령어
  commandParts.push(kubectlPath, "attach", "-i", "-t", "-n", namespace, podName);

  // 컨테이너 지정
  if (containerName) {
    commandParts.push("-c", containerName);
  }

  return commandParts.join(" ");
}
