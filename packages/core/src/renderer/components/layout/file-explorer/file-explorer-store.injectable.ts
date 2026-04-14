/**
 * 🎯 목적: FileExplorerStore DI Injectable 설정
 * 📝 기능:
 *   - FileExplorerStore를 DI 컨테이너에 등록
 *   - logger 의존성 주입
 *   - 싱글톤 라이프사이클 (애플리케이션 전체에서 1개 인스턴스 유지)
 *   - UserPreferences와 연동하여 설정 변경 시 자동 반영
 *   - AI 파일 변경 알림 수신 시 자동 새로고침
 *   - 파일 시스템 변경 감지 시 자동 새로고침 (Chokidar)
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 *   - 2026-01-25: FIX-001 - 싱글톤 lifecycle 추가 (클러스터 전환 시 상태 유지)
 *   - 2026-01-26: FIX-038 - UserPreferences 연동 (기본 폴더 설정, 숨김 파일 설정)
 *   - 2026-01-29: Phase 3 - AI 파일 변경 알림 수신 및 자동 갱신
 *   - 2026-01-30: FIX-041 - 파일 시스템 Watcher 연동 (Chokidar 기반)
 * @module file-explorer/file-explorer-store.injectable
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { ipcRenderer } from "electron";
import { reaction } from "mobx";
import * as path from "path";
import { fileSystemChannels } from "../../../../common/ipc/filesystem";
import {
  AI_FILE_CHANGE_CHANNEL,
  type AIFileChangeNotification,
} from "../../../../features/ai-assistant/common/ai-file-channels";
import userPreferencesStateInjectable from "../../../../features/user-preferences/common/state.injectable";
import { FileExplorerStore } from "./file-explorer-store";

/**
 * 🆕 FIX-041: 파일 시스템 변경 알림 인터페이스
 * Main Process의 Chokidar watcher에서 전송
 */
interface FileSystemChangeNotification {
  /** 변경된 파일 경로 목록 */
  paths: string[];
  /** 감시 중인 루트 경로 */
  rootPath: string;
  /** 타임스탬프 */
  timestamp: number;
}

/**
 * 🎯 FIX: 경로가 rootPath 내부에 있는지 안전하게 확인
 *
 * startsWith만 사용하면 /safe와 /safe2가 혼동될 수 있음.
 * path.sep을 사용하여 정확한 경로 prefix 매칭 수행.
 *
 * @param notificationPath - 변경된 파일의 전체 경로
 * @param rootPath - File Explorer의 루트 경로
 * @returns 경로가 rootPath 내부에 있으면 true
 */
function isPathWithinRoot(notificationPath: string, rootPath: string): boolean {
  // 경로 정규화 (끝의 / 제거)
  const normalizedRoot = rootPath.endsWith(path.sep) ? rootPath.slice(0, -1) : rootPath;
  const normalizedPath = notificationPath.endsWith(path.sep) ? notificationPath.slice(0, -1) : notificationPath;

  // 정확히 같은 경로이거나, rootPath의 하위 경로인 경우
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + path.sep);
}

/**
 * FileExplorerStore Injectable
 * 📝 파일 탐색기 상태 관리 Store를 DI 컨테이너에 등록
 * 📝 싱글톤: 클러스터 전환 시에도 폴더 펼침 상태, 열린 폴더 경로 등 유지
 * 📝 FIX-038: UserPreferences와 연동하여 설정 변경 시 자동 반영
 */
const fileExplorerStoreInjectable = getInjectable({
  id: "file-explorer-store",
  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const userPreferencesState = di.inject(userPreferencesStateInjectable);

    const store = new FileExplorerStore(logger, userPreferencesState);

    // 🎯 FIX-038: Settings의 기본 폴더 경로 변경 시 File Explorer 자동 업데이트
    reaction(
      () => userPreferencesState.fileExplorerDefaultPath,
      async (newPath) => {
        if (newPath) {
          logger.info(`[FileExplorerStore] Default path changed in settings: ${newPath}`);
          await store.openFolder(newPath);
        }
      },
    );

    // 🎯 FIX-038: Settings의 숨김 파일 설정 변경 시 File Explorer 자동 업데이트
    reaction(
      () => userPreferencesState.fileExplorerShowHiddenFiles,
      (showHidden) => {
        const currentShowHidden = store.showHiddenFiles;
        if (showHidden !== currentShowHidden) {
          logger.info(`[FileExplorerStore] Show hidden files changed in settings: ${showHidden}`);
          store.setShowHiddenFiles(showHidden ?? false);
        }
      },
    );

    // 🎯 Phase 2: 공유 디바운스 refresh
    // AI 채널과 Chokidar 채널 모두 동일한 디바운스 타이머를 공유하여
    // 동시에 들어오는 알림이 단 1회의 refresh만 트리거하도록 보장
    const REFRESH_DEBOUNCE_MS = 500;
    let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefresh = () => {
      if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
      }
      refreshDebounceTimer = setTimeout(async () => {
        refreshDebounceTimer = null;
        logger.info(`[FileExplorerStore] Executing debounced refresh...`);
        await store.refresh();
        logger.info(`[FileExplorerStore] Debounced refresh completed`);
      }, REFRESH_DEBOUNCE_MS);
    };

    // 🎯 Phase 3: AI 파일 변경 알림 수신 시 자동 새로고침
    // Main Process에서 AI가 파일 작업 시 (write, delete, create_dir) 알림 수신
    ipcRenderer.on(AI_FILE_CHANGE_CHANNEL, (_event, notification: AIFileChangeNotification) => {
      logger.info(
        `[FileExplorerStore] AI file change received: action=${notification.action}, path=${notification.path}`,
      );

      // 현재 열린 폴더 내의 파일이 변경된 경우에만 새로고침
      // 🎯 FIX: path.sep을 사용한 안전한 경로 비교 (/safe vs /safe2 혼동 방지)
      if (store.rootPath && isPathWithinRoot(notification.path, store.rootPath)) {
        debouncedRefresh();
      } else {
        logger.info(`[FileExplorerStore] Path not within root or no rootPath set, skipping refresh`);
      }
    });

    // 🆕 FIX-041: 파일 시스템 변경 알림 수신 (Chokidar watcher)
    // 어디서든 파일이 변경되면 (AI, 에디터, 외부 프로그램 등) 자동 새로고침
    ipcRenderer.on(fileSystemChannels.fileChanged, (_event, notification: FileSystemChangeNotification) => {
      logger.info(`[FileExplorerStore] File system change detected: ${notification.paths.length} files changed`);

      // 현재 열린 폴더와 일치하는 경우에만 새로고침
      if (store.rootPath && notification.rootPath === store.rootPath) {
        debouncedRefresh();
      }
    });

    return store;
  },
  lifecycle: lifecycleEnum.singleton,
});

export default fileExplorerStoreInjectable;
