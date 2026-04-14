/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: shadcn Welcome Template 기반 Welcome 컴포넌트
 *
 * 주요 변경사항:
 * - shadcn welcome template 구조 100% 채택
 * - Tailwind CSS token 기반 스타일 (SkuberPlus CSS 완전 격리)
 * - DI 패턴 유지 (withInjectables + 4개 의존성)
 * - Props로 기능 제어 (showTabs, showHeader, showCards, showHelp)
 *
 * 📝 주의사항:
 * - 모든 스타일은 Tailwind CSS token 사용
 * - CSS 격리: welcome-isolation.css로 SkuberPlus CSS와 완전 분리
 * - 4개 DI 의존성 반드시 유지
 * - handleSyncKubeconfig 핸들러 유지
 *
 * 🔄 변경이력:
 * - 2025-10-21: shadcn welcome template 통합
 *   - SCSS → Tailwind CSS token 100% 전환
 *   - shadcn template 구조 채택 (탭, 헤더, 카드, 도움말)
 *   - Props로 기능 제어 추가 (showTabs, showHeader, showCards, showHelp)
 *   - CSS 격리 래퍼 추가 (welcome-isolation.css)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ipcRenderer } from "electron";
import { ChevronLeft, ChevronRight, CircleHelp, Plus, RefreshCcw, X } from "lucide-react";
import { reaction } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { panelSyncChannels, type SidebarWidthPayload } from "../../../common/ipc/panel-sync";
import currentPathInjectable from "../../routes/current-path.injectable";
// 🎯 이전 Explorer URL 저장용 (Observability 복귀 시 사용)
import previousExplorerUrlInjectable from "../../routes/previous-explorer-url.injectable";
// 🎯 Hotbar 아이템 injectable import
import hotbarItemsInjectable from "../shadcn-ui/hotbar-items.injectable";

import type { IComputedValue, IObservableValue } from "mobx";

import type { HotbarItem } from "../shadcn-ui/hotbar";

// 🎨 CSS 격리 제거: Tailwind 클래스 우선순위가 SkuberPlus 전역 리셋보다 높으므로 불필요
// globals.css가 webpack entry로 로드되며, CSS 변수는 :root에 정의되어 있음

import { toast } from "sonner";
// 🎨 shadcn/ui 컴포넌트 imports (로컬 복사본)
import { Button } from "@/components/shadcn-ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/shadcn-ui/item";
// DAIVE 기존 시스템 imports
import navigateToAddClusterInjectable from "../../../common/front-end-routing/routes/add-cluster/navigate-to-add-cluster.injectable";
import navigateToClusterViewInjectable from "../../../common/front-end-routing/routes/cluster-view/navigate-to-cluster-view.injectable";
import navigateToObservabilityInjectable from "../../../common/front-end-routing/routes/observability/navigate-to-observability.injectable";
import navigateToWelcomeInjectable from "../../../common/front-end-routing/routes/welcome/navigate-to-welcome.injectable";
import { forumsUrl } from "../../../common/vars";
import displayProductNameInjectable from "../../../common/vars/display-product-name.injectable";
import requestDeleteClusterInjectable from "../../../features/cluster/delete-dialog/renderer/request-delete.injectable";
import openPathPickingDialogInjectable from "../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import openPreferencesDialogInjectable from "../../../features/preferences/renderer/open-preferences-dialog.injectable";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import addSyncEntriesInjectable from "../../initializers/add-sync-entries.injectable";
import openAddClusterDialogInjectable from "../add-cluster/add-dialog/open.injectable";
import { AddClusterDialog } from "../add-cluster/add-dialog/view";
import { ClusterSettingsDialog } from "../cluster-settings-dialog/cluster-settings-dialog";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import { MainLayout } from "../layout/main-layout";
import { Sidebar } from "../layout/sidebar";
import sidebarStorageInjectable from "../layout/sidebar-storage/sidebar-storage.injectable";
import { Hotbar } from "../shadcn-ui/hotbar";
import { Separator } from "../shadcn-ui/separator";
import { WelcomeClustersAdapter } from "./welcome-clusters-adapter";
import { WelcomeClustersTable } from "./welcome-clusters-table";

