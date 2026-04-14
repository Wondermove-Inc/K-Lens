/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { BrowserWindow, Menu } from "electron";
import fs from "fs";
import path from "path";
import { broadcastMainChannel, broadcastMessage, ipcMainHandle, ipcMainOn } from "../../../../common/ipc";
import { clusterSetFrameIdHandler, clusterStates } from "../../../../common/ipc/cluster";
import { IpcRendererNavigationEvents } from "../../../../common/ipc/navigation-events";
import {
  NamespaceFavoritesPayload,
  NavigateInClusterPayload,
  PanelStatePayload,
  PanelSyncPayload,
  panelSyncChannels,
  SaveExplorerUrlPayload,
  SidebarWidthPayload,
} from "../../../../common/ipc/panel-sync";
import { updateBannerChannels } from "../../../../common/ipc/update-banner";
import {
  windowActionHandleChannel,
  windowLocationChangedChannel,
  windowOpenAppMenuAsContextMenuChannel,
} from "../../../../common/ipc/window";
import { getApplicationMenuTemplate } from "../../../../features/application-menu/main/populate-application-menu.injectable";
import { handleWindowAction, onLocationChange } from "../../../ipc/window";
import {
  checkForUpdates,
  downloadUpdate,
  getCurrentUpdateState,
  initAutoUpdater,
  installUpdate,
} from "../../auto-updater";

import type { IpcMainEvent, IpcMainInvokeEvent, PowerMonitor } from "electron";
import type { IComputedValue, ObservableMap } from "mobx";

import type { Cluster } from "../../../../common/cluster/cluster";
import type { ClusterFrameInfo } from "../../../../common/cluster-frames.injectable";
import type { ClusterId } from "../../../../common/cluster-types";
import type { Composite } from "../../../../common/utils/composite/get-composite/get-composite";
import type { MenuItemRoot } from "../../../../features/application-menu/main/application-menu-item-composite.injectable";
import type { ApplicationMenuItemTypes } from "../../../../features/application-menu/main/menu-items/application-menu-item-injection-token";
import type { GetClusterById } from "../../../../features/cluster/storage/common/get-by-id.injectable";

interface Dependencies {
  applicationMenuItemComposite: IComputedValue<Composite<ApplicationMenuItemTypes | MenuItemRoot>>;
  getClusterById: GetClusterById;
  pushCatalogToRenderer: () => void;
  clusterFrames: ObservableMap<string, ClusterFrameInfo>;
  clusters: IComputedValue<Cluster[]>;
  powerMonitor: PowerMonitor;
  directoryForUserData: string;
}

