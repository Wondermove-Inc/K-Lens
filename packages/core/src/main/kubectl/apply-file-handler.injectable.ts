/**
 * 🎯 목적: kubectl apply (파일 기반) IPC 핸들러
 * 📝 기능:
 *   - 파일 경로 기반 kubectl apply 실행
 *   - 클러스터별 kubeconfig 적용
 *   - dry-run 모드 지원
 * 🔄 변경이력:
 *   - 2026-01-25: FIX-030 - messaging 패턴으로 구현
 * @module main/kubectl/apply-file-handler
 */

import { loggerInjectionToken } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import { spawn } from "child_process";
import * as path from "path";
import {
  KUBECTL_APPLY_TIMEOUT_MS,
  type KubectlFileResponse,
  kubectlApplyFileChannel,
} from "../../common/ipc/kubectl-apply";
import getClusterByIdInjectable from "../../features/cluster/storage/common/get-by-id.injectable";
import kubeconfigManagerInjectable from "../kubeconfig-manager/kubeconfig-manager.injectable";
import createKubectlInjectable from "./create-kubectl.injectable";

/**
 * kubectl 명령어 실행 (spawn 기반, 타임아웃 적용)
 */
async function executeKubectl(
  kubectlPath: string,
  args: string[],
  timeout: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const childProcess = spawn(kubectlPath, args, {
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeoutId = setTimeout(() => {
      killed = true;
      childProcess.kill("SIGTERM");
    }, timeout);

    childProcess.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on("close", (exitCode) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr: killed ? `Command timed out after ${timeout}ms. ${stderr}` : stderr,
        exitCode: exitCode ?? (killed ? 124 : 1),
      });
    });

    childProcess.on("error", (error) => {
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr: `Spawn error: ${error.message}`,
        exitCode: 1,
      });
    });
  });
}

/**
 * kubectl apply (파일 기반) IPC 핸들러
 */
const kubectlApplyFileHandlerInjectable = getRequestChannelListenerInjectable({
  id: "kubectl-apply-file-handler",
  channel: kubectlApplyFileChannel,
  getHandler: (di) => {
    const getClusterById = di.inject(getClusterByIdInjectable);
    const createKubectl = di.inject(createKubectlInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (request): Promise<KubectlFileResponse> => {
      const { clusterId, filePath, dryRun = false } = request;

      logger.info(`[KubectlApplyFile] Applying file: ${filePath} to cluster: ${clusterId}`);

      // 1. 클러스터 확인
      const cluster = getClusterById(clusterId);
      if (!cluster) {
        logger.error(`[KubectlApplyFile] Cluster not found: ${clusterId}`);
        return {
          success: false,
          stdout: "",
          stderr: `클러스터를 찾을 수 없습니다: ${clusterId}`,
          exitCode: 1,
        };
      }

      try {
        // 2. kubectl 경로 획득
        const kubectl = createKubectl(cluster.version.get());
        const kubectlPath = await kubectl.getPath();

        // 3. kubeconfig 경로 획득
        const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
        const proxyKubeconfigPath = await kubeconfigManager.ensurePath();

        logger.info(`[KubectlApplyFile] Using kubeconfig: ${proxyKubeconfigPath}`);

        // 4. 파일 경로 정규화
        const normalizedPath = path.normalize(filePath);

        // 5. kubectl apply 명령어 구성
        const args = ["apply", "-f", normalizedPath, "--kubeconfig", proxyKubeconfigPath];

        if (dryRun) {
          args.push("--dry-run=client");
        }

        logger.info(`[KubectlApplyFile] Executing: ${kubectlPath} ${args.join(" ")}`);

        // 6. 명령어 실행
        const result = await executeKubectl(kubectlPath, args, KUBECTL_APPLY_TIMEOUT_MS);
        const success = result.exitCode === 0;

        if (success) {
          logger.info(`[KubectlApplyFile] Apply successful: ${filePath}`);
        } else {
          logger.warn(`[KubectlApplyFile] Apply failed: ${filePath}`, result.stderr);
        }

        return {
          success,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[KubectlApplyFile] Error: ${filePath}`, error);

        return {
          success: false,
          stdout: "",
          stderr: errorMessage,
          exitCode: 1,
        };
      }
    };
  },
});

export default kubectlApplyFileHandlerInjectable;
