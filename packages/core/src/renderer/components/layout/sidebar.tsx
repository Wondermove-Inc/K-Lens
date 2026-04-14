/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: shadcn app-sidebar.tsx 기반 DAIVE 클러스터 사이드바
 * 📝 변경: 파일 트리 → 클러스터 트리로 데이터 교체
 * 🎨 스타일: shadcn UI 구조 100% 유지 (ShadcnSidebar, Collapsible, ChevronRight 애니메이션 등)
 * 🔄 변경이력:
 * - 2025-10-22: shadcn 스타일 기반 마이그레이션 (네이밍 충돌 해결)
 * - 2026-01-19: - 긴 클러스터 이름 Tooltip 추가 (hover 시 전체 이름 표시)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
// 🎯 DAIVE DI injectables (9개)
import { sidebarItemsInjectable } from "@skuberplus/cluster-sidebar";
import { ipcRenderer } from "electron";
// 🎯 lucide-react 아이콘 (shadcn 표준)
// 📝 Server: 클러스터 트리 아이콘 + 비활성 상태 기본 아이콘, Settings: 드롭다운 메뉴 "클러스터 설정" 아이콘
import { ChevronRight, ChevronsUpDown, Plus, RefreshCw, Server, Settings } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
// 🎯 DAIVE 유틸리티
import { isKubernetesCluster } from "../../../common/catalog-entities/kubernetes-cluster";
import navigateToCatalogInjectable from "../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import navigateToClusterViewInjectable from "../../../common/front-end-routing/routes/cluster-view/navigate-to-cluster-view.injectable";
import navigateToEntitySettingsInjectable from "../../../common/front-end-routing/routes/entity-settings/navigate-to-entity-settings.injectable";
import { fileSystemChannels, type ReadFileResponse } from "../../../common/ipc/filesystem";
import openPathPickingDialogInjectable from "../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import openAddClusterDialogInjectable from "../../components/add-cluster/add-dialog/open.injectable";
import addSyncEntriesInjectable from "../../initializers/add-sync-entries.injectable";
import { cn } from "../../lib/utils";
// 🆕 MainTabStore for file opening
import mainTabStoreInjectable from "../main-tabs/main-tab-store.injectable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../shadcn-ui/collapsible";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../shadcn-ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../shadcn-ui/dropdown-menu";
// 🎯 shadcn UI 컴포넌트 (app-sidebar.tsx 기준) - alias 사용으로 네이밍 충돌 방지
import {
  Sidebar as ShadcnSidebar,
  SidebarContent as ShadcnSidebarContent,
  SidebarFooter as ShadcnSidebarFooter,
  SidebarHeader as ShadcnSidebarHeader,
  SidebarMenu as ShadcnSidebarMenu,
  SidebarMenuButton as ShadcnSidebarMenuButton,
  SidebarMenuItem as ShadcnSidebarMenuItem,
  SidebarMenuSub as ShadcnSidebarMenuSub,
  SidebarRail as ShadcnSidebarRail,
} from "../shadcn-ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../shadcn-ui/tooltip";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
// 🆕 FileExplorer integration
import { FileExplorer } from "./file-explorer";
import { createSidebarButtonStyle, createSidebarLineStyle, SIDEBAR_LINE_BASE_REM, SidebarItem } from "./sidebar-item";
import styles from "./sidebar-shadcn.module.scss";
import sidebarStorageInjectable from "./sidebar-storage/sidebar-storage.injectable";

import type { KubernetesCluster } from "../../../common/catalog-entities/kubernetes-cluster";
import type { MainTabStore } from "../main-tabs/main-tab-store";
import "./sidebar-shadcn-overrides.scss";
import {
  type DownloadProgress,
  type UpdateBannerStatePayload,
  type UpdateInfo,
  type UpdateStatus,
  updateBannerChannels,
} from "../../../common/ipc/update-banner";
import { ClusterSettingsDialog } from "../cluster-settings-dialog/cluster-settings-dialog";
import clusterSettingsDialogStateInjectable from "../cluster-settings-dialog/cluster-settings-dialog-state.injectable";
import {
  clusterHasActiveConnection,
  clusterHasConnectionHistory,
  getClusterOrderingIds,
  getLastSeenTimestamp,
} from "./cluster-ordering";
import {
  clusterOrderingSessionState,
  markClusterHistoryInitialized,
  markClusterOrderInitialized,
  resetClusterHistorySessionState,
  syncClusterOrderSnapshot,
} from "./cluster-ordering-session-state";
// 🎯 Cloud Provider 아이콘 및 유틸리티
import { ClusterProviderIcon } from "./cluster-provider-icon";
import { getProviderInfo, inferCloudProvider } from "./cluster-provider-utils";
import { UpdateBanner } from "./update-banner";

// 🎯 타입 정의
import type { SidebarItemDeclaration } from "@skuberplus/cluster-sidebar";

import type { IComputedValue } from "mobx";

import type { NavigateToCatalog } from "../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import type { NavigateToClusterView } from "../../../common/front-end-routing/routes/cluster-view/navigate-to-cluster-view.injectable";
import type { NavigateToEntitySettings } from "../../../common/front-end-routing/routes/entity-settings/navigate-to-entity-settings.injectable";
import type { OpenPathPickingDialog } from "../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";
import type { StorageLayer } from "../../utils/storage-helper";
import type { ClusterSettingsDialogState } from "../cluster-settings-dialog/cluster-settings-dialog-state.injectable";
import type { SidebarStorageState } from "./sidebar-storage/sidebar-storage.injectable";

