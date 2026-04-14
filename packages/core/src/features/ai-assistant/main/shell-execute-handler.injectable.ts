/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant의 외부 CLI 도구 실행 IPC 핸들러
 *
 * Renderer에서 요청된 shell 명령을 Main Process에서 실행합니다.
 * Whitelist에 있는 CLI만 실행 가능합니다.
 *
 * 📝 주의사항:
 * - 허용된 CLI만 실행 (stern, helm, kubectx, kubens, k9s)
 * - 설치되지 않은 CLI는 설치 안내 메시지 반환
 * - 모든 shell 명령은 HITL 승인 필요 (Renderer에서 처리)
 *
 * 🔄 변경이력:
 * - 2025-12-11: 초기 생성 (Tool-Centric 아키텍처 전환)
 */

import { loggerInjectionToken } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import execFileInjectable from "../../../common/fs/exec-file.injectable";
import { getInstallSuggestion, isAllowedShellCommand, shellExecuteChannel } from "../common/shell-execute-channel";

import type { ShellExecuteResult } from "../common/shell-execute-channel";

/**
 * 🎯 CLI 설치 여부 확인
 *
 * which 명령으로 CLI가 PATH에 있는지 확인
 */
async function isCliInstalled(
  execFile: (path: string, args: string[]) => Promise<{ callWasSuccessful: boolean; response?: string }>,
  command: string,
): Promise<boolean> {
  try {
    const result = await execFile("which", [command]);
    return result.callWasSuccessful && !!result.response?.trim();
  } catch {
    return false;
  }
}

/**
 * 🎯 shell 실행 IPC 핸들러
 *
 * Main Process에서 허용된 CLI 도구를 실행하고 결과를 반환합니다.
 */
const shellExecuteHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-shell-execute-handler",
  channel: shellExecuteChannel,
  getHandler: (di) => {
    const execFile = di.inject(execFileInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (args) => {
      const { command, args: cmdArgs } = args;

      logger.info(`[AI-Assistant] shell 실행 요청: ${command} ${cmdArgs.join(" ")}`);

      // 1. 명령 Whitelist 검증
      if (!isAllowedShellCommand(command)) {
        logger.warn(`[AI-Assistant] 허용되지 않은 CLI: ${command}`);
        return {
          callWasSuccessful: false,
          error: {
            type: "NOT_ALLOWED" as const,
            message: `허용되지 않은 CLI입니다: ${command}`,
            suggestion: "허용된 CLI: stern, helm, kubectx, kubens, k9s",
          },
        };
      }

      // 2. CLI 설치 확인
      const installed = await isCliInstalled(execFile, command);
      if (!installed) {
        const suggestion = getInstallSuggestion(command);
        logger.warn(`[AI-Assistant] CLI가 설치되어 있지 않음: ${command}`);
        return {
          callWasSuccessful: false,
          error: {
            type: "NOT_INSTALLED" as const,
            message: `${command}가 설치되어 있지 않습니다`,
            suggestion: suggestion ? `설치: ${suggestion}` : undefined,
          },
        };
      }

      try {
        // 3. CLI 실행
        logger.debug(`[AI-Assistant] shell 실행: ${command} ${cmdArgs.join(" ")}`);
        const result = await execFile(command, cmdArgs);

        if (result.callWasSuccessful) {
          const execResult: ShellExecuteResult = {
            success: true,
            stdout: result.response ?? "",
            stderr: "",
          };
          logger.info(`[AI-Assistant] shell 실행 성공: ${command}`);
          return {
            callWasSuccessful: true,
            response: execResult,
          };
        }

        // 실행 실패 케이스 (result.callWasSuccessful === false)
        const execError = result.error;
        const execResult: ShellExecuteResult = {
          success: false,
          stdout: "",
          stderr: execError.stderr || execError.message || "실행 실패",
        };
        logger.warn(`[AI-Assistant] shell 실행 실패: ${command}`);
        return {
          callWasSuccessful: true, // IPC는 성공, shell 실행만 실패
          response: execResult,
        };
      } catch (error) {
        logger.error(`[AI-Assistant] shell 실행 오류`, error);
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

export default shellExecuteHandlerInjectable;
