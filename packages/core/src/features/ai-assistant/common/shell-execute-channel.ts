/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant의 외부 CLI 도구 실행을 위한 IPC 채널 정의
 *
 * Renderer Process에서 Main Process로 shell 명령 실행 요청을 전송합니다.
 * Main Process에서 Whitelist 검증 후 실행합니다.
 *
 * 📝 주의사항:
 * - 화이트리스트에 있는 CLI만 실행 가능 (stern, kubectx, kubens 등)
 * - 설치되지 않은 CLI는 설치 안내 메시지 반환
 * - 모든 shell 명령은 HITL 승인 필요
 * - helm은 별도 채널 사용 (helm-execute-channel.ts)
 * - k9s는 interactive TUI로 shell-execute 부적합
 *
 * 🔄 변경이력:
 * - 2025-12-11: 초기 생성 (Tool-Centric 아키텍처 전환)
 * - 2026-01-09: helm, k9s 제거 (helm 전용 채널 분리, k9s interactive 부적합)
 */

import { getInjectionToken } from "@ogre-tools/injectable";
import { getRequestChannel } from "@skuberplus/messaging";

/**
 * 🎯 shell 실행 요청 인자
 */
export interface ShellExecuteArgs {
  /** CLI 명령 (stern, kubectx, kubens 등) */
  command: string;
  /** 명령 인자 배열 */
  args: string[];
}

/**
 * 🎯 shell 실행 결과
 */
export interface ShellExecuteResult {
  /** 실행 성공 여부 */
  success: boolean;
  /** 표준 출력 */
  stdout: string;
  /** 표준 에러 */
  stderr: string;
}

/**
 * 🎯 shell 실행 에러 타입
 */
export interface ShellExecuteError {
  /** 에러 타입 */
  type: "NOT_ALLOWED" | "NOT_INSTALLED" | "EXECUTION_ERROR";
  /** 에러 메시지 */
  message: string;
  /** 해결 제안 (설치 명령 등) */
  suggestion?: string;
}

/**
 * 🎯 shell 실행 IPC 응답 (성공 또는 에러)
 */
export type ShellExecuteResponse =
  | { callWasSuccessful: true; response: ShellExecuteResult }
  | { callWasSuccessful: false; error: ShellExecuteError };

/**
 * 🎯 shell 실행 IPC 채널
 *
 * Renderer → Main 요청 채널
 */
export const shellExecuteChannel = getRequestChannel<ShellExecuteArgs, ShellExecuteResponse>(
  "ai-assistant:shell-execute",
);

/**
 * 🎯 shell 실행 함수 타입
 */
export type ShellExecute = (args: ShellExecuteArgs) => Promise<ShellExecuteResponse>;

/**
 * 🎯 shell 실행 DI 토큰
 */
export const shellExecuteInjectionToken = getInjectionToken<ShellExecute>({
  id: "ai-assistant-shell-execute",
});

/**
 * 🎯 허용된 CLI 도구 목록
 *
 * 이 목록에 있는 CLI만 실행 가능
 *
 * 📝 2026-01-05: 더 많은 Kubernetes 관련 CLI 추가
 * 📝 2026-01-09: helm 제거 (helm-execute-channel.ts로 이동)
 * 📝 2026-01-09: k9s 제거 (interactive TUI, shell-execute 부적합)
 */
export const ALLOWED_SHELL_COMMANDS = [
  // 로그 및 모니터링
  "stern", // 다중 Pod 로그 스트리밍
  // 컨텍스트/네임스페이스 관리
  "kubectx", // 컨텍스트 전환
  "kubens", // 네임스페이스 전환
  // 진단 도구
  "kustomize", // Kustomize 빌드
  "jq", // JSON 처리
  "yq", // YAML 처리
  // 네트워크 진단
  "ping", // 네트워크 연결 확인
  "traceroute", // 네트워크 경로 추적
  "nslookup", // DNS 조회
  "dig", // DNS 디버깅
  "host", // DNS 조회
  // 프로세스/시스템 정보
  "ps", // 프로세스 목록
  "top", // 프로세스 모니터링
  "htop", // 향상된 프로세스 모니터링
  // 파일 시스템 (읽기 전용)
  "ls", // 디렉토리 목록
  "cat", // 파일 내용 보기
  "less", // 파일 페이징
  "head", // 파일 앞부분
  "tail", // 파일 뒷부분 (로그 모니터링)
  "grep", // 텍스트 검색
  "find", // 파일 찾기
  "which", // 명령어 위치 찾기
  "whoami", // 현재 사용자
  "pwd", // 현재 디렉토리
  "env", // 환경 변수
  "echo", // 텍스트 출력
  "date", // 날짜/시간
] as const;

/**
 * 🎯 차단된 CLI 명령 목록
 *
 * 보안 위험이 있는 명령들
 */
export const BLOCKED_SHELL_COMMANDS = [
  "rm", // 파일 삭제
  "rmdir", // 디렉토리 삭제
  "sudo", // 권한 상승
  "su", // 사용자 전환
  "chmod", // 권한 변경
  "chown", // 소유자 변경
  "bash", // 쉘 실행
  "sh", // 쉘 실행
  "zsh", // 쉘 실행
  "eval", // 코드 실행
  "source", // 스크립트 실행
  ".", // 스크립트 실행
  "export", // 환경 변수 설정
  "unset", // 환경 변수 삭제
  "kill", // 프로세스 종료
  "killall", // 프로세스 종료
  "pkill", // 프로세스 종료
  "reboot", // 시스템 재시작
  "shutdown", // 시스템 종료
  "poweroff", // 전원 끄기
  "init", // 시스템 초기화
  "systemctl", // 서비스 관리
  "service", // 서비스 관리
  "mount", // 파일시스템 마운트
  "umount", // 파일시스템 언마운트
  "dd", // 디스크 덤프
  "mkfs", // 파일시스템 생성
  "fdisk", // 디스크 파티션
  "parted", // 디스크 파티션
] as const;

/**
 * 🎯 CLI 설치 방법 매핑
 *
 * 📝 2026-01-09: helm, k9s 제거 (helm은 전용 채널, k9s는 interactive TUI)
 */
export const CLI_INSTALL_SUGGESTIONS: Record<string, string> = {
  stern: "brew install stern",
  kubectx: "brew install kubectx",
  kubens: "brew install kubectx", // kubens는 kubectx 패키지에 포함
  kustomize: "brew install kustomize",
  jq: "brew install jq",
  yq: "brew install yq",
  htop: "brew install htop",
};

/**
 * 🎯 명령이 허용된 목록에 있는지 확인
 */
export function isAllowedShellCommand(command: string): boolean {
  return (ALLOWED_SHELL_COMMANDS as readonly string[]).includes(command);
}

/**
 * 🎯 명령이 차단된 목록에 있는지 확인
 */
export function isBlockedShellCommand(command: string): boolean {
  return (BLOCKED_SHELL_COMMANDS as readonly string[]).includes(command);
}

/**
 * 🎯 CLI 설치 제안 메시지 반환
 */
export function getInstallSuggestion(command: string): string | undefined {
  return CLI_INSTALL_SUGGESTIONS[command];
}