// 🎯 DI 종속성 인터페이스
interface Dependencies {
  sidebarItems: IComputedValue<SidebarItemDeclaration[]>;
  entityRegistry: CatalogEntityRegistry;
  navigateToClusterView: NavigateToClusterView;
  navigateToCatalog: NavigateToCatalog;
  openAddClusterDialog: () => void;
  navigateToEntitySettings: NavigateToEntitySettings;
  openPathPickingDialog: OpenPathPickingDialog;
  addSyncEntries: (filePaths: string[]) => void;
  sidebarStorage: StorageLayer<SidebarStorageState>; // 🔄 추가: 리소스 펼침/접기 상태 관리
  clusterSettingsDialogState: ClusterSettingsDialogState; // 🔄 추가: 클러스터 설정 다이얼로그 전역 상태
  mainTabStore: MainTabStore; // 🆕 파일 탭 열기용
}

// 🎯 AppSidebar Props (shadcn 기준) - ShadcnSidebar props 상속
interface AppSidebarProps extends React.ComponentProps<typeof ShadcnSidebar> {}

const UPDATE_BANNER_FADE_DURATION = 1000;

type UpdateBannerAnimationState = "initial" | "enter" | "exit";

// 🎯 목적: 클러스터 트리 렌더링 컴포넌트 (shadcn Tree 기반)
// 📝 변경: FileTreeItem → Cluster 객체로 데이터 교체
export interface ClusterTreeProps {
  cluster: any; // Kubernetes Cluster 객체
  isActive: boolean;
  isExpanded: boolean;
  onClusterClick: (cluster: any) => void;
  onToggleExpand: (clusterId: string, open: boolean) => void;
  sidebarItems: SidebarItemDeclaration[];
  allClusterIds: string[];
  onOpenClusterSettings: (clusterId: string) => void;
  ensureClusterActive: () => Promise<boolean> | boolean;
}

/**
 * 🎯 목적: 클러스터 트리 렌더링 (shadcn app-sidebar.tsx Tree 컴포넌트 기반)
 * 📝 구조: SidebarMenuItem > Collapsible > SidebarMenuButton
 * 🎨 스타일: ChevronRight 회전 애니메이션, 클러스터별 색상, 연결 상태 점
 * 🔄 MobX: observer로 감싸서 cluster.status.phase 변경 시 자동 리렌더링
 */
export const ClusterTree = observer(
  ({
    cluster,
    isActive,
    isExpanded,
    onClusterClick,
    onToggleExpand,
    sidebarItems,
    allClusterIds,
    onOpenClusterSettings,
    ensureClusterActive,
  }: ClusterTreeProps) => {
    const clusterId = cluster.getId();
    const hasConnectedBefore = Boolean(cluster.metadata?.lastSeen);
    const isConnected = clusterHasActiveConnection(cluster);
    const shouldShowResources = isExpanded && isConnected;
    // 🎯 THEME-024: Semantic color for connection status
    const statusDotClass = isConnected ? "bg-status-success" : "bg-muted-foreground/40";
    const statusLabel = isConnected ? "클러스터 연결됨" : "클러스터 연결되지 않음";

    const handleClusterButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onClusterClick(cluster);
    };

    // 🎯 클러스터 연결 히스토리 여부에 따른 아이콘 색상 결정
    // 📝 metadata.lastSeen이 있으면: primary 색상 (과거에 연결했던 클러스터)
    // 📝 metadata.lastSeen이 없으면: muted-foreground 색상 (한 번도 연결 안 한 클러스터)
    // 📝 !important: [class*="bg-"] 선택자의 !important를 override하기 위해 필요
    // 🎯 shadcn Tree 구조 유지: ShadcnSidebarMenuItem > Collapsible
    return (
      <ShadcnSidebarMenuItem>
        <ContextMenu>
          <Collapsible
            open={shouldShowResources}
            onOpenChange={(open) => onToggleExpand(clusterId, open)}
            className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
          >
            <CollapsibleTrigger asChild>
              <ContextMenuTrigger asChild>
                <ShadcnSidebarMenuButton
                  onClick={handleClusterButtonClick}
                  data-active={isActive} // shadcn 활성 상태 표시
                  style={{ ...createSidebarButtonStyle(SIDEBAR_LINE_BASE_REM, true), paddingLeft: "2px" }}
                >
                  {/* ChevronRight (shadcn 표준 - 회전 애니메이션) */}
                  <ChevronRight className="transition-transform" />

                  <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDotClass)} aria-label={statusLabel} />

                  {/* 🎯 클러스터 이름 - 다이나믹 truncate 적용 */}
                  {/* 📝 주의: truncate 클래스를 명시적으로 추가하여 sidebar 리사이저 변경 시 자동 반응 */}
                  {/* 📝 shadcn Button의 w-full과 함께 작동하여 동적 width 제약 */}
                  {/* 🎨 폰트: font-medium으로 하위 트리 메뉴와 시각적 계층 구분 */}
                  {/* 📝 2026-01-19: - 긴 클러스터 이름 Tooltip 추가 */}
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          "truncate font-medium cursor-default",
                          !hasConnectedBefore && "text-muted-foreground",
                        )}
                      >
                        {cluster.getName()}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[300px] break-all">
                      {cluster.getName()}
                    </TooltipContent>
                  </Tooltip>
                </ShadcnSidebarMenuButton>
              </ContextMenuTrigger>
            </CollapsibleTrigger>

            {/* 🎯 클러스터가 펼쳐진 경우 리소스 표시 */}
            {/* 📝 주의: isActive 조건 제거하여 연결 전에도 펼칠 수 있도록 함 */}
            {shouldShowResources && (
              <CollapsibleContent data-testid={`cluster-resources-${clusterId}`}>
                <ShadcnSidebarMenuSub style={createSidebarLineStyle(SIDEBAR_LINE_BASE_REM)}>
                  {sidebarItems.map((item) => (
                    <SidebarItem
                      key={item.id}
                      item={item}
                      depth={0}
                      onEnsureClusterActive={ensureClusterActive}
                      clusterName={cluster.getName()}
                    />
                  ))}
                </ShadcnSidebarMenuSub>
              </CollapsibleContent>
            )}
          </Collapsible>

          <ContextMenuContent className="w-fit min-w-0">
            <ContextMenuItem className="whitespace-nowrap" onClick={() => onOpenClusterSettings(clusterId)}>
              <Settings className="mr-2 h-4 w-4" />
              Cluster Settings
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </ShadcnSidebarMenuItem>
    );
  },
);

