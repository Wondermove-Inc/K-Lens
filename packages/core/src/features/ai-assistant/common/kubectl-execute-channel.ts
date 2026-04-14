/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant의 kubectl 명령 실행을 위한 IPC 채널 정의
 *
 * Renderer Process에서 Main Process로 kubectl 명령 실행 요청을 전송합니다.
 * Main Process에서 Whitelist 검증 후 실행합니다.
 *
 * 📝 주의사항:
 * - @skuberplus/messaging 프레임워크 사용
 * - Whitelist 기반 명령 검증 (Main에서 수행)
 * - HITL 승인은 Renderer에서 처리
 *
 * 🔄 변경이력:
 * - 2025-12-11: 초기 생성 (Tool-Centric 아키텍처 전환)
 */

import { getInjectionToken } from "@ogre-tools/injectable";
import { getRequestChannel } from "@skuberplus/messaging";

import type { ClusterId } from "../../../common/cluster-types";

/**
 * 🎯 kubectl 실행 요청 인자
 */
export interface KubectlExecuteArgs {
  /** 클러스터 ID */
  clusterId: ClusterId;
  /** kubectl 명령 (describe, logs, get, apply, delete 등) */
  command: string;
  /** 명령 인자 배열 (["pod", "nginx", "-n", "default"]) */
  args: string[];
  /** stdin으로 전달할 내용 (YAML 등, kubectl apply -f - 용) */
  stdin?: string;
  /** UI 전용: 100K Hard Limit 잘라내기 건너뛰기 (기본값: false) */
  skipTruncation?: boolean;
}

/**
 * 🎯 kubectl 실행 결과
 */
export interface KubectlExecuteResult {
  /** 실행 성공 여부 */
  success: boolean;
  /** 표준 출력 */
  stdout: string;
  /** 표준 에러 */
  stderr: string;
  /** 종료 코드 */
  exitCode: number;
}

/**
 * 🎯 kubectl 실행 에러 타입
 */
export interface KubectlExecuteError {
  /** 에러 타입 */
  type: "BLOCKED" | "DANGEROUS_FLAG" | "CLUSTER_NOT_FOUND" | "EXECUTION_ERROR";
  /** 에러 메시지 */
  message: string;
}

/**
 * 🎯 kubectl 실행 IPC 응답 (성공 또는 에러)
 */
export type KubectlExecuteResponse =
  | { callWasSuccessful: true; response: KubectlExecuteResult }
  | { callWasSuccessful: false; error: KubectlExecuteError };

/**
 * 🎯 kubectl 실행 IPC 채널
 *
 * Renderer → Main 요청 채널
 */
export const kubectlExecuteChannel = getRequestChannel<KubectlExecuteArgs, KubectlExecuteResponse>(
  "ai-assistant:kubectl-execute",
);

/**
 * 🎯 kubectl 실행 함수 타입
 */
export type KubectlExecute = (args: KubectlExecuteArgs) => Promise<KubectlExecuteResponse>;

/**
 * 🎯 kubectl 실행 DI 토큰
 */
export const kubectlExecuteInjectionToken = getInjectionToken<KubectlExecute>({
  id: "ai-assistant-kubectl-execute",
});

/**
 * 🎯 허용된 kubectl 명령 목록
 *
 * 읽기 명령: HITL 선택적 (설정에 따라)
 * 쓰기 명령: HITL 필수
 *
 * 📝 2026-01-05: 더 많은 kubectl 명령어 추가 (문제 해결 지원 강화)
 */
export const ALLOWED_KUBECTL_COMMANDS = [
  // 읽기 명령
  "get",
  "describe",
  "logs",
  "events",
  "top",
  "explain",
  "api-resources",
  "api-versions",
  "config", // kubectl config 명령어 (컨텍스트 확인)
  "cluster-info", // 클러스터 정보 확인
  "version", // kubectl 버전 확인
  "auth", // 권한 확인 (can-i 등)
  "diff", // YAML 변경 사항 미리보기
  // 쓰기 명령 (HITL 필수)
  "apply",
  "create",
  "delete",
  "patch",
  "scale",
  "rollout",
  "label",
  "annotate",
  "edit", // kubectl edit (HITL 필수)
  "replace", // kubectl replace (HITL 필수)
  "set", // kubectl set (이미지 변경 등, HITL 필수)
  "cordon", // 노드 스케줄링 비활성화 (HITL 필수)
  "uncordon", // 노드 스케줄링 활성화 (HITL 필수)
  "drain", // 노드 드레인 (HITL 필수)
  "taint", // 노드 테인트 (HITL 필수)
  "exec", // Pod 내 명령 실행 (HITL 필수)
  "cp", // 파일 복사 (HITL 필수)
  "port-forward", // 포트 포워딩 (HITL 필수)
  "run", // Pod 실행 (HITL 필수)
  "expose", // 서비스 노출 (HITL 필수)
  "autoscale", // HPA 생성 (HITL 필수)
] as const;

/**
 * 🎯 쓰기 명령 목록 (HITL 필수)
 *
 * 📝 2026-01-05: 더 많은 쓰기 명령어 추가
 */
export const WRITE_KUBECTL_COMMANDS = [
  "apply",
  "create",
  "delete",
  "patch",
  "scale",
  "rollout",
  "label",
  "annotate",
  "edit",
  "replace",
  "set",
  "cordon",
  "uncordon",
  "drain",
  "taint",
  "exec",
  "cp",
  "port-forward",
  "run",
  "expose",
  "autoscale",
] as const;

/**
 * 🎯 차단된 플래그 목록
 *
 * 보안 위험이 있는 플래그들
 */
export const BLOCKED_KUBECTL_FLAGS = [
  "--kubeconfig", // 다른 클러스터 접근 방지
  "--exec", // 임의 코드 실행 방지
  "-o=go-template", // 템플릿 인젝션 방지
  "--template", // 템플릿 인젝션 방지
] as const;

/**
 * 🎯 명령이 허용된 목록에 있는지 확인
 */
export function isAllowedKubectlCommand(command: string): boolean {
  return (ALLOWED_KUBECTL_COMMANDS as readonly string[]).includes(command);
}

/**
 * 🎯 쓰기 명령인지 확인
 */
export function isWriteKubectlCommand(command: string): boolean {
  return (WRITE_KUBECTL_COMMANDS as readonly string[]).includes(command);
}

/**
 * 🎯 위험한 플래그가 있는지 확인
 */
export function hasDangerousKubectlFlags(args: string[]): boolean {
  return args.some((arg) =>
    (BLOCKED_KUBECTL_FLAGS as readonly string[]).some(
      (blockedFlag) => arg === blockedFlag || arg.startsWith(`${blockedFlag}=`),
    ),
  );
}
