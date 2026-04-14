/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 업데이트 배너 관련 IPC 채널 정의
 *
 * 📝 주의사항:
 * - 기존 채널(getState, dismiss, stateChanged)은 배너 dismiss 상태 관리용
 * - 새로운 채널들은 electron-updater 통합용
 */
export const updateBannerChannels = {
  // 기존 채널 (배너 dismiss 상태 관리)
  getState: "update-banner:get-state",
  dismiss: "update-banner:dismiss",
  stateChanged: "update-banner:state-changed",

  // 새로운 채널 (electron-updater 통합)
  checkForUpdate: "update-banner:check-for-update", // 업데이트 체크 요청
  downloadUpdate: "update-banner:download-update", // 다운로드 시작
  installUpdate: "update-banner:install-update", // 설치 (재시작)
  updateAvailable: "update-banner:update-available", // 업데이트 발견 알림
  updateNotAvailable: "update-banner:update-not-available", // 업데이트 없음
  downloadProgress: "update-banner:download-progress", // 다운로드 진행률
  updateDownloaded: "update-banner:update-downloaded", // 다운로드 완료
  updateError: "update-banner:update-error", // 에러 발생
} as const;

/**
 * 🎯 배너 상태 페이로드 (getState 응답)
 *
 * 📝 주의사항:
 * - Cluster Frame에서도 업데이트 정보를 받을 수 있도록 updateInfo 포함
 * - updateInfo는 업데이트가 발견된 경우에만 값이 있음
 */
export interface UpdateBannerStatePayload {
  dismissed: boolean;
  updateInfo?: {
    version: string;
    status: "idle" | "downloading" | "ready";
  } | null;
}

/**
 * 🎯 업데이트 정보 페이로드
 */
export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

/**
 * 🎯 다운로드 진행률 페이로드
 */
export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

/**
 * 🎯 업데이트 상태 타입
 */
export type UpdateStatus = "idle" | "checking" | "downloading" | "ready" | "error";
