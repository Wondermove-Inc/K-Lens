/**
 * 🎯 목적: kubectl diff (파일 기반) IPC 핸들러
 * 📝 기능:
 *   - 파일 경로 기반 kubectl diff 실행
 *   - 로컬 YAML과 클러스터 상태 비교
 *   - 클러스터별 kubeconfig 적용
 * 🔄 변경이력:
 *   - 2026-01-25: FIX-030 - 초기 구현
 * @module main/kubectl/diff-file-handler
 */

import { loggerInjectionToken } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import { spawn } from "child_process";
import * as path from "path";
import {
  KUBECTL_APPLY_TIMEOUT_MS,
  type KubectlFileResponse,
  kubectlDiffFileChannel,
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
 * kubectl diff (파일 기반) IPC 핸들러
 * 📝 kubectl diff는 차이가 있으면 exit code 1을 반환함 (에러 아님)
 *    - exit 0: 차이 없음
 *    - exit 1: 차이 있음
 *    - exit >1: 실제 에러
 */
const kubectlDiffFileHandlerInjectable = getRequestChannelListenerInjectable({
  id: "kubectl-diff-file-handler",
  channel: kubectlDiffFileChannel,
  getHandler: (di) => {
    const getClusterById = di.inject(getClusterByIdInjectable);
    const createKubectl = di.inject(createKubectlInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (request): Promise<KubectlFileResponse> => {
      const { clusterId, filePath } = request;

      logger.info(`[KubectlDiffFile] Comparing file: ${filePath} with cluster: ${clusterId}`);

      // 1. 클러스터 확인
      const cluster = getClusterById(clusterId);
      if (!cluster) {
        logger.error(`[KubectlDiffFile] Cluster not found: ${clusterId}`);
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

        logger.info(`[KubectlDiffFile] Using kubeconfig: ${proxyKubeconfigPath}`);

        // 4. 파일 경로 정규화
        const normalizedPath = path.normalize(filePath);

        // 5. kubectl diff 명령어 구성
        const args = ["diff", "-f", normalizedPath, "--kubeconfig", proxyKubeconfigPath];

        logger.info(`[KubectlDiffFile] Executing: ${kubectlPath} ${args.join(" ")}`);

        // 6. 명령어 실행
        const result = await executeKubectl(kubectlPath, args, KUBECTL_APPLY_TIMEOUT_MS);

        // kubectl diff 특수 처리:
        // - exit 0: 차이 없음 (success)
        // - exit 1: 차이 있음 (success, stdout에 diff 결과)
        // - exit >1: 실제 에러 (failure)
        const success = result.exitCode === 0 || result.exitCode === 1;

        if (success) {
          if (result.exitCode === 0) {
            logger.info(`[KubectlDiffFile] No differences found: ${filePath}`);
          } else {
            logger.info(`[KubectlDiffFile] Differences found: ${filePath}`);
          }
        } else {
          logger.warn(`[KubectlDiffFile] Diff failed: ${filePath}`, result.stderr);
        }

        return {
          success,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[KubectlDiffFile] Error: ${filePath}`, error);

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

export default kubectlDiffFileHandlerInjectable;