export const setupIpcMainHandlers = ({
  applicationMenuItemComposite,
  getClusterById,
  pushCatalogToRenderer,
  clusterFrames,
  clusters,
  powerMonitor,
  directoryForUserData,
}: Dependencies) => {
  const forwardPanelCommandToCluster = (event: IpcMainEvent, payload: PanelSyncPayload, channel: string) => {
    if (!payload?.clusterId) {
      return;
    }

    const frameInfo = clusterFrames.get(payload.clusterId);

    if (!frameInfo) {
      return;
    }

    event.sender.sendToFrame([frameInfo.processId, frameInfo.frameId], channel, payload);
  };

  const forwardPanelStateToRoot = (event: IpcMainEvent, payload: PanelStatePayload, channel: string) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);

    if (!targetWindow) {
      return;
    }

    targetWindow.webContents.send(channel, payload);
  };

  ipcMainHandle(clusterSetFrameIdHandler, (event: IpcMainInvokeEvent, clusterId: ClusterId) => {
    const cluster = getClusterById(clusterId);

    if (cluster) {
      clusterFrames.set(cluster.id, { frameId: event.frameId, processId: event.processId });
      pushCatalogToRenderer();
    }
  });

  ipcMainHandle(windowActionHandleChannel, (event, action) => handleWindowAction(action));

  ipcMainOn(windowLocationChangedChannel, () => onLocationChange());

  ipcMainHandle(broadcastMainChannel, (event, channel, ...args) => broadcastMessage(channel, ...args));

  ipcMainOn(panelSyncChannels.toggleSidebar, (event, payload: PanelSyncPayload) => {
    forwardPanelCommandToCluster(event, payload, panelSyncChannels.toggleSidebar);
  });

  ipcMainOn(panelSyncChannels.toggleDock, (event, payload: PanelSyncPayload) => {
    forwardPanelCommandToCluster(event, payload, panelSyncChannels.toggleDock);
  });

  // Group status changed: Root Frame → Main → 모든 프레임으로 브로드캐스트
  ipcMainOn(panelSyncChannels.groupStatusChanged, (event, payload?: unknown) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (targetWindow) {
      // 모든 프레임(cluster frame 포함)에 전달
      targetWindow.webContents.send(panelSyncChannels.groupStatusChanged, payload);
      try {
        for (const frame of targetWindow.webContents.mainFrame.frames) {
          try {
            frame.send(panelSyncChannels.groupStatusChanged, payload);
          } catch {
            /* frame destroyed */
          }
        }
      } catch {
        /* mainFrame access error */
      }
    }
  });

  // AI Chat Panel: Cluster Frame → Main → Root Frame (payload 포함 전달)
  ipcMainOn(panelSyncChannels.toggleAiChat, (event, payload?: unknown) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (targetWindow) {
      targetWindow.webContents.send(panelSyncChannels.toggleAiChat, payload);
    }
  });

  /**
   * 🎯 목적: 특정 클러스터 내 네비게이션 (Root → Cluster Frame)
   * Status Bar의 Alerts Popover에서 클러스터 클릭 시 해당 클러스터의 특정 URL로 이동
   *
   * 📝 주의사항:
   * - broadcastMessage와 달리 특정 클러스터에만 메시지 전송
   * - clusterFrames Map에서 clusterId로 frameInfo 조회
   *
   * 🔄 변경이력:
   * - 2025-12-18 - 초기 생성 (Alerts Popover 네비게이션 문제 해결)
   */
  ipcMainOn(panelSyncChannels.navigateInCluster, (event, payload: NavigateInClusterPayload) => {
    if (!payload?.clusterId || !payload?.url) {
      return;
    }

    const frameInfo = clusterFrames.get(payload.clusterId);

    if (!frameInfo) {
      return;
    }

    // 🎯 특정 클러스터 프레임에만 navigation 메시지 전송
    event.sender.sendToFrame(
      [frameInfo.processId, frameInfo.frameId],
      IpcRendererNavigationEvents.NAVIGATE_IN_CLUSTER,
      payload.url,
    );
  });

  ipcMainOn(panelSyncChannels.sidebarStateChanged, (event, payload: PanelStatePayload) => {
    forwardPanelStateToRoot(event, payload, panelSyncChannels.sidebarStateChanged);
  });

  ipcMainOn(panelSyncChannels.dockStateChanged, (event, payload: PanelStatePayload) => {
    forwardPanelStateToRoot(event, payload, panelSyncChannels.dockStateChanged);
  });

  /**
   * 🎯 목적: Explorer URL 저장 (Cluster Frame → Root Frame)
   * Cluster Frame에서 Observability로 이동 시 현재 클러스터 URL을 Root Frame으로 전달
   *
   * 📝 동작:
   * 1. Cluster Frame에서 ipcRenderer.send(saveExplorerUrl, { url })
   * 2. Main Process에서 수신하여 Root Frame으로 전달
   * 3. Root Frame에서 previousExplorerUrl 상태 업데이트
   *
   * 🔄 변경이력:
   * - 2026-01-19 - 초기 생성 (HotBar 화면 전환 복원 기능)
   */
  ipcMainOn(panelSyncChannels.saveExplorerUrl, (event, payload: SaveExplorerUrlPayload) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    targetWindow?.webContents.send(panelSyncChannels.saveExplorerUrl, payload);
  });

  /**
   * 🎯 목적: 사이드바 폭 전역 동기화 (Origin 격리 문제 해결)
   *
   * 📝 배경:
   * - Root Frame과 Cluster Frame이 다른 origin을 가져 localStorage가 격리됨
   * - 사이드바 폭 조절 후 다른 클러스터로 이동하면 폭이 초기화되는 문제 발생
   *
   * 📝 동작:
   * 1. Root Frame에서 사이드바 폭 조절 시 IPC로 Main Process에 전송
   * 2. Main Process에서 캐시에 저장하고 모든 webContents에 브로드캐스트
   * 3. Cluster Frame에서 수신하여 localStorage 업데이트
   *
   * 🔄 변경이력:
   * - 2026-01-19 - 초기 생성 (사이드바 폭 전역 유지 문제 해결)
   */
  let cachedSidebarWidth = 310; // 기본값 (defaultSidebarWidth)

  // 🎯 폭 변경 시 캐시 업데이트 및 모든 Frame에 브로드캐스트
  ipcMainOn(panelSyncChannels.sidebarWidthChanged, (event, payload: SidebarWidthPayload) => {
    cachedSidebarWidth = payload.width;

    // 모든 BrowserWindow의 webContents에 브로드캐스트 (발신자 제외)
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(panelSyncChannels.sidebarWidthChanged, payload);

      // 모든 sub-frame (Cluster Frame 포함)에도 브로드캐스트
      for (const frame of window.webContents.mainFrame.frames) {
        if (frame.routingId !== event.frameId) {
          frame.send(panelSyncChannels.sidebarWidthChanged, payload);
        }
      }
    }
  });

  // 🎯 초기 폭 조회 (Cluster Frame 진입 시)
  ipcMainHandle(panelSyncChannels.getSidebarWidth, () => cachedSidebarWidth);

  /**
   * 🎯 목적: 네임스페이스 즐겨찾기 영속화 (클러스터별)
   *
   * 📝 배경: Cluster Frame의 localStorage는 Origin 격리로 앱 재시작 시 유실됨
   * Main Process에서 JSON 파일로 디스크에 저장하여 재시작 후에도 유지
   *
   * 🔄 변경이력:
   * - 2026-04-13 - 초기 생성 (네임스페이스 즐겨찾기 영속화)
   */
  const favoritesFilePath = path.join(directoryForUserData, "namespace-favorites.json");
  let namespaceFavoritesCache: Record<string, Record<string, string>> = {};

  // 시작 시 파일에서 캐시 로드
  try {
    const raw = fs.readFileSync(favoritesFilePath, "utf-8");
    namespaceFavoritesCache = JSON.parse(raw) as Record<string, Record<string, string>>;
  } catch {
    // 파일 없거나 파싱 실패 시 빈 캐시로 시작
  }

  // 🎯 클러스터별 즐겨찾기 조회
  ipcMainHandle(
    panelSyncChannels.getNamespaceFavorites,
    (_event: IpcMainInvokeEvent, clusterId: string) => namespaceFavoritesCache[clusterId] ?? {},
  );

  // 🎯 클러스터별 즐겨찾기 저장 (캐시 업데이트 + 디스크 기록)
  ipcMainOn(panelSyncChannels.setNamespaceFavorites, (_event: IpcMainEvent, payload: NamespaceFavoritesPayload) => {
    namespaceFavoritesCache[payload.clusterId] = payload.favorites;

    try {
      fs.writeFileSync(favoritesFilePath, JSON.stringify(namespaceFavoritesCache, null, 2), "utf-8");
    } catch {
      // 디스크 기록 실패 시 캐시만 유지 (다음 앱 시작 시 유실될 수 있음)
    }
  });

  // 📝 2026-01-17: AI Chat Panel IPC 핸들러 제거 (Root Frame 마이그레이션)
  // ipcMainOn(panelSyncChannels.aiChatStateChanged, (event, payload: PanelStatePayload) => {
  //   forwardPanelStateToRoot(event, payload, panelSyncChannels.aiChatStateChanged);
  // });

  // 🎯 업데이트 배너 상태 관리
  let isUpdateBannerDismissed = false;
  let dismissTimer: NodeJS.Timeout | null = null;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24시간 (밀리초)

  // 🎯 electron-updater 초기화
  initAutoUpdater();

  // 🎯 getState: Cluster Frame에서도 업데이트 정보를 받을 수 있도록 updateInfo 포함
  ipcMainHandle(updateBannerChannels.getState, () => ({
    dismissed: isUpdateBannerDismissed,
    updateInfo: getCurrentUpdateState(),
  }));

  ipcMainOn(updateBannerChannels.dismiss, () => {
    if (isUpdateBannerDismissed) {
      return;
    }

    isUpdateBannerDismissed = true;

    // 🎯 기존 타이머 클리어
    if (dismissTimer) {
      clearTimeout(dismissTimer);
    }

    // 🎯 24시간 후 배너 다시 표시
    dismissTimer = setTimeout(() => {
      isUpdateBannerDismissed = false;
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(updateBannerChannels.stateChanged, { dismissed: false });
      }
    }, TWENTY_FOUR_HOURS);

    // 즉시 숨김 브로드캐스트
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(updateBannerChannels.stateChanged, { dismissed: true });
    }
  });

  // 🎯 업데이트 체크 핸들러
  ipcMainHandle(updateBannerChannels.checkForUpdate, async () => {
    return await checkForUpdates();
  });

  // 🎯 다운로드 시작 핸들러
  ipcMainHandle(updateBannerChannels.downloadUpdate, async () => {
    return await downloadUpdate();
  });

  // 🎯 설치 (재시작) 핸들러
  ipcMainOn(updateBannerChannels.installUpdate, () => {
    installUpdate();
  });

  ipcMainOn(windowOpenAppMenuAsContextMenuChannel, async (event) => {
    const electronTemplate = getApplicationMenuTemplate(applicationMenuItemComposite.get());
    const menu = Menu.buildFromTemplate(electronTemplate);

    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      menu.popup({ window, x: 20, y: 20 });
    }
  });

  ipcMainHandle(clusterStates, () =>
    clusters.get().map((cluster) => ({
      id: cluster.id,
      state: cluster.getState(),
    })),
  );

  // 🎯 절전(노트북 덮기) 복귀 시 모든 렌더러에 알림 → 토큰 갱신 Reaction 트리거
  powerMonitor.on("resume", () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("auth:system-resumed");
    }
  });
};
