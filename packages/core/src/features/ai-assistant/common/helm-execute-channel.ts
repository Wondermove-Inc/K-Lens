/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant의 Helm 명령 실행을 위한 IPC 채널 정의
 *
 * @description
 * - kubectl-execute-channel.ts 패턴을 그대로 따름
 * - clusterId로 DAIVE 선택 클러스터 바인딩
 * - 화이트리스트 기반 명령 검증
 * - 위험 플래그 차단
 *
 * 📝 주의사항:
 * - @skuberplus/messaging 프레임워크 사용
 * - Whitelist 기반 명령 검증 (Main에서 수행)
 * - HITL 승인은 Renderer에서 처리
 *
 * 🔄 변경이력:
 * - 2026-01-08: 초기 생성 (Helm 전용 채널 구현)
 */

import { getInjectionToken } from "@ogre-tools/injectable";
import { getRequestChannel } from "@skuberplus/messaging";

import type { ClusterId } from "../../../common/cluster-types";

// ============================================
// 🎯 인터페이스 정의
// ============================================

/**
 * 🎯 Helm 실행 요청 인자
 *
 * kubectl과 동일하게 clusterId로 클러스터 바인딩
 */
export interface HelmExecuteArgs {
  /** 클러스터 ID - DAIVE 선택 클러스터 바인딩 (핵심!) */
  clusterId: ClusterId;
  /** Helm 명령 (install, upgrade, list, uninstall 등) */
  command: string;
  /** 명령 인자 배열 (["nginx", "bitnami/nginx", "-n", "default"]) */
  args: string[];
  /** stdin으로 전달할 내용 (values.yaml 등, helm install -f - 용) */
  stdin?: string;
}

/**
 * 🎯 Helm 실행 결과
 */
export interface HelmExecuteResult {
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
 * 🎯 Helm 실행 에러 타입
 *
 * kubectl과 달리 NOT_INSTALLED 추가 (Helm은 외부 설치 필요)
 */
export interface HelmExecuteError {
  /** 에러 타입 */
  type: "BLOCKED" | "DANGEROUS_FLAG" | "CLUSTER_NOT_FOUND" | "NOT_INSTALLED" | "EXECUTION_ERROR";
  /** 에러 메시지 */
  message: string;
  /** 설치 안내 등 제안 메시지 */
  suggestion?: string;
}

/**
 * 🎯 Helm 실행 IPC 응답 (성공 또는 에러)
 */
export type HelmExecuteResponse =
  | { callWasSuccessful: true; response: HelmExecuteResult }
  | { callWasSuccessful: false; error: HelmExecuteError };

// ============================================
// 🎯 IPC 채널 및 DI 토큰 정의
// ============================================

/**
 * 🎯 Helm 실행 IPC 채널
 *
 * Renderer → Main 요청 채널
 */
export const helmExecuteChannel = getRequestChannel<HelmExecuteArgs, HelmExecuteResponse>("ai-assistant:helm-execute");

/**
 * 🎯 Helm 실행 함수 타입
 */
export type HelmExecute = (args: HelmExecuteArgs) => Promise<HelmExecuteResponse>;

/**
 * 🎯 Helm 실행 DI 토큰
 */
export const helmExecuteInjectionToken = getInjectionToken<HelmExecute>({
  id: "ai-assistant-helm-execute",
});

// ============================================
// 🎯 화이트리스트 정의
// ============================================

/**
 * 🎯 허용된 Helm 명령 목록 (20개)
 *
 * 읽기 명령 (14개): HITL 선택적
 * 쓰기 명령 (6개): HITL 필수
 */
export const ALLOWED_HELM_COMMANDS = [
  // 읽기 명령 (14개)
  "list", // 릴리즈 목록
  "get", // 릴리즈 정보 (values, manifest, notes, hooks, all)
  "history", // 릴리즈 이력
  "status", // 릴리즈 상태
  "show", // 차트 정보 (all, chart, readme, values, crds)
  "search", // 차트 검색 (hub, repo)
  "repo", // 리포지토리 관리 (list, add, update, remove)
  "env", // Helm 환경 정보
  "version", // Helm 버전
  "template", // 템플릿 렌더링 (dry-run)
  "lint", // 차트 린트
  "dependency", // 차트 의존성 (build, list, update)
  "pull", // 차트 다운로드
  "create", // 차트 생성
  // 쓰기 명령 (6개)
  "install", // 차트 설치
  "upgrade", // 릴리즈 업그레이드
  "uninstall", // 릴리즈 삭제
  "rollback", // 릴리즈 롤백
  "test", // 릴리즈 테스트
  "push", // 차트 업로드
] as const;

/**
 * 🎯 쓰기 명령 목록 (HITL 필수)
 */
export const WRITE_HELM_COMMANDS = ["install", "upgrade", "uninstall", "rollback", "test", "push"] as const;

/**
 * 🎯 차단된 Helm 플래그 목록
 *
 * 보안 위험이 있는 플래그들
 */
export const BLOCKED_HELM_FLAGS = [
  "--kubeconfig", // 다른 클러스터 접근 방지
  "--kube-context", // 다른 컨텍스트 접근 방지
  "--post-renderer", // 임의 코드 실행 방지
] as const;

// ============================================
// 🎯 검증 함수
// ============================================

/**
 * 🎯 명령이 허용된 목록에 있는지 확인
 *
 * @param command - 검증할 Helm 명령
 * @returns 허용 여부
 */
export function isAllowedHelmCommand(command: string): boolean {
  return (ALLOWED_HELM_COMMANDS as readonly string[]).includes(command);
}

/**
 * 🎯 쓰기 명령인지 확인 (HITL 승인 필요 여부 판단)
 *
 * @param command - 검증할 Helm 명령
 * @returns 쓰기 명령 여부
 */
export function isWriteHelmCommand(command: string): boolean {
  return (WRITE_HELM_COMMANDS as readonly string[]).includes(command);
}

/**
 * 🎯 위험한 플래그가 있는지 확인
 *
 * @param args - 명령 인자 배열
 * @returns 위험 플래그 포함 여부
 *
 * 📝 검증 방식:
 * - --kubeconfig (정확히 일치)
 * - --kubeconfig=/path/to/config (= 포함 형태)
 */
export function hasDangerousHelmFlags(args: string[]): boolean {
  return args.some((arg) =>
    (BLOCKED_HELM_FLAGS as readonly string[]).some(
      (blockedFlag) => arg === blockedFlag || arg.startsWith(`${blockedFlag}=`),
    ),
  );
}
