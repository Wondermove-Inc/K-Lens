/**
 * 🎯 목적: kubectl 파일 기반 IPC 채널 정의
 * 📝 기능:
 *   - GUI 에디터/파일 탐색기에서 kubectl apply/delete/diff 실행
 *   - 클러스터별 kubeconfig 적용
 *   - 타임아웃 30초
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 *   - 2026-01-25: FIX-030 - messaging 패턴으로 변경 (getRequestChannel 사용)
 * @module ipc/kubectl-apply
 */

import { getRequestChannel } from "@skuberplus/messaging";

import type { ClusterId } from "../cluster-types";

/**
 * kubectl 파일 기반 작업 요청 인터페이스
 */
export interface KubectlFileRequest {
  /** 클러스터 ID */
  clusterId: ClusterId;
  /** 적용할 YAML/JSON 파일 경로 */
  filePath: string;
  /** 드라이런 모드 여부 (apply 전용) */
  dryRun?: boolean;
}

/**
 * kubectl 파일 기반 작업 응답 인터페이스
 */
export interface KubectlFileResponse {
  /** 성공 여부 */
  success: boolean;
  /** stdout 출력 */
  stdout: string;
  /** stderr 출력 */
  stderr: string;
  /** 종료 코드 */
  exitCode: number;
}

/**
 * kubectl apply (파일 기반) 채널
 * 📝 파일 경로를 받아 kubectl apply -f 실행
 */
export const kubectlApplyFileChannel = getRequestChannel<KubectlFileRequest, KubectlFileResponse>("kubectl-apply-file");

/**
 * kubectl delete (파일 기반) 채널
 * 📝 파일 경로를 받아 kubectl delete -f 실행
 */
export const kubectlDeleteFileChannel = getRequestChannel<KubectlFileRequest, KubectlFileResponse>(
  "kubectl-delete-file",
);

/**
 * kubectl diff (파일 기반) 채널
 * 📝 파일 경로를 받아 kubectl diff -f 실행
 */
export const kubectlDiffFileChannel = getRequestChannel<KubectlFileRequest, KubectlFileResponse>("kubectl-diff-file");

// ============================================================================
// 🚧 레거시 호환성 (deprecated - 추후 제거 예정)
// ============================================================================

/**
 * @deprecated kubectlApplyFileChannel 사용
 */
export const kubectlApplyChannels = {
  apply: "gui-editor:kubectl-apply",
} as const;

/**
 * @deprecated KubectlFileRequest 사용
 */
export interface KubectlApplyRequest {
  clusterId: string;
  filePath: string;
  dryRun?: boolean;
  timeout?: number;
}

/**
 * @deprecated KubectlFileResponse 사용
 */
export interface KubectlApplyResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

/**
 * kubectl apply 기본 타임아웃 (30초)
 */
export const KUBECTL_APPLY_TIMEOUT_MS = 30000;
