/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: electron-updater 초기화 및 설정
 *
 * 📝 주의사항:
 * - 로컬 테스트: http://localhost:8080 사용
 * - 프로덕션: S3 URL로 변경 필요
 * - 자동 다운로드 비활성화 (수동 다운로드)
 *
 * 🔄 변경이력: 2025-12-02 - 초기 생성
 */

import { BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { updateBannerChannels } from "../../common/ipc/update-banner";

import type { UpdateInfo as ElectronUpdateInfo, ProgressInfo, UpdateDownloadedEvent } from "electron-updater";

// 🎯 업데이트 서버 URL 설정
const UPDATE_SERVER_URL = process.env.UPDATE_SERVER_URL || "http://localhost:8080";

// 🎯 현재 업데이트 상태 저장 (Cluster Frame에서 조회 가능하도록)
let currentUpdateInfo: ElectronUpdateInfo | null = null;
let currentUpdateStatus: "idle" | "downloading" | "ready" = "idle";

/**
 * 🎯 현재 업데이트 상태 조회
 *
 * 📝 주의사항:
 * - Cluster Frame이 마운트될 때 getState IPC로 이 정보를 받아감
 * - 업데이트가 발견되지 않은 경우 null 반환
 */
export function getCurrentUpdateState(): { version: string; status: "idle" | "downloading" | "ready" } | null {
  if (!currentUpdateInfo) {
    return null;
  }

  return {
    version: currentUpdateInfo.version,
    status: currentUpdateStatus,
  };
}

/**
 * 🎯 모든 윈도우에 메시지 브로드캐스트
 */
function broadcastToAllWindows(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
}

/**
 * 🎯 electron-updater 초기화
 *
 * 📝 주의사항:
 * - 개발 모드에서는 업데이트 체크 비활성화 권장
 * - app.isPackaged로 환경 구분
 */
export function initAutoUpdater(): void {
  // 개발 모드에서는 로깅만 활성화
  autoUpdater.logger = console;

  // 자동 다운로드 비활성화 (수동 다운로드)
  autoUpdater.autoDownload = false;

  // 앱 종료 시 자동 설치
  autoUpdater.autoInstallOnAppQuit = true;

  // 업데이트 서버 URL 설정
  autoUpdater.setFeedURL({
    provider: "generic",
    url: UPDATE_SERVER_URL,
  });

  // 🎯 업데이트 발견 이벤트
  autoUpdater.on("update-available", (info: ElectronUpdateInfo) => {
    console.log("[auto-updater] 업데이트 발견:", info.version);

    // 🎯 상태 저장 (Cluster Frame에서 조회 가능하도록)
    currentUpdateInfo = info;
    currentUpdateStatus = "idle";

    broadcastToAllWindows(updateBannerChannels.updateAvailable, {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // 🎯 업데이트 없음 이벤트
  autoUpdater.on("update-not-available", () => {
    console.log("[auto-updater] 최신 버전입니다.");
    broadcastToAllWindows(updateBannerChannels.updateNotAvailable, {});
  });

  // 🎯 다운로드 진행률 이벤트
  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    console.log(`[auto-updater] 다운로드 진행률: ${progress.percent.toFixed(1)}%`);

    // 🎯 상태 업데이트
    currentUpdateStatus = "downloading";

    broadcastToAllWindows(updateBannerChannels.downloadProgress, {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      total: progress.total,
      transferred: progress.transferred,
    });
  });

  // 🎯 다운로드 완료 이벤트
  autoUpdater.on("update-downloaded", (info: UpdateDownloadedEvent) => {
    console.log("[auto-updater] 다운로드 완료:", info.version);

    // 🎯 상태 업데이트
    currentUpdateStatus = "ready";

    broadcastToAllWindows(updateBannerChannels.updateDownloaded, {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // 🎯 에러 이벤트
  autoUpdater.on("error", (error: Error) => {
    console.error("[auto-updater] 에러:", error.message);
    broadcastToAllWindows(updateBannerChannels.updateError, {
      message: error.message,
    });
  });

  console.log(`[auto-updater] 초기화 완료 (서버: ${UPDATE_SERVER_URL})`);
}

/**
 * 🎯 업데이트 체크
 */
export async function checkForUpdates(): Promise<{ success: boolean; updateInfo?: unknown; error?: string }> {
  try {
    console.log("[auto-updater] 업데이트 체크 시작...");
    const result = await autoUpdater.checkForUpdates();

    return { success: true, updateInfo: result?.updateInfo };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";

    console.error("[auto-updater] 업데이트 체크 실패:", errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 🎯 업데이트 다운로드
 */
export async function downloadUpdate(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("[auto-updater] 다운로드 시작...");
    await autoUpdater.downloadUpdate();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";

    console.error("[auto-updater] 다운로드 실패:", errorMessage);

    return { success: false, error: errorMessage };
  }
}

/**
 * 🎯 업데이트 설치 (앱 재시작)
 */
export function installUpdate(): void {
  console.log("[auto-updater] 업데이트 설치 및 재시작...");
  autoUpdater.quitAndInstall();
}