import type { KubernetesCluster } from "../../../common/catalog-entities/kubernetes-cluster";
import type { NavigateToClusterView } from "../../../common/front-end-routing/routes/cluster-view/navigate-to-cluster-view.injectable";
import type { RequestDeleteCluster } from "../../../features/cluster/delete-dialog/renderer/request-delete.injectable";
import type { OpenPathPickingDialog } from "../../../features/path-picking-dialog/renderer/pick-paths.injectable";
import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";
import type { StorageLayer } from "../../utils/storage-helper";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { SidebarStorageState } from "../layout/sidebar-storage/sidebar-storage.injectable";
import type { ClusterRowData } from "./welcome-clusters-adapter";

/**
 * 🎯 목적: Welcome 컴포넌트의 Props 인터페이스
 * shadcn template의 기능 제어 Props
 */
export interface WelcomeProps {
  showTabs?: boolean;
  showHeader?: boolean;
  showCards?: boolean;
  showHelp?: boolean;
}

/**
 * 🎯 목적: Welcome 컴포넌트의 DI 의존성 인터페이스
 *
 * 📝 주의사항:
 * - catalogRegistry 추가 (DataTable용 cluster 데이터 소스)
 * - sidebarStorage injectable 추가 (Hotbar 클릭 이벤트용)
 * - navigateToAddCluster: Add Cluster 페이지로 이동
 * - navigateToObservability: Skuber+ Observability 페이지로 이동
 * - openConfirmDialog: 확인 다이얼로그 열기 (클러스터 삭제 확인용)
 * - requestDeleteCluster: 클러스터 삭제 요청 (IPC)
 * - 총 9개 의존성
 */
interface Dependencies {
  productName: string;
  navigateToAddCluster: () => void;
  navigateToObservability: () => void;
  navigateToWelcome: () => void;
  openAddClusterDialog: () => void;
  openPreferencesDialog: () => void;
  openPathPickingDialog: OpenPathPickingDialog;
  addSyncEntries: (filePaths: string[]) => void;
  catalogRegistry: CatalogEntityRegistry;
  sidebarStorage: StorageLayer<SidebarStorageState>;
  openConfirmDialog: OpenConfirmDialog;
  requestDeleteCluster: RequestDeleteCluster;
  // 🎯 Hotbar 아이템 (MobX computed, 내부적으로 userPreferencesState 사용)
  hotbarItems: IComputedValue<HotbarItem[]>;
  // 🎯 클러스터 뷰 네비게이션
  navigateToClusterView: NavigateToClusterView;
  // 🎯 이전 Explorer URL (Observability 복귀용)
  previousExplorerUrl: IObservableValue<string | null>;
  currentPath: IComputedValue<string>;
}

/**
 * 🎯 목적: Props와 Dependencies 통합 타입
 */
type CombinedProps = WelcomeProps & Dependencies;

/**
 * 🎯 목적: Welcome 컴포넌트 (DI 주입 전)
 *
 * 주요 기능:
 * - 탭 네비게이션 시스템 (선택적, showTabs로 제어)
 * - Header 섹션: 로고 + 제품명 + 설명
 * - Action Cards: kubeconfig 추가/동기화
 * - Help 섹션: 도움말 정보
 *
 * 📝 주의사항:
 * - MobX observer로 감싸서 Props 변경 시 자동 리렌더링
 * - MainLayout wrapper 반드시 유지
 * - 모든 스타일은 Tailwind CSS token 사용 (bg-background, text-foreground 등)
 */
