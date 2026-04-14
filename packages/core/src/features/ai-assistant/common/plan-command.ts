/**
 * 🎯 목적: /plan 슬래시 커맨드 처리
 * 02: /plan Slash Command 추가
 *
 * 📝 주요 기능:
 * - /plan 커맨드 감지
 * - 커맨드 파싱
 * - 액션 실행
 *
 * @packageDocumentation
 */

import {
  executeApprove,
  executeCancel,
  executeHelp,
  executeReject,
  executeStart,
  executeStatus,
} from "./plan-command-actions";

// ============================================
// 🎯 타입 정의
// ============================================

/**
 * 커맨드 액션 타입
 */
export type PlanCommandAction = "start" | "cancel" | "status" | "approve" | "reject" | "help";

/**
 * 커맨드 옵션 인터페이스
 */
export interface PlanCommandOptions {
  /** 실행할 액션 */
  action: PlanCommandAction;
  /** 계획 제목 (start 액션용) */
  title?: string;
}

/**
 * 커맨드 실행 결과
 */
export interface PlanCommandResult {
  /** 성공 여부 */
  success: boolean;
  /** 결과 메시지 */
  message: string;
}

/**
 * PlanCommand 타입 (alias)
 */
export type PlanCommand = PlanCommandOptions;

// ============================================
// 🎯 커맨드 감지
// ============================================

/**
 * /plan 커맨드 여부 확인
 *
 * @param message - 사용자 입력 메시지
 * @returns /plan 커맨드 여부
 */
export function isPlanCommand(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  return trimmed === "/plan" || trimmed.startsWith("/plan ");
}

// ============================================
// 🎯 커맨드 파싱
// ============================================

/**
 * /plan 커맨드 파싱
 *
 * @param message - 사용자 입력 메시지
 * @returns 파싱된 커맨드 옵션
 */
export function parsePlanCommand(message: string): PlanCommandOptions {
  const trimmed = message.trim();
  const parts = trimmed.split(/\s+/).slice(1); // /plan 제외

  // 옵션 확인
  if (parts.includes("--help") || parts.includes("-h")) {
    return { action: "help" };
  }
  if (parts.includes("--cancel") || parts.includes("-c")) {
    return { action: "cancel" };
  }
  if (parts.includes("--status") || parts.includes("-s")) {
    return { action: "status" };
  }
  if (parts.includes("--approve") || parts.includes("-a")) {
    return { action: "approve" };
  }
  if (parts.includes("--reject") || parts.includes("-r")) {
    return { action: "reject" };
  }

  // 옵션이 없으면 start 액션
  const title = parts
    .filter((p) => !p.startsWith("-"))
    .join(" ")
    .trim();

  return {
    action: "start",
    title: title || undefined,
  };
}

// ============================================
// 🎯 커맨드 실행
// ============================================

/**
 * /plan 커맨드 실행
 *
 * @param options - 커맨드 옵션
 * @returns 실행 결과
 */
export async function executePlanCommand(options: PlanCommandOptions): Promise<PlanCommandResult> {
  switch (options.action) {
    case "start":
      return executeStart(options.title);
    case "cancel":
      return executeCancel();
    case "status":
      return executeStatus();
    case "approve":
      return executeApprove();
    case "reject":
      return executeReject();
    case "help":
      return executeHelp();
    default:
      return {
        success: false,
        message: `알 수 없는 액션: ${options.action}`,
      };
  }
}
