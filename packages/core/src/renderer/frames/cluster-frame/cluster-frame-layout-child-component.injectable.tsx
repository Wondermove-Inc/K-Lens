/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { withInjectables } from "@ogre-tools/injectable-react";
import { clusterFrameChildComponentInjectionToken } from "@skuberplus/react-application";
import { ipcRenderer } from "electron";
import { computed, reaction } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { Redirect } from "react-router";
import { toast } from "sonner";
import navigateToObservabilityInjectable from "../../../common/front-end-routing/routes/observability/navigate-to-observability.injectable";
import { type PanelStatePayload, panelSyncChannels, type SaveExplorerUrlPayload } from "../../../common/ipc/panel-sync";
import openPreferencesDialogInjectable from "../../../features/preferences/renderer/open-preferences-dialog.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import hostedClusterIdInjectable from "../../cluster-frame-context/hosted-cluster-id.injectable";
import aiChatPanelStoreInjectable from "../../components/ai-chat/ai-chat-panel-store.injectable";
import { Dock } from "../../components/dock";
import { TabKind } from "../../components/dock/dock/store";
import dockStoreInjectable from "../../components/dock/dock/store.injectable";
import { KeyboardHelpOverlay } from "../../components/keyboard-help-overlay/keyboard-help-overlay";
import keyboardHelpStoreInjectable from "../../components/keyboard-help-overlay/keyboard-help-store.injectable";
import { MainLayout } from "../../components/layout/main-layout";
import { Sidebar } from "../../components/layout/sidebar";
import sidebarStorageInjectable from "../../components/layout/sidebar-storage/sidebar-storage.injectable";
import sidebarVisibilityRegistryInjectable, {
  type SidebarVisibilityHandle,
} from "../../components/layout/sidebar-storage/sidebar-visibility-registry.injectable";
import toggleSidebarVisibilityInjectable from "../../components/layout/sidebar-storage/toggle-sidebar.injectable";
import { MainTabContainer } from "../../components/main-tabs/main-tab-container";
import { Hotbar } from "../../components/shadcn-ui/hotbar";
import hotbarItemsInjectable from "../../components/shadcn-ui/hotbar-items.injectable";
import { Toaster } from "../../components/shadcn-ui/sonner";
import currentPathInjectable from "../../routes/current-path.injectable";
import currentRouteComponentInjectable from "../../routes/current-route-component.injectable";
import styles from "./cluster-frame.module.css";
import startUrlInjectable from "./start-url.injectable";

import type { IComputedValue } from "mobx";

import type { Cluster } from "../../../common/cluster/cluster";
import type { AIChatPanelStore } from "../../components/ai-chat/ai-chat-panel-store";
import type { DockStore } from "../../components/dock/dock/store";
import type { KeyboardHelpStore } from "../../components/keyboard-help-overlay/keyboard-help-store.injectable";
import type { SidebarStorageState } from "../../components/layout/sidebar-storage/sidebar-storage.injectable";
import type { HotbarItem } from "../../components/shadcn-ui/hotbar";
import type { StorageLayer } from "../../utils/storage-helper";

interface Dependencies {
  currentRouteComponent: IComputedValue<React.ElementType<any> | undefined>;
  startUrl: IComputedValue<string>;
  currentPath: IComputedValue<string>;
  sidebarStorage: StorageLayer<SidebarStorageState>;
  toggleSidebarVisibility: () => void;
  dockStore: DockStore;
  sidebarVisibilityRegistry: {
    set: (clusterId: string, handle: SidebarVisibilityHandle) => void;
    delete: (clusterId: string) => void;
  };
  hostedClusterId: string | undefined;
  hostedCluster: Cluster | undefined;
  openPreferencesDialog: () => void;
  navigateToObservability: () => void; // 🎯 Observability 페이지 이동
  aiChatPanelStore: AIChatPanelStore; // 🎯 AI Chat Panel Store (패널 너비 계산용)
  hotbarItems: IComputedValue<HotbarItem[]>; // 🎯 Hotbar 아이템 (Telescope 아이콘 포함)
  keyboardHelpStore: KeyboardHelpStore; // 🎯 키보드 도움말 오버레이 상태
}

