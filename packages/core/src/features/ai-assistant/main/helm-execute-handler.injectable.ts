/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant의 Helm 명령 실행 IPC 핸들러 (Main Process)
 *
 * @description
 * - Helm 설치 확인
 * - 명령 화이트리스트 검증
 * - 위험 플래그 검증
 * - 클러스터별 kubeconfig 자동 설정
 * - stdin 지원 (values.yaml 전달)
 *
 * 📝 주의사항:
 * - 허용된 명령만 실행 (ALLOWED_HELM_COMMANDS)
 * - 위험한 플래그 차단 (BLOCKED_HELM_FLAGS)
 * - 클러스터별 kubeconfig 사용 (kubectl과 동일 패턴)
 *
 * 🔄 변경이력:
 * - 2026-01-08: 초기 생성 (Helm 전용 채널 구현)
 */

import { loggerInjectionToken } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import { execFile, spawn } from "child_process";
import pLimit from "p-limit";
import { promisify } from "util";

// 🎯 macOS fd 제한(256) 대응: Helm spawn 동시 실행 제한
// Helm은 kubectl보다 무거워서 pLimit(3) 적용
const helmProcessLimit = pLimit(3);

// 🎯 Phase 1: Helm 결과 Hard Limit (컨텍스트 폭발 방지)
const MAX_HELM_OUTPUT_CHARS = 100000;

import kubeconfigManagerInjectable from "../../../main/kubeconfig-manager/kubeconfig-manager.injectable";
import getClusterByIdInjectable from "../../cluster/storage/common/get-by-id.injectable";
import { hasDangerousHelmFlags, helmExecuteChannel, isAllowedHelmCommand } from "../common/helm-execute-channel";

import type { HelmExecuteResult } from "../common/helm-execute-channel";

const execFileAsync = promisify(execFile);

/**
 * 🎯 Helm 설치 확인
 *
 * @returns Helm이 설치되어 있으면 true, 아니면 false
 */
async function isHelmInstalled(): Promise<boolean> {
  try {
    await execFileAsync("which", ["helm"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * 🎯 stdin을 지원하는 Helm 실행 헬퍼
 *
 * @param helmPath - Helm 실행 파일 경로 ("helm")
 * @param args - 명령 인자 배열
 * @param stdin - stdin으로 전달할 내용 (optional)
 * @returns Promise<{ stdout: string; stderr: string; exitCode: number }>
 *
 * 📝 사용 예시:
 * - helm install -f - (stdin으로 values.yaml 전달)
 */
function executeWithStdin(
  helmPath: string,
  args: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(helmPath, args);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    proc.on("error", (error) => {
      resolve({
        stdout: "",
        stderr: error.message,
        exitCode: 1,
      });
    });

    // 🎯 stdin이 있으면 파이프로 전달
    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

/**
 * 🎯 Helm 실행 IPC 핸들러
 *
 * Main Process에서 Helm 명령을 실행하고 결과를 반환합니다.
 *
 * 📝 처리 순서:
 * 1. Helm 설치 확인
 * 2. 명령 화이트리스트 검증
 * 3. 위험 플래그 검증
 * 4. 클러스터 확인
 * 5. kubeconfig 경로 획득
 * 6. Helm 실행 (--kubeconfig 자동 추가)
 * 7. 결과 반환
 */
const helmExecuteHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-helm-execute-handler",
  channel: helmExecuteChannel,
  getHandler: (di) => {
    const getClusterById = di.inject(getClusterByIdInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (args) => {
      const { clusterId, command, args: cmdArgs, stdin } = args;

      logger.info(`[AI-Assistant] Helm 실행 요청: ${command} ${cmdArgs.join(" ")}${stdin ? " (with stdin)" : ""}`);

      // 1. Helm 설치 확인
      if (!(await isHelmInstalled())) {
        logger.warn(`[AI-Assistant] Helm이 설치되지 않음`);
        return {
          callWasSuccessful: false,
          error: {
            type: "NOT_INSTALLED" as const,
            message: "Helm이 설치되지 않았습니다",
            suggestion:
              "brew install helm (macOS) / apt install helm (Linux) / choco install kubernetes-helm (Windows)",
          },
        };
      }

      // 2. 명령 Whitelist 검증
      if (!isAllowedHelmCommand(command)) {
        logger.warn(`[AI-Assistant] 차단된 Helm 명령: ${command}`);
        return {
          callWasSuccessful: false,
          error: {
            type: "BLOCKED" as const,
            message: `허용되지 않은 Helm 명령입니다: ${command}`,
          },
        };
      }

      // 3. 위험 플래그 검증
      if (hasDangerousHelmFlags(cmdArgs)) {
        logger.warn(`[AI-Assistant] 위험한 플래그 감지: ${cmdArgs.join(" ")}`);
        return {
          callWasSuccessful: false,
          error: {
            type: "DANGEROUS_FLAG" as const,
            message: "보안상 위험한 플래그가 포함되어 있습니다 (--kubeconfig, --kube-context, --post-renderer)",
          },
        };
      }

      // 4. 클러스터 확인
      const cluster = getClusterById(clusterId);
      if (!cluster) {
        logger.error(`[AI-Assistant] 클러스터를 찾을 수 없음: ${clusterId}`);
        return {
          callWasSuccessful: false,
          error: {
            type: "CLUSTER_NOT_FOUND" as const,
            message: `클러스터를 찾을 수 없습니다: ${clusterId}`,
          },
        };
      }

      try {
        // 5. kubeconfig 경로 획득 (kubectl과 동일한 패턴)
        const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
        const proxyKubeconfigPath = await kubeconfigManager.ensurePath();

        // 6. Helm 실행 (--kubeconfig 플래그 자동 추가)
        const fullArgs = [command, ...cmdArgs, "--kubeconfig", proxyKubeconfigPath];
        logger.debug(`[AI-Assistant] Helm 실행: helm ${fullArgs.join(" ")}`);

        // 🎯 pLimit 적용: 동시 Helm 프로세스 제한
        const result = await helmProcessLimit(() => executeWithStdin("helm", fullArgs, stdin));

        let stdout = result.stdout;

        // 🎯 Phase 1: Hard Limit 적용 - 대용량 결과 잘라내기
        if (stdout.length > MAX_HELM_OUTPUT_CHARS) {
          const originalLength = stdout.length;
          stdout = stdout.slice(0, MAX_HELM_OUTPUT_CHARS);
          stdout += `\n\n⚠️ 결과가 너무 커서 잘렸습니다 (${originalLength.toLocaleString()}자 → ${MAX_HELM_OUTPUT_CHARS.toLocaleString()}자).
💡 특정 릴리스나 네임스페이스를 지정해주세요: helm ${command} -n <namespace>`;
          logger.warn(`[AI-Assistant] Helm 결과 잘림: ${originalLength} → ${MAX_HELM_OUTPUT_CHARS}`);
        }

        const execResult: HelmExecuteResult = {
          success: result.exitCode === 0,
          stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };

        if (result.exitCode === 0) {
          logger.info(`[AI-Assistant] Helm 실행 성공`);
        } else {
          logger.warn(`[AI-Assistant] Helm 실행 실패: ${result.stderr}`);
        }

        return {
          callWasSuccessful: true,
          response: execResult,
        };
      } catch (error) {
        logger.error(`[AI-Assistant] Helm 실행 오류`, error);
        return {
          callWasSuccessful: false,
          error: {
            type: "EXECUTION_ERROR" as const,
            message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
          },
        };
      }
    };
  },
});

export default helmExecuteHandlerInjectable;
