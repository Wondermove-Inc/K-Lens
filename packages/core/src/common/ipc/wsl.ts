/**
 * 🎯 목적: WSL (Windows Subsystem for Linux) IPC 채널 정의
 * 📝 기능:
 *   - IPC 채널명 상수 정의
 *   - WSL 상태 및 배포판 조회 타입 정의
 * 🔄 변경이력:
 *   - 2026-02-03: WSL UX 개선 - 초기 구현
 * @module common/ipc/wsl
 */

/**
 * WSL IPC 채널명
 */
export const wslChannels = {
  /** WSL 설치 상태 확인 */
  getStatus: "wsl:getStatus",
  /** WSL 배포판 목록 조회 */
  getDistros: "wsl:getDistros",
} as const;

/**
 * WSL 설치 상태 응답
 */
export interface WslStatusResponse {
  /** WSL 설치 여부 */
  installed: boolean;
  /** 에러 메시지 (설치 확인 실패 시) */
  error?: string;
}

/**
 * WSL 배포판 목록 응답
 */
export interface WslDistrosResponse {
  /** 성공 여부 */
  success: boolean;
  /** 배포판 이름 목록 */
  distros: string[];
  /** 기본 배포판 이름 */
  defaultDistro?: string;
  /** 에러 메시지 */
  error?: string;
}