const NonInjectedWelcome = observer(
  ({
    productName,
    navigateToAddCluster,
    navigateToObservability,
    navigateToWelcome,
    openAddClusterDialog,
    openPreferencesDialog,
    openPathPickingDialog,
    addSyncEntries,
    catalogRegistry,
    sidebarStorage,
    openConfirmDialog,
    requestDeleteCluster,
    hotbarItems, // 🎯 Injectable에서 주입받은 MobX computed
    navigateToClusterView,
    previousExplorerUrl, // 🎯 이전 Explorer URL (Observability 복귀용)
    currentPath, // 🎯 현재 경로
    showTabs = false, // 기본값: 탭 네비게이션 숨김
    showHeader = true, // 기본값: 헤더 표시
    showCards = true, // 기본값: 액션 카드 표시
    showHelp = true, // 기본값: 도움말 표시
  }: CombinedProps) => {
    /**
     * 🎯 목적: Hotbar 아이콘 클릭 핸들러
     * 📝 동작:
     *   - Explorer: Sidebar 토글 (열기/닫기), 사용자가 조절한 폭은 유지됨
     *   - skuber-observability: Skuber+ Observability 화면으로 이동
     *   - 다른 아이콘: "개발 필요" Toast 표시
     */
    const handleHotbarItemClick = (itemId: string) => {
      if (itemId === "explorer") {
        // 🎯 Explorer 클릭: Sidebar 토글 (사용자가 조절한 폭은 유지됨)
        const currentState = sidebarStorage.get();

        sidebarStorage.merge({
          isOpen: !currentState.isOpen,
        });
      } else if (itemId === "skuber-observability") {
        // 🎯 현재 경로 저장 (Observability에서 복귀 시 사용)
        // Welcome 화면이 아닌 경우에만 저장 (Welcome은 기본값이므로 저장 불필요)
        const current = currentPath.get();
        if (current !== "/welcome") {
          previousExplorerUrl.set(current);
        }
        // 🎯 Skuber+ Observability 화면으로 이동
        navigateToObservability();
      } else {
        // 🎯 다른 아이콘: "개발 필요" Toast 표시
        toast("이 기능은 개발 예정입니다", {
          description: `${itemId} 기능은 현재 개발 중입니다.`,
        });
      }
    };

    // 🔗 kubeconfig 파일 동기화 핸들러
    const handleSyncKubeconfig = () => {
      openPathPickingDialog({
        message: "Select kubeconfig file",
        buttonLabel: "Sync",
        properties: ["showHiddenFiles", "multiSelections", "openFile"],
        onPick: addSyncEntries,
      });
    };

    // 🎯 어댑터 인스턴스 생성 (컴포넌트 마운트 시 1회 실행)
    const clustersAdapter = React.useMemo(() => new WelcomeClustersAdapter(catalogRegistry), [catalogRegistry]);

    // 🎯 Cluster Settings Dialog 상태 관리
    const [isClusterSettingsOpen, setIsClusterSettingsOpen] = React.useState(false);
    const [selectedClusterId, setSelectedClusterId] = React.useState<string | undefined>(undefined);

    /**
     * 🎯 목적: Dialog 닫기 핸들러 (포커스 복원용)
     *
     * @param open - Dialog 열림/닫힘 상태
     *
     * 📝 주의사항:
     * - Dialog가 닫힐 때 selectedClusterId를 undefined로 초기화
     * - 포커스 복원을 위해 명시적인 상태 관리
     */
    const handleClusterSettingsOpenChange = React.useCallback((open: boolean) => {
      setIsClusterSettingsOpen(open);
      if (!open) {
        // Dialog가 닫힐 때 선택된 클러스터 ID 초기화
        setSelectedClusterId(undefined);
      }
    }, []);

    /**
     * 🎯 목적: Cluster Settings 모달 열기 핸들러
     *
     * @param clusterId - 설정할 클러스터 ID
     *
     * 📝 주의사항:
     * - sidebar.tsx의 handleOpenClusterSettings 패턴 재사용
     * - ClusterSettingsDialog 컴포넌트에 clusterId 전달
     */
    const handleOpenClusterSettings = (clusterId: string) => {
      setSelectedClusterId(clusterId);
      setIsClusterSettingsOpen(true);
    };

    /**
     * 🎯 목적: 클러스터 삭제 핸들러 (영어 메시지)
     *
     * @param clusterId - 삭제할 클러스터 ID
     * @param clusterName - 삭제할 클러스터 이름 (확인 메시지용)
     *
     * 📝 주의사항:
     * - openConfirmDialog로 삭제 확인 Alert 표시
     * - requestDeleteCluster로 실제 삭제 실행 (IPC)
     * - 삭제 완료 시 Welcome 목록 및 Sidebar에서 자동 제거
     * - 삭제 후 navigateToWelcome()으로 현재 페이지 유지
     *
     * 🔄 변경이력:
     * - 2025-11-19 - 초기 생성 (StorageClass 삭제 패턴 참조)
     * - 2026-01-05 - 삭제 후 Welcome 페이지 유지 (cluster-view reaction 우회)
     */
    const handleDeleteCluster = (clusterId: string, clusterName: string) => {
      openConfirmDialog({
        ok: async () => {
          await requestDeleteCluster(clusterId);
          // 🎯 삭제 후 Welcome 페이지 유지
          // 📝 주의: cluster-view.tsx의 reaction이 navigateToCatalog() 호출하기 전에
          //         명시적으로 Welcome 라우트 확정하여 /catalog 이동 방지
          navigateToWelcome();
        },
        labelOk: "Delete",
        labelCancel: "Cancel",
        message: (
          <div className="space-y-2">
            <p className="text-base font-semibold">Delete Cluster</p>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete {clusterName}? This action cannot be undone.
            </p>
          </div>
        ),
      });
    };

    /**
     * 🎯 목적: 클러스터 테이블 행 클릭 핸들러
     *
     * @param cluster - 클릭된 클러스터 행 데이터
     *
     * 📝 주의사항:
     * - 클러스터 뷰로 네비게이션하여 해당 클러스터에 연결
     *
     * 🔄 변경이력: 2025-12-22 - 초기 생성 (테이블 행 클릭 시 클러스터 연결)
     */
    const handleRowClick = (cluster: ClusterRowData) => {
      navigateToClusterView(cluster.id);
    };

    /**
     * 🎯 목적: Cluster Frame에서 사이드바 폭 변경 시 Root Frame (Welcome)에 동기화
     * 📝 배경: Origin 격리로 인해 Cluster Frame의 localStorage 변경이 Root Frame에 반영되지 않음
     * 📝 동작: Main Process에서 브로드캐스트된 폭 변경을 수신하여 localStorage 업데이트
     */
    React.useEffect(() => {
      const handleSidebarWidthChanged = (_event: Electron.IpcRendererEvent, payload: SidebarWidthPayload) => {
        const currentWidth = sidebarStorage.get().width;
        if (payload.width !== currentWidth) {
          sidebarStorage.merge({ width: payload.width });
        }
      };

      ipcRenderer.on(panelSyncChannels.sidebarWidthChanged, handleSidebarWidthChanged);

      // 🎯 초기 폭 동기화 (Main Process 캐시에서 조회)
      ipcRenderer.invoke(panelSyncChannels.getSidebarWidth).then((width: number) => {
        const currentWidth = sidebarStorage.get().width;
        if (width && width !== currentWidth) {
          sidebarStorage.merge({ width });
        }
      });

      return () => {
        ipcRenderer.removeListener(panelSyncChannels.sidebarWidthChanged, handleSidebarWidthChanged);
      };
    }, [sidebarStorage]);

    // 🎯 Latency Push 리스너 등록/해제
    React.useEffect(() => {
      clustersAdapter.startListeningForLatency();
      return () => {
        clustersAdapter.stopListeningForLatency();
      };
    }, [clustersAdapter]);

    // 🎯 초기 로딩: 모든 클러스터 자동 연결 및 Pod Status 조회
    React.useEffect(() => {
      let hasAutoConnected = false;

      console.log(
        "[Welcome] useEffect 시작 - catalogRegistry.filteredItems.length:",
        catalogRegistry.filteredItems.length,
      );

      const connectAndRefresh = async () => {
        // 🎯 모든 클러스터 가져오기
        const allClusters = catalogRegistry.filteredItems.filter(
          (entity) => entity.kind === "KubernetesCluster",
        ) as KubernetesCluster[];

        console.log(
          "[Welcome] connectAndRefresh - 클러스터 수:",
          allClusters.length,
          "클러스터 목록:",
          allClusters.map((c) => ({ name: c.metadata.name, phase: c.status?.phase })),
        );

        // 🔄 병렬 연결 시도 (최대 5개씩)
        const batchSize = 5;

        for (let i = 0; i < allClusters.length; i += batchSize) {
          const batch = allClusters.slice(i, i + batchSize);

          await Promise.allSettled(
            batch.map(async (cluster) => {
              try {
                const clusterName = cluster.metadata.name;
                const clusterId = cluster.getId();
                const currentPhase = cluster.status?.phase;

                console.log(`[Welcome] 클러스터 처리 시작: ${clusterName}, phase: ${currentPhase}`);

                // 🎯 이미 연결된 클러스터도 Pod Status + 메트릭 조회
                if (currentPhase === "connected") {
                  console.log(`[Welcome] ${clusterName} - 이미 연결됨, Pod Status + 메트릭 조회`);
                  // 📊 이미 연결된 클러스터의 Pod Status, 메트릭, Latency 조회
                  await Promise.all([
                    clustersAdapter.refreshPodStatus(clusterId),
                    clustersAdapter.refreshMetrics(clusterId),
                    clustersAdapter.refreshLatency(clusterId),
                  ]);
                  console.log(`[Welcome] ${clusterName} - Pod Status + 메트릭 조회 완료`);
                  return;
                }

                // 🔗 클러스터 연결 시도
                console.log(`[Welcome] ${clusterName} - 연결 시도 중...`);
                await cluster.connect();
                console.log(`[Welcome] ${clusterName} - 연결 완료, 새 phase: ${cluster.status?.phase}`);
              } catch (error) {
                console.warn(`[Welcome] Failed to connect cluster ${cluster.metadata.name}:`, error);
              }
            }),
          );
        }

        // 📊 연결 성공한 클러스터의 Pod Status 조회
        console.log("[Welcome] refreshAllConnectedClusters 호출 시작");
        await clustersAdapter.refreshAllConnectedClusters();
        console.log("[Welcome] refreshAllConnectedClusters 완료");
      };

      // 🎯 MobX Reaction: catalogRegistry 데이터 로드 시점 감지
      const disposeAutoConnect = reaction(
        () => catalogRegistry.filteredItems.length,
        (length) => {
          console.log("[Welcome] Reaction 트리거 - length:", length, "hasAutoConnected:", hasAutoConnected);
          if (length > 0 && !hasAutoConnected) {
            hasAutoConnected = true;
            console.log("[Welcome] connectAndRefresh 호출!");
            connectAndRefresh();
          }
        },
        { fireImmediately: true },
      );

      // 🎯 MobX Reaction: 클러스터 상태 변경 감지 및 자동 Pod Status 조회
      const disposeReaction = reaction(
        () =>
          catalogRegistry.filteredItems
            .filter((entity) => entity.kind === "KubernetesCluster")
            .map((cluster) => ({
              id: cluster.getId(),
              phase: (cluster as KubernetesCluster).status?.phase,
            })),
        (clusters) => {
          console.log(`[Welcome] 상태 변경 Reaction - 클러스터 수: ${clusters.length}`);
          clusters.forEach(({ id, phase }) => {
            console.log(
              `[Welcome] 클러스터 상태: id=${id.substring(0, 20)}..., phase=${phase}, hasPodStatus=${clustersAdapter.hasPodStatus(id)}`,
            );
            // 🔄 연결된 클러스터 중 캐시에 없는 것만 조회 (Pod Status + 메트릭 + Latency)
            if (phase === "connected" && !clustersAdapter.hasPodStatus(id)) {
              console.log(`[Welcome] ${id.substring(0, 20)}... - Pod Status + 메트릭 + Latency 조회 시작`);
              clustersAdapter.refreshPodStatus(id);
              clustersAdapter.refreshMetrics(id);
              clustersAdapter.refreshLatency(id);
            }
          });
        },
      );

      return () => {
        disposeAutoConnect();
        disposeReaction();
      };
    }, [clustersAdapter, catalogRegistry]);

    return (
      <>
        <MainLayout
          hotbar={
            <Hotbar
              items={hotbarItems.get()}
              activeItem={sidebarStorage.get().isOpen ? "explorer" : undefined}
              onItemClick={handleHotbarItemClick}
              onSettingsClick={openPreferencesDialog} // 🎯 설정 버튼 클릭 시 PreferencesDialog 모달 열기
            />
          }
          sidebar={<Sidebar />}
        >
          {/* 🎯 최상위 컨테이너: 탭 + 콘텐츠 영역을 flex column으로 배치
           *
           * 📝 중요: h-full 사용 이유 (min-h-0 flex-1 대신)
           * - MainLayout의 .contents는 단순히 overflow:hidden만 설정되어 있음 (flex container 아님)
           * - 따라서 자식 요소의 flex-1이 작동하지 않음
           * - h-full(height:100%)을 사용하여 부모(.contents)의 전체 높이를 명시적으로 사용
           *
           * ⚠️ 주의: 다른 MainLayout 자식 컴포넌트는 다른 레이아웃 방식을 사용할 수 있음
           *   (예: TabLayout 등은 자체 높이 관리 로직을 가질 수 있음)
           */}
          <div className="flex h-full flex-col">
            {/* ========================================
                🎯 탭 네비게이션 영역 (shadcn template 구조)
                ======================================== */}
            {showTabs && (
              <div className="border-border bg-card flex items-center border-b">
                {/* 좌측 분리선 */}
                <div className="flex items-center px-2">
                  <Separator orientation="vertical" className="h-5" />
                </div>

                {/* 네비게이션 버튼 그룹 */}
                <div className="border-border flex items-center border-b">
                  <Button variant="ghost" size="sm" className="rounded-none border-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-none border-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* 활성 탭 */}
                <div className="border-primary bg-background border-b-2">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <span className="text-sm font-medium">Welcome</span>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* 우측 분리선 */}
                <div className="flex items-center px-2">
                  <Separator orientation="vertical" className="h-5" />
                </div>

                {/* 비활성 탭들 */}
                <div className="border-border flex flex-1 border-b">
                  <Button variant="ghost" size="sm" className="text-muted-foreground rounded-none opacity-50">
                    File Explorer
                  </Button>
                  <div className="flex items-center px-2">
                    <Separator orientation="vertical" className="h-5" />
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground rounded-none opacity-50">
                    Terminal
                  </Button>
                </div>
              </div>
            )}

            {/* 🎯 메인 콘텐츠 영역: Storybook Home story 레이아웃 (상단 정렬, 스크롤 가능) */}
            <div className="bg-background flex min-h-0 flex-1 flex-col items-center overflow-auto p-5 pt-28">
              <div className="flex w-full max-w-[1280px] flex-col items-start gap-10">
                {/* ========================================
                  🎯 로고 및 타이틀 섹션 (Storybook Home story 기반)
                  ======================================== */}
                {showHeader && (
                  <div className="flex items-center gap-3">
                    {/* 로고 심볼 */}
                    <div className="relative h-12 w-12 flex-shrink-0">
                      <div className="absolute top-0 left-0 h-12 w-12">
                        {/* 배경 원 */}
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="24" cy="24" r="24" fill="#125AED" />
                          <circle cx="24" cy="24" r="24" fill="white" fillOpacity="0.05" />
                        </svg>
                        {/* 로고 아이콘 */}
                        <svg
                          className="absolute top-[4.5px] left-[4.5px]"
                          width="39"
                          height="39"
                          viewBox="0 0 39 39"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M19.4274 0C8.69355 0 0 8.70161 0 19.4274C0 30.1532 8.70161 38.8548 19.4274 38.8548C30.1532 38.8548 38.8548 30.1532 38.8548 19.4274C38.8548 8.70161 30.1613 0 19.4274 0ZM28.3226 17L21.8548 10.5323L24.1935 8.19355C25.9758 6.41129 28.871 6.41129 30.6613 8.19355C32.4435 9.97581 32.4435 12.871 30.6613 14.6613L28.3226 17ZM30.6613 24.1855C32.4435 25.9677 32.4435 28.8629 30.6613 30.6532C28.879 32.4355 25.9839 32.4355 24.1935 30.6532L21.8548 28.3145L28.3226 21.8468L30.6613 24.1855ZM19.4274 25.8871L16.2016 22.6613H19.4274L12.9758 19.4355L12.9597 19.4194L19.4274 12.9516L22.6613 16.1855H19.4274L25.8871 19.4194L19.4193 25.8871H19.4274ZM8.19355 30.6613C6.41129 28.879 6.41129 25.9839 8.19355 24.1935L10.5403 21.8468L17.0081 28.3145L14.6613 30.6613C12.879 32.4435 9.98387 32.4435 8.19355 30.6613ZM8.19355 14.6532C6.41129 12.871 6.41129 9.97581 8.19355 8.18548C9.9758 6.40322 12.871 6.40322 14.6613 8.18548L17.0081 10.5323L10.5403 17L8.19355 14.6532ZM24.1532 4.1371C23.2903 4.52419 22.4839 5.06452 21.7742 5.77419L19.4355 8.1129L17.0968 5.77419C16.3871 5.06452 15.5806 4.52419 14.7177 4.1371C16.2097 3.67742 17.7903 3.42742 19.4355 3.42742C21.0806 3.42742 22.6613 3.67742 24.1613 4.1371H24.1532ZM4.14516 14.6935C4.53226 15.5564 5.07258 16.371 5.78226 17.0806L8.12097 19.4194L5.78226 21.7581C5.07258 22.4677 4.53226 23.2823 4.14516 24.1532C3.68548 22.6613 3.43548 21.0726 3.43548 19.4274C3.43548 17.7823 3.68548 16.1935 4.14516 14.6935ZM14.7097 34.7177C15.5726 34.3306 16.3871 33.7903 17.1048 33.0806L19.4435 30.7419L21.7823 33.0806C22.4919 33.7903 23.3064 34.3306 24.1693 34.7177C22.6774 35.1774 21.0887 35.4274 19.4355 35.4274C17.7823 35.4274 16.2016 35.1774 14.7097 34.7177ZM34.7339 24.1452C34.3468 23.2823 33.8064 22.4758 33.0968 21.7661L30.7581 19.4274L33.0968 17.0887C33.8064 16.379 34.3468 15.5726 34.7339 14.7097C35.1935 16.2016 35.4435 17.7903 35.4435 19.4355C35.4435 21.0806 35.1935 22.6613 34.7339 24.1532V24.1452Z"
                            fill="white"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* 타이틀 텍스트 */}
                    <div className="flex flex-col items-start gap-1.5">
                      <span className="text-foreground text-center text-3xl leading-none font-medium">
                        {productName}
                      </span>
                      <span className="text-foreground text-left text-base leading-none font-light">
                        Kubernetes IDE · Simplified Cluster Management
                      </span>
                    </div>
                  </div>
                )}

                {/* ========================================
                  🎯 카드 및 테이블 컨테이너
                  ======================================== */}
                <div className="flex w-full flex-col items-start gap-7">
                  {/* ========================================
                    🎯 액션 카드 섹션 (Item 컴포넌트 기반)
                    ======================================== */}
                  {showCards && (
                    <div className="flex w-full flex-col items-start gap-3">
                      <span className="text-foreground text-base leading-none font-normal">Add Cluster</span>
                      <div className="flex w-full items-stretch gap-4">
                        {/* Add from kubeconfig 카드 */}
                        <Item variant="muted" className="flex-1">
                          <ItemContent>
                            <ItemTitle>Add from kubeconfig</ItemTitle>
                            <ItemDescription>Add clusters directly from your kubeconfig file</ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            <Button
                              className="flex h-9 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm leading-5"
                              onClick={openAddClusterDialog}
                            >
                              <Plus className="h-4 w-4" />
                              Add
                            </Button>
                          </ItemActions>
                        </Item>

                        {/* Sync kubeconfig 카드 */}
                        <Item variant="muted" className="flex-1">
                          <ItemContent>
                            <ItemTitle>Sync kubeconfig</ItemTitle>
                            <ItemDescription>Automatically sync and manage your kubeconfig files</ItemDescription>
                          </ItemContent>
                          <ItemActions>
                            <Button
                              variant="outline"
                              className="flex h-9 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm leading-5"
                              onClick={handleSyncKubeconfig}
                            >
                              <RefreshCcw className="h-4 w-4" />
                              Sync
                            </Button>
                          </ItemActions>
                        </Item>
                      </div>
                    </div>
                  )}

                  {/* ========================================
                    🎯 클러스터 테이블 섹션
                    ======================================== */}
                  <WelcomeClustersTable
                    clusters={clustersAdapter.tableRows}
                    adapter={clustersAdapter}
                    onRowClick={handleRowClick}
                    onOpenClusterSettings={handleOpenClusterSettings}
                    onDeleteCluster={handleDeleteCluster}
                  />

                  {/* ========================================
                    🎯 도움말 섹션 (Item 컴포넌트 기반)
                    ======================================== */}
                  {showHelp && (
                    <Item variant="outline" className="w-full">
                      <ItemMedia variant="icon">
                        <CircleHelp className="h-4 w-4" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>Need Help?</ItemTitle>
                        <ItemDescription>
                          Visit our community forums for support, guides, and discussions.
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          variant="outline"
                          className="h-9 rounded-lg px-4 py-2 text-sm"
                          onClick={() => window.open(forumsUrl, "_blank")}
                        >
                          Get help
                        </Button>
                      </ItemActions>
                    </Item>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 🎯 Cluster Settings Dialog */}
          <ClusterSettingsDialog
            isOpen={isClusterSettingsOpen}
            onOpenChange={handleClusterSettingsOpenChange}
            clusterId={selectedClusterId}
          />

          <AddClusterDialog />
        </MainLayout>
      </>
    );
  },
);

