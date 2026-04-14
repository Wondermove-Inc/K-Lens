/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  buildKubectlAttachCommand,
  buildKubectlExecCommand,
  getHostShellType,
  HostShellType,
  isUnixShell,
  isWindowsHost,
  PodOsType,
} from "../shell-utils";

// navigator.platform을 모킹하기 위한 설정
const mockNavigator = (platform: string) => {
  Object.defineProperty(global, "navigator", {
    value: { platform },
    writable: true,
    configurable: true,
  });
};

describe("shell-utils", () => {
  describe("isWindowsHost", () => {
    afterEach(() => {
      // navigator 초기화
      Object.defineProperty(global, "navigator", {
        value: undefined,
        writable: true,
        configurable: true,
      });
    });

    it("should return true for Windows platform", () => {
      mockNavigator("Win32");
      expect(isWindowsHost()).toBe(true);
    });

    it("should return true for Windows 64-bit platform", () => {
      mockNavigator("Win64");
      expect(isWindowsHost()).toBe(true);
    });

    it("should return false for macOS platform", () => {
      mockNavigator("MacIntel");
      expect(isWindowsHost()).toBe(false);
    });

    it("should return false for Linux platform", () => {
      mockNavigator("Linux x86_64");
      expect(isWindowsHost()).toBe(false);
    });

    it("should return false when navigator is undefined", () => {
      Object.defineProperty(global, "navigator", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(isWindowsHost()).toBe(false);
    });
  });

  describe("getHostShellType", () => {
    it("should detect PowerShell", () => {
      expect(getHostShellType("powershell.exe")).toBe(HostShellType.POWERSHELL);
      expect(getHostShellType("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe")).toBe(
        HostShellType.POWERSHELL,
      );
      expect(getHostShellType("pwsh")).toBe(HostShellType.POWERSHELL);
    });

    it("should detect CMD", () => {
      expect(getHostShellType("cmd.exe")).toBe(HostShellType.CMD);
      expect(getHostShellType("C:\\Windows\\System32\\cmd.exe")).toBe(HostShellType.CMD);
    });

    it("should detect WSL", () => {
      expect(getHostShellType("wsl.exe")).toBe(HostShellType.WSL);
      expect(getHostShellType("C:\\Windows\\System32\\wsl.exe")).toBe(HostShellType.WSL);
    });

    it("should detect Git Bash", () => {
      expect(getHostShellType("C:\\Program Files\\Git\\bin\\bash.exe")).toBe(HostShellType.GIT_BASH);
      expect(getHostShellType("git-bash.exe")).toBe(HostShellType.GIT_BASH);
    });

    it("should detect Bash", () => {
      expect(getHostShellType("/bin/bash")).toBe(HostShellType.BASH);
      expect(getHostShellType("bash")).toBe(HostShellType.BASH);
    });

    it("should detect Zsh", () => {
      expect(getHostShellType("/bin/zsh")).toBe(HostShellType.ZSH);
      expect(getHostShellType("zsh")).toBe(HostShellType.ZSH);
    });

    it("should return UNKNOWN for unrecognized shell", () => {
      expect(getHostShellType("/bin/fish")).toBe(HostShellType.UNKNOWN);
    });
  });

  describe("isUnixShell", () => {
    it("should return true for Unix shells", () => {
      expect(isUnixShell(HostShellType.WSL)).toBe(true);
      expect(isUnixShell(HostShellType.BASH)).toBe(true);
      expect(isUnixShell(HostShellType.ZSH)).toBe(true);
      expect(isUnixShell(HostShellType.GIT_BASH)).toBe(true);
    });

    it("should return false for Windows shells", () => {
      expect(isUnixShell(HostShellType.POWERSHELL)).toBe(false);
      expect(isUnixShell(HostShellType.CMD)).toBe(false);
    });

    it("should return false for unknown shell", () => {
      expect(isUnixShell(HostShellType.UNKNOWN)).toBe(false);
    });
  });

  describe("buildKubectlExecCommand", () => {
    const baseOptions = {
      kubectlPath: "kubectl",
      namespace: "default",
      podName: "my-pod",
    };

    it("should not add exec prefix for PowerShell", () => {
      const command = buildKubectlExecCommand({
        ...baseOptions,
        hostShellPath: "powershell.exe",
      });
      expect(command).toBe("kubectl exec -i -t -n default my-pod -- sh");
      expect(command).not.toContain("exec kubectl");
    });

    it("should not add exec prefix for CMD", () => {
      const command = buildKubectlExecCommand({
        ...baseOptions,
        hostShellPath: "cmd.exe",
      });
      expect(command).toBe("kubectl exec -i -t -n default my-pod -- sh");
    });

    it("should add exec prefix for WSL", () => {
      const command = buildKubectlExecCommand({
        ...baseOptions,
        hostShellPath: "wsl.exe",
      });
      expect(command).toBe('exec kubectl exec -i -t -n default my-pod -- sh -c "clear; (bash || ash || sh)"');
    });

    it("should add exec prefix for Git Bash", () => {
      const command = buildKubectlExecCommand({
        ...baseOptions,
        hostShellPath: "C:\\Program Files\\Git\\bin\\bash.exe",
      });
      expect(command).toBe('exec kubectl exec -i -t -n default my-pod -- sh -c "clear; (bash || ash || sh)"');
    });

    it("should add exec prefix for Bash", () => {
      const command = buildKubectlExecCommand({
        ...baseOptions,
        hostShellPath: "/bin/bash",
      });
      expect(command).toBe('exec kubectl exec -i -t -n default my-pod -- sh -c "clear; (bash || ash || sh)"');
    });

    it("should use powershell for Windows Pod", () => {
      const command = buildKubectlExecCommand({
        ...baseOptions,
        podOs: "windows",
        hostShellPath: "powershell.exe",
      });
      expect(command).toBe("kubectl exec -i -t -n default my-pod -- powershell");
    });

    it("should use powershell for Windows Pod with exec prefix on Unix shell", () => {
      const command = buildKubectlExecCommand({
        ...baseOptions,
        podOs: "windows",
        hostShellPath: "wsl.exe",
      });
      expect(command).toBe("exec kubectl exec -i -t -n default my-pod -- powershell");
    });

    it("should include container name when provided", () => {
      const command = buildKubectlExecCommand({
        ...baseOptions,
        containerName: "my-container",
        hostShellPath: "powershell.exe",
      });
      expect(command).toBe("kubectl exec -i -t -n default my-pod -c my-container -- sh");
    });

    it("should use custom kubectl path", () => {
      const command = buildKubectlExecCommand({
        ...baseOptions,
        kubectlPath: "/usr/local/bin/kubectl",
        hostShellPath: "powershell.exe",
      });
      expect(command).toBe("/usr/local/bin/kubectl exec -i -t -n default my-pod -- sh");
    });
  });

  describe("buildKubectlAttachCommand", () => {
    const baseOptions = {
      kubectlPath: "kubectl",
      namespace: "default",
      podName: "my-pod",
    };

    it("should not add exec prefix for PowerShell", () => {
      const command = buildKubectlAttachCommand({
        ...baseOptions,
        hostShellPath: "powershell.exe",
      });
      expect(command).toBe("kubectl attach -i -t -n default my-pod");
    });

    it("should add exec prefix for WSL", () => {
      const command = buildKubectlAttachCommand({
        ...baseOptions,
        hostShellPath: "wsl.exe",
      });
      expect(command).toBe("exec kubectl attach -i -t -n default my-pod");
    });

    it("should include container name when provided", () => {
      const command = buildKubectlAttachCommand({
        ...baseOptions,
        containerName: "my-container",
        hostShellPath: "powershell.exe",
      });
      expect(command).toBe("kubectl attach -i -t -n default my-pod -c my-container");
    });

    it("should not have shell command (unlike exec)", () => {
      const command = buildKubectlAttachCommand({
        ...baseOptions,
        hostShellPath: "/bin/bash",
      });
      expect(command).not.toContain("sh");
      expect(command).not.toContain("--");
    });
  });

  describe("integration scenarios", () => {
    it("Windows PowerShell + Linux Pod", () => {
      const command = buildKubectlExecCommand({
        kubectlPath: "kubectl",
        namespace: "production",
        podName: "nginx-pod",
        containerName: "nginx",
        podOs: "linux",
        hostShellPath: "powershell.exe",
      });
      expect(command).toBe("kubectl exec -i -t -n production nginx-pod -c nginx -- sh");
    });

    it("Windows WSL + Linux Pod", () => {
      const command = buildKubectlExecCommand({
        kubectlPath: "kubectl",
        namespace: "production",
        podName: "nginx-pod",
        containerName: "nginx",
        podOs: "linux",
        hostShellPath: "wsl.exe",
      });
      expect(command).toBe(
        'exec kubectl exec -i -t -n production nginx-pod -c nginx -- sh -c "clear; (bash || ash || sh)"',
      );
    });

    it("Windows PowerShell + Windows Pod", () => {
      const command = buildKubectlExecCommand({
        kubectlPath: "kubectl",
        namespace: "production",
        podName: "iis-pod",
        podOs: "windows",
        hostShellPath: "powershell.exe",
      });
      expect(command).toBe("kubectl exec -i -t -n production iis-pod -- powershell");
    });

    it("macOS + Linux Pod", () => {
      const command = buildKubectlExecCommand({
        kubectlPath: "kubectl",
        namespace: "production",
        podName: "nginx-pod",
        podOs: "linux",
        hostShellPath: "/bin/zsh",
      });
      expect(command).toBe('exec kubectl exec -i -t -n production nginx-pod -- sh -c "clear; (bash || ash || sh)"');
    });
  });
});