const NonInjectedClusterFrameLayout = observer((props: Dependencies) => {
  const Component = props.currentRouteComponent.get();
  const starting = props.startUrl.get();
  const current = props.currentPath.get();
  const hostedClusterName = props.hostedCluster?.name.get();

  // 🎯 AI Chat Panel이 열려있을 때 MainTabContainer에 패딩 적용 (패널 너비만큼)
  const panelPadding = props.aiChatPanelStore.isOpen ? props.aiChatPanelStore.width : 0;

  React.useEffect(() => {
    if (!props.hostedClusterId) {
      return;
    }

    const handle: SidebarVisibilityHandle = {
      isOpen: computed(() => props.sidebarStorage.get().isOpen),
      toggle: props.toggleSidebarVisibility,
    };

    props.sidebarVisibilityRegistry.set(props.hostedClusterId, handle);

    return () => {
      props.sidebarVisibilityRegistry.delete(props.hostedClusterId!);
    };
  }, [props.hostedClusterId, props.sidebarVisibilityRegistry, props.sidebarStorage, props.toggleSidebarVisibility]);

  /**
   * 🎯 목적: Cluster Frame 진입 시 Main Process에서 캐시된 사이드바 폭 동기화
   * 📝 배경: Origin 격리로 인해 Root Frame의 localStorage가 Cluster Frame에 공유되지 않음
   * 📝 동작: Main Process의 캐시된 폭 값을 조회하여 localStorage 업데이트
   */
  React.useEffect(() => {
    ipcRenderer.invoke(panelSyncChannels.getSidebarWidth).then((width: number) => {
      const currentWidth = props.sidebarStorage.get().width;
      if (width && width !== currentWidth) {
        props.sidebarStorage.merge({ width });
      }
    });
  }, [props.sidebarStorage, props.hostedClusterId]);

  /**
   * 🎯 목적: 클러스터 전환 시 (iframe focus) 사이드바 폭 동기화
   * 📝 배경: 이미 연결된 클러스터 간 전환 시 iframe이 재로드되지 않음
   * 📝 동작: cluster-frame-handler.ts에서 view.frame.focus() 호출 시 이벤트 발생
   *          focus 이벤트 수신 시 Main Process 캐시에서 최신 폭 값 조회
   * 🔄 변경이력: 2026-01-20 - ISSUE-118 수정 (클러스터 전환 시 폭 동기화 안 되는 버그)
   */
  React.useEffect(() => {
    const handleWindowFocus = () => {
      ipcRenderer.invoke(panelSyncChannels.getSidebarWidth).then((width: number) => {
        const currentWidth = props.sidebarStorage.get().width;
        if (width && width !== currentWidth) {
          props.sidebarStorage.merge({ width });
        }
      });
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [props.sidebarStorage]);

  /**
   * 🎯 목적: Hotbar 아이콘 클릭 핸들러
   */
  const handleHotbarItemClick = (itemId: string) => {
    if (itemId === "explorer") {
      props.toggleSidebarVisibility();
    } else if (itemId === "skuber-observability") {
      // 🎯 현재 클러스터 URL을 IPC로 Root Frame에 전송 (Observability에서 복귀 시 사용)
      // 📝 Cluster Frame과 Root Frame은 별도 DI 컨테이너를 사용하므로 IPC 필요
      if (props.hostedClusterId) {
        const payload: SaveExplorerUrlPayload = { url: `/cluster/${props.hostedClusterId}` };
        ipcRenderer.send(panelSyncChannels.saveExplorerUrl, payload);
      }
      // 🎯 Skuber+ Observability 페이지로 이동
      props.navigateToObservability();
    } else {
      toast("이 기능은 개발 예정입니다", {
        description: `${itemId} 기능은 현재 개발 중입니다.`,
      });
    }
  };

  /**
   * 📝 2026-01-28: 패널 토글 IPC 핸들러 및 상태 전송 제거
   *
   * 이전 코드는 panel-sync-listener.injectable.ts와 중복되어
   * 토글 시 IPC 메시지가 여러 번 전송되어 상태가 꼬이는 문제가 있었습니다.
   *
   * 현재 구조:
   * - panel-sync-listener.injectable.ts: IPC 토글 메시지 수신 및 storage 변경
   * - 이 컴포넌트: storage 변경을 reaction으로 감지하여 Root Frame에 알림 (상태 동기화용)
   *
   * 제거된 기능:
   * - toggleSidebar/toggleDock IPC 핸들러 (panel-sync-listener로 이관)
   * - 초기 상태 직접 전송 (fireImmediately: false로 변경하여 중복 제거)
   */
  React.useEffect(() => {
    if (!props.hostedClusterId) {
      return;
    }

    const sendSidebarState = (isOpen: boolean) => {
      ipcRenderer.send(panelSyncChannels.sidebarStateChanged, {
        clusterId: props.hostedClusterId!,
        isOpen,
      } satisfies PanelStatePayload);
    };

    const sendDockState = (isOpen: boolean, hasTabs: boolean) => {
      ipcRenderer.send(panelSyncChannels.dockStateChanged, {
        clusterId: props.hostedClusterId!,
        isOpen,
        hasTabs,
      } satisfies PanelStatePayload);
    };

    // 📝 2026-01-28: 초기 상태 직접 전송 제거 (fireImmediately: false로 충분)
    // 문제: 토글 시 이전 상태가 먼저 전송되어 Root Frame 상태가 꼬임
    // sendSidebarState(props.sidebarStorage.get().isOpen);
    // sendDockState(props.dockStore.isOpen, props.dockStore.hasTabs());

    // 📝 2026-01-28: fireImmediately: false로 변경
    // storage 변경 시에만 IPC 전송 (초기 마운트 시 중복 전송 방지)
    const stopSidebarReaction = reaction(
      () => props.sidebarStorage.get().isOpen,
      (isOpen) => sendSidebarState(isOpen),
      { fireImmediately: false },
    );

    const stopDockReaction = reaction(
      () => ({
        isOpen: props.dockStore.isOpen,
        hasTabs: props.dockStore.hasTabs(),
      }),
      ({ isOpen, hasTabs }) => sendDockState(isOpen, hasTabs),
      { fireImmediately: false },
    );

    return () => {
      stopSidebarReaction();
      stopDockReaction();
    };
  }, [props.dockStore, props.hostedClusterId, props.sidebarStorage]);

  React.useEffect(() => {
    if (!props.hostedClusterId || !props.hostedCluster || !hostedClusterName) {
      return;
    }

    const tabs = props.dockStore.tabs;

    if (tabs.length !== 1) {
      return;
    }

    const [firstTab] = tabs;

    if (
      firstTab.kind !== TabKind.TERMINAL ||
      (firstTab.title && firstTab.title !== "Terminal" && firstTab.title !== firstTab.id)
    ) {
      return;
    }

    props.dockStore.renameTab(firstTab.id, hostedClusterName);
  }, [props.dockStore, props.hostedCluster, props.hostedClusterId, hostedClusterName]);

  return (
    <>
      <MainLayout
        hotbar={
          <Hotbar
            items={props.hotbarItems.get()}
            activeItem={props.sidebarStorage.get().isOpen ? "explorer" : undefined}
            onItemClick={handleHotbarItemClick}
            onSettingsClick={props.openPreferencesDialog}
          />
        }
        sidebar={<Sidebar />}
        footer={<Dock />}
      >
        {/* 🎯 AI Chat Panel이 열려있을 때 패딩 적용 (패널 너비만큼 우측 공간 확보)
          👉 높이 수축을 막기 위해 h-full/min-h-0 부여
          📝 2026-01-20: - transition 제거 (즉시 반응) */}
        <div className="h-full min-h-0" style={{ paddingRight: `${panelPadding}px` }}>
          <MainTabContainer>
            {Component ? (
              <Component />
            ) : starting !== current ? (
              <Redirect to={starting} />
            ) : (
              <div className={styles.centering}>
                <div className="error">
                  An error has occurred. No route can be found matching the current route, which is also the starting
                  route.
                </div>
              </div>
            )}
          </MainTabContainer>
        </div>
      </MainLayout>

      {/* 🎯 Sonner Toast Container
        📝 FIX-028: 파일 탐색기 kubectl apply 알림을 위한 Toaster 컴포넌트 */}
      <Toaster position="bottom-right" richColors closeButton />

      {/* 🎯 키보드 단축키 도움말 오버레이 (? 키로 토글) */}
      <KeyboardHelpOverlay
        open={props.keyboardHelpStore.isOpen.get()}
        onOpenChange={(open) => {
          if (!open) props.keyboardHelpStore.close();
        }}
      />
    </>
  );
});

const ClusterFrameLayout = withInjectables<Dependencies>(NonInjectedClusterFrameLayout, {
  getProps: (di, props) => ({
    ...props,
    currentRouteComponent: di.inject(currentRouteComponentInjectable),
    startUrl: di.inject(startUrlInjectable),
    currentPath: di.inject(currentPathInjectable),
    sidebarStorage: di.inject(sidebarStorageInjectable),
    toggleSidebarVisibility: di.inject(toggleSidebarVisibilityInjectable),
    dockStore: di.inject(dockStoreInjectable),
    sidebarVisibilityRegistry: di.inject(sidebarVisibilityRegistryInjectable),
    hostedClusterId: di.inject(hostedClusterIdInjectable),
    hostedCluster: di.inject(hostedClusterInjectable),
    openPreferencesDialog: di.inject(openPreferencesDialogInjectable),
    navigateToObservability: di.inject(navigateToObservabilityInjectable), // 🎯 Observability 페이지 이동 주입
    aiChatPanelStore: di.inject(aiChatPanelStoreInjectable), // 🎯 AI Chat Panel Store 주입
    hotbarItems: di.inject(hotbarItemsInjectable), // 🎯 Hotbar 아이템 주입 (Telescope 아이콘 포함)
    keyboardHelpStore: di.inject(keyboardHelpStoreInjectable), // 🎯 키보드 도움말 상태 주입
  }),
});

const clusterFrameLayoutChildComponentInjectable = getInjectable({
  id: "cluster-frame-layout-child-component",

  instantiate: () => ({
    id: "cluster-frame-layout",
    shouldRender: computed(() => true),
    Component: ClusterFrameLayout,
  }),

  injectionToken: clusterFrameChildComponentInjectionToken,
});

export default clusterFrameLayoutChildComponentInjectable;