/**
 * 🎯 목적: DI 주입이 완료된 Welcome 컴포넌트 (export)
 *
 * withInjectables를 통해 9개 의존성 주입:
 * - productName: 제품명 (DAIVE)
 * - navigateToAddCluster: Add Cluster 페이지로 이동하는 함수
 * - navigateToObservability: Skuber+ Observability 페이지로 이동하는 함수
 * - navigateToPreferences: 전역 설정 페이지로 이동하는 함수
 * - openPathPickingDialog: 파일 선택 다이얼로그를 여는 함수
 * - addSyncEntries: kubeconfig 파일을 동기화 목록에 추가하는 함수
 * - catalogRegistry: CatalogEntityRegistry (DataTable용)
 * - sidebarStorage: Sidebar 상태 저장소 (Hotbar 클릭 이벤트용)
 * - openConfirmDialog: 확인 다이얼로그 열기 (클러스터 삭제 확인용)
 * - requestDeleteCluster: 클러스터 삭제 요청 (IPC)
 */
export const Welcome = withInjectables<Dependencies, WelcomeProps>(NonInjectedWelcome, {
  getProps: (di, props) => ({
    ...props,
    productName: di.inject(displayProductNameInjectable),
    navigateToAddCluster: di.inject(navigateToAddClusterInjectable),
    navigateToObservability: di.inject(navigateToObservabilityInjectable),
    navigateToWelcome: di.inject(navigateToWelcomeInjectable),
    openAddClusterDialog: di.inject(openAddClusterDialogInjectable),
    openPreferencesDialog: di.inject(openPreferencesDialogInjectable),
    openPathPickingDialog: di.inject(openPathPickingDialogInjectable),
    addSyncEntries: di.inject(addSyncEntriesInjectable),
    catalogRegistry: di.inject(catalogEntityRegistryInjectable),
    sidebarStorage: di.inject(sidebarStorageInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
    requestDeleteCluster: di.inject(requestDeleteClusterInjectable),
    // 🎯 Hotbar 아이템 injectable 주입
    hotbarItems: di.inject(hotbarItemsInjectable),
    // 🎯 클러스터 뷰 네비게이션 주입
    navigateToClusterView: di.inject(navigateToClusterViewInjectable),
    // 🎯 이전 Explorer URL 저장용 (Observability 복귀 시 사용)
    previousExplorerUrl: di.inject(previousExplorerUrlInjectable),
    currentPath: di.inject(currentPathInjectable),
  }),
});