/**
 * 🎯 목적: DAIVE 클러스터 사이드바 메인 컴포넌트 (shadcn AppSidebar 기반)
 * 📝 구조: Sidebar > SidebarHeader, SidebarContent, SidebarRail (shadcn 표준 구조 100% 유지)
 * 🎨 스타일: shadcn app-sidebar.tsx와 동일한 UI 구조
 */
const NonInjectedSidebar = observer(
  ({
    sidebarItems,
    entityRegistry,
    navigateToClusterView,
    navigateToCatalog,
    openAddClusterDialog,
    navigateToEntitySettings,
    openPathPickingDialog,
    addSyncEntries,
    sidebarStorage,
    clusterSettingsDialogState,
    mainTabStore,
    ...props
  }: Dependencies & AppSidebarProps) => {
    const { className: sidebarClassName, ...sidebarProps } = props;
    // 🎯 DAIVE 상태 관리 (기존 sidebar.tsx에서 이동)
    const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
    const [connectingClusters, setConnectingClusters] = useState<Set<string>>(new Set());
    const [clusterOrder, setClusterOrderState] = useState<string[]>(clusterOrderingSessionState.order);
    // 🆕 FIX-029: VSCode 스타일 아코디언 - Clusters/File Explorer 섹션 접기 상태
    // 📝 Clusters: 기본 펼침, File Explorer: 기본 접힘
    const [isClustersExpanded, setIsClustersExpanded] = useState(true);
    const [isFileExplorerExpanded, setIsFileExplorerExpanded] = useState(false);
    // 🎯 초기값 false: 메인 프로세스에서 상태를 받은 후에만 표시 (화면 전환 시 깜빡임 방지)
    const [isUpdateBannerVisible, setIsUpdateBannerVisible] = useState(false);
    // 🎯 DropdownMenu 포커스 트랩 방지 (DropdownMenu → Dialog 문제 해결)
    const [activeClusterDropdownOpen, setActiveClusterDropdownOpen] = useState(false);
    const [selectClusterDropdownOpen, setSelectClusterDropdownOpen] = useState(false);
    /**
     * 🎯 목적: 페이드 아웃 동안 DOM을 유지해 자연스러운 애니메이션을 제공
     */
    const [shouldRenderUpdateBanner, setShouldRenderUpdateBanner] = useState(isUpdateBannerVisible);
    const [updateBannerAnimationState, setUpdateBannerAnimationState] = useState<UpdateBannerAnimationState>(
      isUpdateBannerVisible ? "initial" : "exit",
    );
    const [hasLoadedUpdateBannerState, setHasLoadedUpdateBannerState] = useState(false);
    // 🎯 electron-updater 상태 관리 (Phase 4)
    const [updateVersion, setUpdateVersion] = useState<string | undefined>(undefined);
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
    const [downloadProgress, setDownloadProgress] = useState(0);
    const connectingClustersRef = useRef(connectingClusters);
    const hideUpdateBanner = useCallback(() => {
      setIsUpdateBannerVisible(false);

      try {
        ipcRenderer.send(updateBannerChannels.dismiss);
      } catch {
        // ipcRenderer를 사용할 수 없는 환경에서는 무시
      }
    }, []);

    /**
     * 🎯 업데이트 버튼 클릭 핸들러
     * 📝 상태별 동작:
     *   - idle: 다운로드 시작
     *   - ready: 설치 (앱 재시작)
     *   - error: 다시 체크
     */
    const handleUpdateClick = useCallback(() => {
      try {
        switch (updateStatus) {
          case "idle":
            // 다운로드 시작
            setUpdateStatus("downloading");
            setDownloadProgress(0);
            ipcRenderer.invoke(updateBannerChannels.downloadUpdate);
            break;
          case "ready":
            // 설치 (앱 재시작)
            ipcRenderer.send(updateBannerChannels.installUpdate);
            break;
          case "error":
            // 다시 체크
            setUpdateStatus("checking");
            ipcRenderer.invoke(updateBannerChannels.checkForUpdate);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error("[update-banner] 업데이트 액션 실패:", error);
        setUpdateStatus("error");
      }
    }, [updateStatus]);

    useEffect(() => {
      let disposed = false;

      /**
       * 🎯 배너 표시 여부 적용 (updateAvailable && !dismissed 조건)
       */
      const applyVisibility = (isVisible: boolean) => {
        if (disposed) {
          return;
        }

        setIsUpdateBannerVisible(isVisible);

        if (isVisible) {
          setShouldRenderUpdateBanner(true);
        }
      };

      /**
       * 🎯 초기 dismiss 상태 동기화 및 업데이트 체크 트리거
       *
       * 📝 주의사항:
       * - Cluster Frame에서도 업데이트 배너가 보이도록 캐시된 updateInfo 사용
       * - 이미 발견된 업데이트가 있으면 즉시 표시 (이벤트 재발생 불필요)
       */
      const syncInitialVisibility = async () => {
        try {
          const payload = (await ipcRenderer.invoke(updateBannerChannels.getState)) as UpdateBannerStatePayload;

          // 🎯 이미 발견된 업데이트가 있으면 즉시 표시 (Cluster Frame 대응)
          if (payload.updateInfo && !payload.dismissed) {
            setUpdateVersion(payload.updateInfo.version);
            setUpdateStatus(payload.updateInfo.status);
            applyVisibility(true);
            return;
          }

          // 🎯 업데이트 정보 없고 dismissed가 아니면 체크 시작
          if (!payload.dismissed) {
            setUpdateStatus("checking");
            ipcRenderer.invoke(updateBannerChannels.checkForUpdate);
          }
        } catch {
          // IPC 실패 시 기본 동작
          setUpdateStatus("checking");
          ipcRenderer.invoke(updateBannerChannels.checkForUpdate);
        } finally {
          if (!disposed) {
            setHasLoadedUpdateBannerState(true);
          }
        }
      };

      syncInitialVisibility();

      // 🎯 dismiss 상태 변경 리스너
      const handleStateChanged = (_event: Electron.IpcRendererEvent, payload: UpdateBannerStatePayload) => {
        if (payload.dismissed) {
          applyVisibility(false);
        }
      };

      // 🎯 업데이트 발견 리스너
      const handleUpdateAvailable = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => {
        if (disposed) return;
        setUpdateVersion(info.version);
        setUpdateStatus("idle");
        applyVisibility(true);
      };

      // 🎯 업데이트 없음 리스너
      const handleUpdateNotAvailable = () => {
        if (disposed) return;
        setUpdateStatus("idle");
        applyVisibility(false);
      };

      // 🎯 다운로드 진행률 리스너
      const handleDownloadProgress = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => {
        if (disposed) return;
        setUpdateStatus("downloading");
        setDownloadProgress(progress.percent);
      };

      // 🎯 다운로드 완료 리스너
      const handleUpdateDownloaded = (_event: Electron.IpcRendererEvent, info: UpdateInfo) => {
        if (disposed) return;
        setUpdateStatus("ready");
        setDownloadProgress(100);
      };

      // 🎯 에러 리스너
      const handleUpdateError = (_event: Electron.IpcRendererEvent, error: { message: string }) => {
        if (disposed) return;
        console.error("[update-banner] 에러:", error.message);
        setUpdateStatus("error");
      };

      ipcRenderer.on(updateBannerChannels.stateChanged, handleStateChanged);
      ipcRenderer.on(updateBannerChannels.updateAvailable, handleUpdateAvailable);
      ipcRenderer.on(updateBannerChannels.updateNotAvailable, handleUpdateNotAvailable);
      ipcRenderer.on(updateBannerChannels.downloadProgress, handleDownloadProgress);
      ipcRenderer.on(updateBannerChannels.updateDownloaded, handleUpdateDownloaded);
      ipcRenderer.on(updateBannerChannels.updateError, handleUpdateError);

      return () => {
        disposed = true;
        ipcRenderer.removeListener(updateBannerChannels.stateChanged, handleStateChanged);
        ipcRenderer.removeListener(updateBannerChannels.updateAvailable, handleUpdateAvailable);
        ipcRenderer.removeListener(updateBannerChannels.updateNotAvailable, handleUpdateNotAvailable);
        ipcRenderer.removeListener(updateBannerChannels.downloadProgress, handleDownloadProgress);
        ipcRenderer.removeListener(updateBannerChannels.updateDownloaded, handleUpdateDownloaded);
        ipcRenderer.removeListener(updateBannerChannels.updateError, handleUpdateError);
      };
    }, []);

    useEffect(() => {
      if (!shouldRenderUpdateBanner && isUpdateBannerVisible) {
        setShouldRenderUpdateBanner(true);
      }
    }, [isUpdateBannerVisible, shouldRenderUpdateBanner]);

    useEffect(() => {
      if (!shouldRenderUpdateBanner) {
        return;
      }

      if (isUpdateBannerVisible) {
        setUpdateBannerAnimationState("initial");

        const raf = window.requestAnimationFrame(() => {
          setUpdateBannerAnimationState("enter");
        });

        return () => {
          window.cancelAnimationFrame(raf);
        };
      }

      if (!hasLoadedUpdateBannerState) {
        setShouldRenderUpdateBanner(false);
        return;
      }

      setUpdateBannerAnimationState("exit");

      const timeoutId = window.setTimeout(() => {
        setShouldRenderUpdateBanner(false);
      }, UPDATE_BANNER_FADE_DURATION);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }, [hasLoadedUpdateBannerState, isUpdateBannerVisible, shouldRenderUpdateBanner]);

    // 🎯 클러스터 데이터 (기존 sidebar.tsx에서 이동)
    const clusters = entityRegistry.items.get().filter(isKubernetesCluster);
    const orderedClusters = clusterOrder.length
      ? clusterOrder
          .map((clusterId) => clusters.find((cluster) => cluster.getId() === clusterId))
          .filter((cluster): cluster is KubernetesCluster => Boolean(cluster))
      : clusters;

    const activeCluster =
      entityRegistry.activeEntity && isKubernetesCluster(entityRegistry.activeEntity)
        ? entityRegistry.activeEntity
        : null;
    const activeClusterId = activeCluster?.getId();
    const allClusterIds = orderedClusters.map((cluster) => cluster.getId());

    const clusterIdsSignature = clusters.map((cluster) => cluster.getId()).join("|");
    const clusterLastSeenSignature = clusters
      .map((cluster) => `${cluster.getId()}:${getLastSeenTimestamp(cluster)}`)
      .join("|");

    const updateClusterOrder = useCallback(
      (updater: (prevOrder: string[]) => string[]) =>
        setClusterOrderState((prevOrder) => {
          const nextOrder = updater(prevOrder);

          if (nextOrder !== prevOrder) {
            syncClusterOrderSnapshot(nextOrder);
          }

          return nextOrder;
        }),
      [],
    );

    useEffect(() => {
      if (clusters.length === 0) {
        return;
      }

      updateClusterOrder((prevOrder) => {
        if (!clusterOrderingSessionState.hasInitializedOrder) {
          markClusterOrderInitialized();
          return getClusterOrderingIds(clusters);
        }

        const currentIdSet = new Set(clusters.map((cluster) => cluster.getId()));
        let nextOrder = prevOrder.filter((id) => currentIdSet.has(id));
        let mutated = nextOrder.length !== prevOrder.length;

        for (const cluster of clusters) {
          const clusterId = cluster.getId();
          if (!nextOrder.includes(clusterId)) {
            nextOrder = [...nextOrder, clusterId];
            mutated = true;
          }
        }

        return mutated ? nextOrder : prevOrder;
      });
    }, [clusterIdsSignature, updateClusterOrder]);

    useEffect(() => {
      if (clusters.length === 0) {
        resetClusterHistorySessionState();
        return;
      }

      const connectionHistory = clusterOrderingSessionState.connectionHistory;

      if (!clusterOrderingSessionState.hasInitializedHistory) {
        connectionHistory.clear();

        for (const cluster of clusters) {
          connectionHistory.set(cluster.getId(), clusterHasConnectionHistory(cluster));
        }

        markClusterHistoryInitialized();
        return;
      }

      const promotionTargets: string[] = [];
      const currentClusterIds = new Set<string>();

      for (const cluster of clusters) {
        const clusterId = cluster.getId();
        currentClusterIds.add(clusterId);

        const previousHistory = connectionHistory.get(clusterId) ?? false;
        const currentHistory = clusterHasConnectionHistory(cluster);

        if (!previousHistory && currentHistory) {
          promotionTargets.push(clusterId);
        }

        connectionHistory.set(clusterId, currentHistory);
      }

      for (const storedId of Array.from(connectionHistory.keys())) {
        if (!currentClusterIds.has(storedId)) {
          connectionHistory.delete(storedId);
        }
      }

      // 🎯 순서 재정렬 로직 제거됨 - 클러스터 순서 고정 유지
      // 이전: promotionTargets가 있으면 updateClusterOrder로 순서 변경
      // 변경: 클러스터 연결해도 순서 안 바뀜
    }, [clusterLastSeenSignature]);

    // 🎯 Phase 4: 클러스터 전환 시 하위 메뉴 초기화
    // 📝 목적: 다른 클러스터로 전환할 때 이전 클러스터의 펼친 상태를 모두 초기화
    // 📝 주의: activeCluster가 변경될 때마다 실행됨
    React.useEffect(() => {
      if (!activeClusterId) {
        return;
      }

      // 1. 클러스터 펼침 상태 초기화 (현재 클러스터만 펼침)
      setExpandedClusters(new Set([activeClusterId]));
      // 2. 리소스 펼침 상태도 초기화 (모든 리소스 메뉴 접기)
      // 📝 이것이 "전체 하위 메뉴가 펼쳐지는 문제" 해결
      sidebarStorage.merge((draft) => {
        draft.expanded = {};
      });
    }, [activeClusterId, sidebarStorage]);

    // 🎯 이벤트 핸들러 (기존 sidebar.tsx 로직 유지)
    const toggleCluster = (clusterId: string) => {
      setExpandedClusters((prev) => {
        if (prev.has(clusterId)) {
          return new Set();
        }

        return new Set([clusterId]);
      });
    };

    useEffect(() => {
      connectingClustersRef.current = connectingClusters;
    }, [connectingClusters]);

    const setExclusiveExpandedCluster = (clusterId: string) => {
      setExpandedClusters(new Set([clusterId]));
    };

    const collapseCluster = (clusterId: string) => {
      setExpandedClusters((prev) => {
        if (!prev.has(clusterId)) {
          return prev;
        }

        const next = new Set(prev);
        next.delete(clusterId);
        return next;
      });
    };

    const buildClusterActivationErrorMessage = (clusterName: string, error: unknown) => {
      const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "";

      if (detail) {
        return `클러스터 "${clusterName}" 활성화에 실패했습니다: ${detail}`;
      }

      return `클러스터 "${clusterName}" 활성화에 실패했습니다. 다시 시도해 주세요.`;
    };

    const ensureClusterActive = (clusterId: string, clusterName: string) => {
      if (activeCluster?.getId() === clusterId) {
        setExclusiveExpandedCluster(clusterId);
        return true;
      }

      if (connectingClustersRef.current.has(clusterId)) {
        return true;
      }

      try {
        setConnectingClusters((prev) => {
          if (prev.has(clusterId)) {
            return prev;
          }

          const next = new Set(prev);
          next.add(clusterId);
          return next;
        });

        navigateToClusterView(clusterId);
        return true;
      } catch (error) {
        console.error(`❌ 클러스터 ${clusterName} 활성화 실패:`, error);
        collapseCluster(clusterId);
        // 🎯 FIX-037: NotificationPanel으로 마이그레이션
        notificationPanelStore.addError(
          "cluster",
          "Cluster Activation Failed",
          buildClusterActivationErrorMessage(clusterName, error),
        );
        return false;
      } finally {
        setTimeout(() => {
          setConnectingClusters((prev) => {
            if (!prev.has(clusterId)) {
              return prev;
            }

            const next = new Set(prev);
            next.delete(clusterId);
            return next;
          });
        }, 500);
      }
    };

    const handleClusterClick = (cluster: any) => {
      const clusterId = cluster.getId();

      if (activeCluster?.getId() === clusterId) {
        toggleCluster(clusterId);
        return;
      }

      ensureClusterActive(clusterId, cluster.getName());
    };

    const handleSyncKubeconfig = () => {
      openPathPickingDialog({
        message: "Select kubeconfig file",
        buttonLabel: "Sync",
        properties: ["showHiddenFiles", "multiSelections", "openFile"],
        onPick: addSyncEntries,
      });
    };

    const handleOpenClusterSettings = (clusterId: string) => {
      // 🎯 전역 상태를 사용하여 Dialog 모달 열기
      clusterSettingsDialogState.clusterId = clusterId;
      clusterSettingsDialogState.isOpen = true;
    };

    // 🎯 shadcn app-sidebar.tsx 구조 100% 유지
    // 🔧 variant="inset": Grid layout 내부에서 사용 (position: relative)
    return (
      <>
        <ShadcnSidebar variant="inset" className={sidebarClassName} {...sidebarProps} data-testid="cluster-sidebar">
          <div className="relative flex min-h-full flex-1 flex-col px-2">
            {/* ========== ShadcnSidebarHeader ========== */}
            <ShadcnSidebarHeader className="p-1 my-3">
              <ShadcnSidebarMenu>
                <ShadcnSidebarMenuItem>
                  {/* 🎯 동적 Cluster Header: 활성 클러스터 정보 표시 + 클러스터 전환 기능 */}
                  {activeCluster ? (
                    // ✅ 연결 성공한 클러스터가 있을 때: Provider 아이콘 + 클러스터 이름
                    <DropdownMenu open={activeClusterDropdownOpen} onOpenChange={setActiveClusterDropdownOpen}>
                      <DropdownMenuTrigger asChild>
                        <ShadcnSidebarMenuButton
                          className="gap-2"
                          style={{ borderRadius: "0.375rem" }} // rounded-md 보장
                        >
                          {(() => {
                            const providerType = inferCloudProvider(activeCluster);
                            const providerInfo = getProviderInfo(providerType);

                            return (
                              <>
                                {/* Cloud Provider 아이콘 */}
                                <div
                                  className="flex h-8 w-8 items-center justify-center rounded-md p-2"
                                  style={{ backgroundColor: providerInfo.color }}
                                >
                                  <ClusterProviderIcon
                                    provider={providerType}
                                    className="h-4 w-4 text-[var(--semantic-running-text)]"
                                  />
                                </div>

                                {/* 클러스터 이름 (말줄임표 지원) */}
                                <span className="flex-1 truncate text-sm font-semibold">{activeCluster.getName()}</span>

                                {/* 드롭다운 화살표 */}
                                <ChevronsUpDown className="h-4 w-4" />
                              </>
                            );
                          })()}
                        </ShadcnSidebarMenuButton>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="start" className="w-64">
                        {/* 현재 활성 클러스터 정보 */}
                        <DropdownMenuItem disabled className="gap-2 opacity-100">
                          {(() => {
                            const providerType = inferCloudProvider(activeCluster);
                            const providerInfo = getProviderInfo(providerType);
                            return (
                              <>
                                <div
                                  className="flex h-6 w-6 items-center justify-center rounded"
                                  style={{ backgroundColor: providerInfo.color }}
                                >
                                  <ClusterProviderIcon
                                    provider={providerType}
                                    className="h-3 w-3 text-[var(--semantic-running-text)]"
                                  />
                                </div>
                                <span className="flex-1 truncate">{activeCluster.getName()}</span>
                                {/* 🎯 THEME-024: Semantic color for active cluster indicator */}
                                <span className="text-xs text-status-success">● 활성</span>
                              </>
                            );
                          })()}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* 🆕 다른 클러스터 목록 (클릭 가능) - 클러스터 프레임 내에서 다른 클러스터로 전환 */}
                        {clusters
                          .filter((cluster) => cluster.getId() !== activeCluster?.getId())
                          .map((cluster) => {
                            const clusterId = cluster.getId();
                            const providerType = inferCloudProvider(cluster);
                            const providerInfo = getProviderInfo(providerType);

                            return (
                              <DropdownMenuItem
                                key={clusterId}
                                onClick={() => handleClusterClick(cluster)}
                                className="gap-2"
                              >
                                <div
                                  className="flex h-6 w-6 items-center justify-center rounded"
                                  style={{ backgroundColor: providerInfo.color }}
                                >
                                  <ClusterProviderIcon
                                    provider={providerType}
                                    className="h-3 w-3 text-[var(--semantic-running-text)]"
                                  />
                                </div>
                                <span className="flex-1 truncate">{cluster.getName()}</span>
                              </DropdownMenuItem>
                            );
                          })}

                        {/* 다른 클러스터가 있으면 Separator 추가 */}
                        {clusters.filter((cluster) => cluster.getId() !== activeCluster?.getId()).length > 0 && (
                          <DropdownMenuSeparator />
                        )}

                        {/* Add Cluster 옵션 */}
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault(); // 기본 동작 방지
                            setActiveClusterDropdownOpen(false); // DropdownMenu 명시적으로 닫기
                            setTimeout(() => {
                              // 다음 이벤트 루프에 Dialog 열기 (포커스 트랩 방지)
                              openAddClusterDialog();
                            }, 0);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add from kubeconfig
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSyncKubeconfig}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync kubeconfig
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    // ⚠️ 연결 성공한 클러스터 없을 때: "Select Cluster" 표시
                    <DropdownMenu open={selectClusterDropdownOpen} onOpenChange={setSelectClusterDropdownOpen}>
                      <DropdownMenuTrigger asChild>
                        <ShadcnSidebarMenuButton
                          className="gap-2"
                          style={{ borderRadius: "0.375rem" }} // rounded-md 보장
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted p-2">
                            <Server className="h-4 w-4" />
                          </div>
                          <span className="flex-1 text-sm font-semibold">Select Cluster</span>
                          <ChevronsUpDown className="h-4 w-4" />
                        </ShadcnSidebarMenuButton>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="start" className="w-64">
                        {/* 클러스터 목록 (연결 가능) */}
                        {clusters.length === 0 ? (
                          <DropdownMenuItem disabled>
                            <span className="text-muted-foreground">No clusters available</span>
                          </DropdownMenuItem>
                        ) : (
                          clusters.map((cluster) => {
                            const clusterId = cluster.getId();
                            const providerType = inferCloudProvider(cluster);
                            const providerInfo = getProviderInfo(providerType);

                            return (
                              <DropdownMenuItem
                                key={clusterId}
                                onClick={() => handleClusterClick(cluster)}
                                className="gap-2"
                              >
                                <div
                                  className="flex h-6 w-6 items-center justify-center rounded"
                                  style={{ backgroundColor: providerInfo.color }}
                                >
                                  <ClusterProviderIcon
                                    provider={providerType}
                                    className="h-3 w-3 text-[var(--semantic-running-text)]"
                                  />
                                </div>
                                <span className="flex-1 truncate">{cluster.getName()}</span>
                              </DropdownMenuItem>
                            );
                          })
                        )}

                        <DropdownMenuSeparator />

                        {/* Add Cluster 옵션 */}
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault(); // 기본 동작 방지
                            setSelectClusterDropdownOpen(false); // DropdownMenu 명시적으로 닫기
                            setTimeout(() => {
                              // 다음 이벤트 루프에 Dialog 열기 (포커스 트랩 방지)
                              openAddClusterDialog();
                            }, 0);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add from kubeconfig
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleSyncKubeconfig}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync kubeconfig
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </ShadcnSidebarMenuItem>
              </ShadcnSidebarMenu>
            </ShadcnSidebarHeader>

            {/* ========== ShadcnSidebarContent ========== */}
            {/* 🆕 FIX-029: VSCode 스타일 아코디언 레이아웃 */}
            {/* 📝 Clusters: 기본 펼침, File Explorer: 기본 접힘 (클러스터 연결 시에만 표시) */}
            <ShadcnSidebarContent className="flex flex-1 min-h-0 pl-2 pr-0 flex-col overflow-hidden">
              {/* ========== CLUSTERS 섹션 (VSCode 스타일 Collapsible) ========== */}
              {/* FIX-034: 각 섹션은 flex-1로 공간 나눔, 내부만 스크롤 */}
              <Collapsible
                open={isClustersExpanded}
                onOpenChange={setIsClustersExpanded}
                className={cn(
                  "flex flex-col min-h-0",
                  // 펼쳐진 상태에서만 flex-1으로 공간 차지 (접힌 상태는 헤더 높이만)
                  isClustersExpanded && "flex-1",
                )}
              >
                {/* 섹션 헤더 - shrink-0으로 크기 고정 */}
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 w-full text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5 px-1 hover:bg-accent/50 transition-colors shrink-0"
                  >
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 shrink-0 transition-transform duration-200",
                        isClustersExpanded && "rotate-90",
                      )}
                    />
                    Clusters
                  </button>
                </CollapsibleTrigger>
                {/* 섹션 콘텐츠 - FIX-034: 내부만 스크롤 */}
                <CollapsibleContent className="flex-1 min-h-0 overflow-auto">
                  <ShadcnSidebarMenu>
                    {orderedClusters.map((cluster) => {
                      const clusterId = cluster.getId();
                      return (
                        <ClusterTree
                          key={clusterId}
                          cluster={cluster}
                          isActive={activeCluster?.getId() === clusterId}
                          isExpanded={expandedClusters.has(clusterId)}
                          onClusterClick={handleClusterClick}
                          onToggleExpand={toggleCluster}
                          sidebarItems={sidebarItems.get()}
                          allClusterIds={allClusterIds}
                          onOpenClusterSettings={handleOpenClusterSettings}
                          ensureClusterActive={() => ensureClusterActive(clusterId, cluster.getName())}
                        />
                      );
                    })}
                  </ShadcnSidebarMenu>
                </CollapsibleContent>
              </Collapsible>

              {/* ========== FILE EXPLORER 섹션 (클러스터 연결 시에만 표시) ========== */}
              {/* FIX-034: File Explorer도 flex-1로 공간 나눔, 내부만 스크롤 */}
              {activeCluster && (
                <Collapsible
                  open={isFileExplorerExpanded}
                  onOpenChange={setIsFileExplorerExpanded}
                  className={cn(
                    "flex flex-col min-h-0",
                    // 펼쳐진 상태에서만 flex-1으로 공간 차지 (접힌 상태는 헤더 높이만)
                    isFileExplorerExpanded && "flex-1",
                  )}
                >
                  {/* 섹션 헤더 - shrink-0으로 크기 고정 */}
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 w-full text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5 px-1 hover:bg-accent/50 transition-colors shrink-0"
                    >
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 shrink-0 transition-transform duration-200",
                          isFileExplorerExpanded && "rotate-90",
                        )}
                      />
                      File Explorer
                    </button>
                  </CollapsibleTrigger>
                  {/* 섹션 콘텐츠 - FIX-034: File Explorer 내부만 스크롤 */}
                  <CollapsibleContent className="flex-1 min-h-0 overflow-auto">
                    <FileExplorer
                      onFileDoubleClick={async (entry) => {
                        try {
                          const response = (await ipcRenderer.invoke(
                            fileSystemChannels.readFile,
                            entry.path,
                            "utf-8",
                          )) as ReadFileResponse;

                          if (!response.success || response.content === undefined) {
                            // 🎯 FIX-037: NotificationPanel으로 마이그레이션
                            notificationPanelStore.addError(
                              "cluster",
                              "File Open Failed",
                              `Failed to open file: ${response.error || "Unknown error"}`,
                            );
                            return;
                          }

                          mainTabStore.openFileTab({
                            filePath: entry.path,
                            content: response.content,
                          });
                        } catch (error) {
                          // 🎯 FIX-037: NotificationPanel으로 마이그레이션
                          notificationPanelStore.addError(
                            "cluster",
                            "File Open Failed",
                            `Failed to open file: ${error instanceof Error ? error.message : "Unknown error"}`,
                          );
                        }
                      }}
                      clusterId={activeClusterId}
                      clusterName={activeCluster?.getName()}
                      className="h-full"
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}
            </ShadcnSidebarContent>

            {/* ========== Update Banner Footer ========== */}
            {shouldRenderUpdateBanner && (
              <ShadcnSidebarFooter
                className={cn(styles.overlayFooter, "px-3 pb-3 pt-0")}
                data-banner-state={updateBannerAnimationState}
              >
                <div className={styles.overlayCard}>
                  <UpdateBanner
                    isVisible={shouldRenderUpdateBanner}
                    onClose={hideUpdateBanner}
                    version={updateVersion}
                    status={updateStatus}
                    downloadProgress={downloadProgress}
                    onUpdateClick={handleUpdateClick}
                  />
                </div>
              </ShadcnSidebarFooter>
            )}
          </div>

          {/* ========== ShadcnSidebarRail ========== */}
          <ShadcnSidebarRail />
        </ShadcnSidebar>

        {/* ========== Cluster Settings Dialog ========== */}
        <ClusterSettingsDialog
          isOpen={clusterSettingsDialogState.isOpen}
          onOpenChange={(open) => {
            clusterSettingsDialogState.isOpen = open;
          }}
          clusterId={clusterSettingsDialogState.clusterId}
        />
      </>
    );
  },
);

// 🎯 DI 패턴 적용
export const Sidebar = withInjectables<Dependencies, AppSidebarProps>(NonInjectedSidebar, {
  getProps: (di, props) => ({
    ...props,
    sidebarItems: di.inject(sidebarItemsInjectable),
    entityRegistry: di.inject(catalogEntityRegistryInjectable),
    navigateToClusterView: di.inject(navigateToClusterViewInjectable),
    navigateToCatalog: di.inject(navigateToCatalogInjectable),
    openAddClusterDialog: di.inject(openAddClusterDialogInjectable),
    navigateToEntitySettings: di.inject(navigateToEntitySettingsInjectable),
    openPathPickingDialog: di.inject(openPathPickingDialogInjectable),
    addSyncEntries: di.inject(addSyncEntriesInjectable),
    sidebarStorage: di.inject(sidebarStorageInjectable), // 🔄 추가
    clusterSettingsDialogState: di.inject(clusterSettingsDialogStateInjectable), // 🔄 추가: 클러스터 설정 다이얼로그 전역 상태
    mainTabStore: di.inject(mainTabStoreInjectable), // 🆕 파일 탭 열기용
  }),
});

Sidebar.displayName = "Sidebar";
