/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant의 kubectl 명령 실행 IPC 핸들러
 *
 * Renderer에서 요청된 kubectl 명령을 Main Process에서 실행합니다.
 * Whitelist 검증 및 위험 플래그 차단을 수행합니다.
 *
 * 📝 주의사항:
 * - 허용된 명령만 실행 (ALLOWED_KUBECTL_COMMANDS)
 * - 위험한 플래그 차단 (BLOCKED_KUBECTL_FLAGS)
 * - 클러스터별 kubeconfig 사용
 * - stdin 지원 (kubectl apply -f - 등)
 *
 * 🔄 변경이력:
 * - 2025-12-11: 초기 생성 (Tool-Centric 아키텍처 전환)
 * - 2025-12-23: stdin 지원 추가 (spawn 사용)
 */

import { loggerInjectionToken } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import { spawn } from "child_process";
import pLimit from "p-limit";
import execFileInjectable from "../../../common/fs/exec-file.injectable";

// 🎯 macOS fd 제한(256) 대응: kubectl spawn 동시 실행 제한
// I/O bound 작업으로 pLimit(5) 적용
const kubectlProcessLimit = pLimit(5);

// Result size management is now handled by tool-result-processor.ts
// (smart extraction + file persistence for large results)
import kubeconfigManagerInjectable from "../../../main/kubeconfig-manager/kubeconfig-manager.injectable";
import createKubectlInjectable from "../../../main/kubectl/create-kubectl.injectable";
import getClusterByIdInjectable from "../../cluster/storage/common/get-by-id.injectable";
import {
  hasDangerousKubectlFlags,
  isAllowedKubectlCommand,
  kubectlExecuteChannel,
} from "../common/kubectl-execute-channel";

import type { KubectlExecuteResult } from "../common/kubectl-execute-channel";

/**
 * 🎯 stdin을 지원하는 kubectl 실행 헬퍼
 *
 * @param kubectlPath - kubectl 바이너리 경로
 * @param args - 명령 인자
 * @param stdin - stdin으로 전달할 내용 (선택사항)
 * @returns Promise<{ stdout: string; stderr: string; exitCode: number }>
 */
function executeWithStdin(
  kubectlPath: string,
  args: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(kubectlPath, args);

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
 * 🎯 kubectl 실행 IPC 핸들러
 *
 * Main Process에서 kubectl 명령을 실행하고 결과를 반환합니다.
 */
const kubectlExecuteHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-kubectl-execute-handler",
  channel: kubectlExecuteChannel,
  getHandler: (di) => {
    const getClusterById = di.inject(getClusterByIdInjectable);
    const execFile = di.inject(execFileInjectable);
    const createKubectl = di.inject(createKubectlInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (args) => {
      const { clusterId, command, args: cmdArgs, stdin } = args;

      logger.info(`[AI-Assistant] kubectl 실행 요청: ${command} ${cmdArgs.join(" ")}${stdin ? " (with stdin)" : ""}`);

      // 1. 명령 Whitelist 검증
      if (!isAllowedKubectlCommand(command)) {
        logger.warn(`[AI-Assistant] 차단된 kubectl 명령: ${command}`);
        return {
          callWasSuccessful: false,
          error: {
            type: "BLOCKED" as const,
            message: `허용되지 않은 kubectl 명령입니다: ${command}`,
          },
        };
      }

      // 2. 위험 플래그 검증
      if (hasDangerousKubectlFlags(cmdArgs)) {
        logger.warn(`[AI-Assistant] 위험한 플래그 감지: ${cmdArgs.join(" ")}`);
        return {
          callWasSuccessful: false,
          error: {
            type: "DANGEROUS_FLAG" as const,
            message: "보안상 위험한 플래그가 포함되어 있습니다",
          },
        };
      }

      // 3. 클러스터 확인
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
        // 4. kubectl 경로 및 kubeconfig 가져오기
        const kubectl = createKubectl(cluster.version.get());
        const kubectlPath = await kubectl.getPath();
        const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
        const proxyKubeconfigPath = await kubeconfigManager.ensurePath();

        // 5. kubectl 실행
        const fullArgs = [command, ...cmdArgs, "--kubeconfig", proxyKubeconfigPath];
        logger.debug(`[AI-Assistant] kubectl 실행: ${kubectlPath} ${fullArgs.join(" ")}`);

        // 🎯 stdin이 있으면 spawn 사용, 없으면 기존 execFile 사용
        if (stdin) {
          // stdin을 지원하는 실행 (kubectl apply -f - 등)
          logger.debug(`[AI-Assistant] stdin 모드로 실행 (${stdin.length} bytes)`);
          // 🎯 pLimit 적용: 동시 kubectl 프로세스 제한
          const spawnResult = await kubectlProcessLimit(() => executeWithStdin(kubectlPath, fullArgs, stdin));

          const stdout = spawnResult.stdout;

          // Result size management is handled by tool-result-processor.ts
          // (smart extraction + file persistence), so no truncation needed here.

          const execResult: KubectlExecuteResult = {
            success: spawnResult.exitCode === 0,
            stdout,
            stderr: spawnResult.stderr,
            exitCode: spawnResult.exitCode,
          };

          if (spawnResult.exitCode === 0) {
            logger.info(`[AI-Assistant] kubectl 실행 성공 (stdin 모드)`);
          } else {
            logger.warn(`[AI-Assistant] kubectl 실행 실패 (stdin 모드): ${spawnResult.stderr}`);
          }

          return {
            callWasSuccessful: true,
            response: execResult,
          };
        }

        // 기존 execFile 방식 (stdin 없는 경우)
        // maxBuffer 3MB — covers ~500 pods in JSON format; processToolResult handles size reduction
        const result = await execFile(kubectlPath, fullArgs, { maxBuffer: 3 * 1024 * 1024 });

        if (result.callWasSuccessful) {
          const stdout = result.response;

          // Result size management is handled by tool-result-processor.ts
          // (smart extraction + file persistence), so no truncation needed here.

          const execResult: KubectlExecuteResult = {
            success: true,
            stdout,
            stderr: "",
            exitCode: 0,
          };
          logger.info(`[AI-Assistant] kubectl 실행 성공`);
          return {
            callWasSuccessful: true,
            response: execResult,
          };
        }

        // 실행 실패 케이스 (result.callWasSuccessful === false)
        const execError = result.error;
        // exitCode 타입 변환: ExecFileException.code는 string | number | undefined
        const exitCode = typeof execError.code === "number" ? execError.code : 1;
        const execResult: KubectlExecuteResult = {
          success: false,
          stdout: "",
          stderr: execError.stderr || execError.message,
          exitCode,
        };
        logger.warn(`[AI-Assistant] kubectl 실행 실패: ${execError.message}`);
        return {
          callWasSuccessful: true, // IPC는 성공, kubectl 실행만 실패
          response: execResult,
        };
      } catch (error) {
        logger.error(`[AI-Assistant] kubectl 실행 오류`, error);
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

export default kubectlExecuteHandlerInjectable;
