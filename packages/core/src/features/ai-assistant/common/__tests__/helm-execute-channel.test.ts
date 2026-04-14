/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: helm-execute-channel.ts 단위 테스트
 *
 * @description
 * - 인터페이스 타입 검증
 * - 화이트리스트 명령 검증
 * - 쓰기 명령 판별 검증
 * - 위험 플래그 감지 검증
 *
 * 🔄 변경이력:
 * - 2026-01-08: TDD RED 단계 - 테스트 작성
 */

import {
  // 화이트리스트
  ALLOWED_HELM_COMMANDS,
  BLOCKED_HELM_FLAGS,
  // 인터페이스 (타입 검증용)
  type HelmExecuteArgs,
  type HelmExecuteError,
  type HelmExecuteResponse,
  type HelmExecuteResult,
  hasDangerousHelmFlags,
  // 채널 및 토큰
  helmExecuteChannel,
  helmExecuteInjectionToken,
  // 검증 함수
  isAllowedHelmCommand,
  isWriteHelmCommand,
  WRITE_HELM_COMMANDS,
} from "../helm-execute-channel";

describe("helm-execute-channel", () => {
  // ============================================
  // 🎯 IPC 채널 및 DI 토큰 테스트
  // ============================================
  describe("IPC 채널 정의", () => {
    it("helmExecuteChannel이 정의되어 있어야 함", () => {
      expect(helmExecuteChannel).toBeDefined();
      expect(helmExecuteChannel.id).toBe("ai-assistant:helm-execute");
    });

    it("helmExecuteInjectionToken이 정의되어 있어야 함", () => {
      expect(helmExecuteInjectionToken).toBeDefined();
      expect(helmExecuteInjectionToken.id).toBe("ai-assistant-helm-execute");
    });
  });

  // ============================================
  // 🎯 화이트리스트 테스트
  // ============================================
  describe("ALLOWED_HELM_COMMANDS (화이트리스트)", () => {
    it("20개의 허용된 명령이 있어야 함", () => {
      expect(ALLOWED_HELM_COMMANDS).toHaveLength(20);
    });

    it("읽기 명령 14개가 포함되어 있어야 함", () => {
      const readCommands = [
        "list",
        "get",
        "history",
        "status",
        "show",
        "search",
        "repo",
        "env",
        "version",
        "template",
        "lint",
        "dependency",
        "pull",
        "create",
      ];
      readCommands.forEach((cmd) => {
        expect(ALLOWED_HELM_COMMANDS).toContain(cmd);
      });
    });

    it("쓰기 명령 6개가 포함되어 있어야 함", () => {
      const writeCommands = ["install", "upgrade", "uninstall", "rollback", "test", "push"];
      writeCommands.forEach((cmd) => {
        expect(ALLOWED_HELM_COMMANDS).toContain(cmd);
      });
    });
  });

  describe("WRITE_HELM_COMMANDS (쓰기 명령)", () => {
    it("6개의 쓰기 명령이 있어야 함", () => {
      expect(WRITE_HELM_COMMANDS).toHaveLength(6);
    });

    it("install, upgrade, uninstall, rollback, test, push가 포함되어 있어야 함", () => {
      expect(WRITE_HELM_COMMANDS).toContain("install");
      expect(WRITE_HELM_COMMANDS).toContain("upgrade");
      expect(WRITE_HELM_COMMANDS).toContain("uninstall");
      expect(WRITE_HELM_COMMANDS).toContain("rollback");
      expect(WRITE_HELM_COMMANDS).toContain("test");
      expect(WRITE_HELM_COMMANDS).toContain("push");
    });
  });

  describe("BLOCKED_HELM_FLAGS (차단 플래그)", () => {
    it("3개의 차단 플래그가 있어야 함", () => {
      expect(BLOCKED_HELM_FLAGS).toHaveLength(3);
    });

    it("--kubeconfig, --kube-context, --post-renderer가 포함되어 있어야 함", () => {
      expect(BLOCKED_HELM_FLAGS).toContain("--kubeconfig");
      expect(BLOCKED_HELM_FLAGS).toContain("--kube-context");
      expect(BLOCKED_HELM_FLAGS).toContain("--post-renderer");
    });
  });

  // ============================================
  // 🎯 검증 함수 테스트
  // ============================================
  describe("isAllowedHelmCommand", () => {
    it("허용된 명령은 true를 반환해야 함", () => {
      expect(isAllowedHelmCommand("list")).toBe(true);
      expect(isAllowedHelmCommand("install")).toBe(true);
      expect(isAllowedHelmCommand("get")).toBe(true);
      expect(isAllowedHelmCommand("status")).toBe(true);
    });

    it("허용되지 않은 명령은 false를 반환해야 함", () => {
      expect(isAllowedHelmCommand("plugin")).toBe(false);
      expect(isAllowedHelmCommand("registry")).toBe(false);
      expect(isAllowedHelmCommand("unknown")).toBe(false);
      expect(isAllowedHelmCommand("")).toBe(false);
    });
  });

  describe("isWriteHelmCommand", () => {
    it("쓰기 명령은 true를 반환해야 함", () => {
      expect(isWriteHelmCommand("install")).toBe(true);
      expect(isWriteHelmCommand("upgrade")).toBe(true);
      expect(isWriteHelmCommand("uninstall")).toBe(true);
      expect(isWriteHelmCommand("rollback")).toBe(true);
      expect(isWriteHelmCommand("test")).toBe(true);
      expect(isWriteHelmCommand("push")).toBe(true);
    });

    it("읽기 명령은 false를 반환해야 함", () => {
      expect(isWriteHelmCommand("list")).toBe(false);
      expect(isWriteHelmCommand("get")).toBe(false);
      expect(isWriteHelmCommand("status")).toBe(false);
      expect(isWriteHelmCommand("show")).toBe(false);
    });
  });

  describe("hasDangerousHelmFlags", () => {
    it("위험한 플래그가 있으면 true를 반환해야 함", () => {
      expect(hasDangerousHelmFlags(["--kubeconfig", "/path/to/config"])).toBe(true);
      expect(hasDangerousHelmFlags(["--kubeconfig=/path/to/config"])).toBe(true);
      expect(hasDangerousHelmFlags(["--kube-context", "other-context"])).toBe(true);
      expect(hasDangerousHelmFlags(["--kube-context=other-context"])).toBe(true);
      expect(hasDangerousHelmFlags(["--post-renderer", "script.sh"])).toBe(true);
      expect(hasDangerousHelmFlags(["--post-renderer=script.sh"])).toBe(true);
    });

    it("안전한 플래그만 있으면 false를 반환해야 함", () => {
      expect(hasDangerousHelmFlags(["-n", "default"])).toBe(false);
      expect(hasDangerousHelmFlags(["--namespace", "default"])).toBe(false);
      expect(hasDangerousHelmFlags(["--output", "json"])).toBe(false);
      expect(hasDangerousHelmFlags(["nginx", "bitnami/nginx"])).toBe(false);
    });

    it("빈 배열은 false를 반환해야 함", () => {
      expect(hasDangerousHelmFlags([])).toBe(false);
    });

    it("위험 플래그가 중간에 있어도 감지해야 함", () => {
      expect(hasDangerousHelmFlags(["install", "nginx", "--kubeconfig", "/path"])).toBe(true);
      expect(hasDangerousHelmFlags(["-n", "default", "--kube-context=other"])).toBe(true);
    });
  });

  // ============================================
  // 🎯 타입 검증 테스트 (컴파일 타임 검증)
  // ============================================
  describe("타입 정의 검증", () => {
    it("HelmExecuteArgs 타입이 올바르게 정의되어야 함", () => {
      const args: HelmExecuteArgs = {
        clusterId: "test-cluster-id",
        command: "list",
        args: ["-n", "default"],
        stdin: undefined,
      };
      expect(args.clusterId).toBe("test-cluster-id");
      expect(args.command).toBe("list");
      expect(args.args).toEqual(["-n", "default"]);
    });

    it("HelmExecuteResult 타입이 올바르게 정의되어야 함", () => {
      const result: HelmExecuteResult = {
        success: true,
        stdout: "output",
        stderr: "",
        exitCode: 0,
      };
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it("HelmExecuteError 타입이 올바르게 정의되어야 함", () => {
      const error: HelmExecuteError = {
        type: "NOT_INSTALLED",
        message: "Helm is not installed",
        suggestion: "brew install helm",
      };
      expect(error.type).toBe("NOT_INSTALLED");
      expect(error.suggestion).toBeDefined();
    });

    it("HelmExecuteResponse 성공 타입이 올바르게 정의되어야 함", () => {
      const successResponse: HelmExecuteResponse = {
        callWasSuccessful: true,
        response: {
          success: true,
          stdout: "output",
          stderr: "",
          exitCode: 0,
        },
      };
      expect(successResponse.callWasSuccessful).toBe(true);
      if (successResponse.callWasSuccessful) {
        expect(successResponse.response.success).toBe(true);
      }
    });

    it("HelmExecuteResponse 실패 타입이 올바르게 정의되어야 함", () => {
      const errorResponse: HelmExecuteResponse = {
        callWasSuccessful: false,
        error: {
          type: "BLOCKED",
          message: "Command not allowed",
        },
      };
      expect(errorResponse.callWasSuccessful).toBe(false);
      if (!errorResponse.callWasSuccessful) {
        expect(errorResponse.error.type).toBe("BLOCKED");
      }
    });
  });
});
