/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { withInjectables } from "@ogre-tools/injectable-react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/shadcn-ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip";
import {
  type PanelStatePayload,
  type PanelSyncPayload,
  panelSyncChannels,
} from "../../../../../../common/ipc/panel-sync";
import activeKubernetesClusterInjectable from "../../../../../cluster-frame-context/active-kubernetes-cluster.injectable";
import currentRouteInjectable from "../../../../../routes/current-route.injectable";
import ipcRendererInjectable from "../../../../../utils/channel/ipc-renderer.injectable";
import aiChatPanelStoreInjectable from "../../../../ai-chat/ai-chat-panel-store.injectable";
import dockStoreInjectable from "../../../../dock/dock/store.injectable";
import dockTabsStyles from "../../../../dock/dock-tabs.module.scss";
import sidebarStorageInjectable from "../../../sidebar-storage/sidebar-storage.injectable";
import toggleSidebarVisibilityInjectable from "../../../sidebar-storage/toggle-sidebar.injectable";
import styles from "../../top-bar.module.scss";
import { topBarItemOnRightSideInjectionToken } from "../top-bar-item-injection-token";

import type { IpcRenderer } from "electron";
import type { IComputedValue } from "mobx";

// 📝 2026-01-18: - hostedClusterInjectable import 제거
// Root Frame 마이그레이션으로 더 이상 조건부 주입 불필요
import type { KubernetesCluster } from "../../../../../../common/catalog-entities";
import type { Route } from "../../../../../../common/front-end-routing/front-end-route-injection-token";
import type { StorageLayer } from "../../../../../utils/storage-helper";
import type { AIChatPanelStore } from "../../../../ai-chat/ai-chat-panel-store";
import type { DockStore } from "../../../../dock/dock/store";
import type { SidebarStorageState } from "../../../sidebar-storage/sidebar-storage.injectable";

const panelControlsTopBarItemInjectable = getInjectable({
  id: "panel-controls-top-bar-item",

  instantiate: () => ({
    id: "panel-controls",
    isShown: computed(() => true),
    orderNumber: 150,
    Component: PanelControls,
  }),

  injectionToken: topBarItemOnRightSideInjectionToken,
});

interface PanelControlsDependencies {
  sidebarStorage: StorageLayer<SidebarStorageState>;
  dockStore: DockStore;
  activeKubernetesCluster: IComputedValue<KubernetesCluster | null>;
  toggleSidebarVisibility: () => void;
  ipcRenderer: IpcRenderer;
  /** 🎯 AI Chat Panel Store (2026-01-18: Root Frame 마이그레이션 완료로 항상 inject) */
  aiChatPanelStore: AIChatPanelStore;
  /** 🎯 현재 라우트 정보 (Observability 라우트 체크용) */
  currentRoute: IComputedValue<Route<unknown> | null>;
}

const NonInjectedPanelControls = observer(
  ({
    sidebarStorage,
    dockStore,
    activeKubernetesCluster,
    toggleSidebarVisibility,
    ipcRenderer,
    aiChatPanelStore,
    currentRoute,
  }: PanelControlsDependencies) => {
    const activeCluster = activeKubernetesCluster.get();
    const activeClusterId = activeCluster?.getId();
    const clusterConnected = Boolean(activeClusterId);

    // 🎯 현재 라우트가 Observability인지 확인
    const isObservabilityRoute = currentRoute.get()?.path === "/observability";
    const [syncedSidebarOpen, setSyncedSidebarOpen] = useState<boolean | null>(null);
    const [syncedDockState, setSyncedDockState] = useState<{ isOpen: boolean; hasTabs?: boolean } | null>(null);
    // 📝 2026-01-17: AI Chat IPC 상태 동기화 제거 (Root Frame 마이그레이션)
    // const [syncedAiChatOpen, setSyncedAiChatOpen] = useState<boolean | null>(null);
    const dockStateCacheRef = React.useRef(new Map<string, { isOpen: boolean; hasTabs?: boolean }>());
    const fallbackSidebarOpen = sidebarStorage.get().isOpen;
    const fallbackDockState = {
      isOpen: dockStore.isOpen,
      hasTabs: dockStore.tabs.length > 0,
    };
    const resolvedSidebarOpen = clusterConnected
      ? Boolean(syncedSidebarOpen ?? fallbackSidebarOpen)
      : fallbackSidebarOpen;
    const resolvedDockState = clusterConnected
      ? {
          isOpen: syncedDockState?.isOpen ?? fallbackDockState.isOpen,
          hasTabs: syncedDockState?.hasTabs ?? fallbackDockState.hasTabs,
        }
      : fallbackDockState;
    // 📝 2026-01-17: 클러스터 연결 제한 해제 (Root Frame 마이그레이션)
    // IPC 동기화 없이 직접 store 상태 사용
    const resolvedAiChatOpen = Boolean(aiChatPanelStore?.isOpen ?? false);
    const panelBottomAvailable = resolvedDockState.hasTabs && clusterConnected;
    const panelBottomActive = panelBottomAvailable && resolvedDockState.isOpen;

    useEffect(() => {
      if (!clusterConnected || !activeClusterId) {
        setSyncedSidebarOpen(null);
        setSyncedDockState(null);
        // 📝 2026-01-17: AI Chat 상태 초기화 제거
        // setSyncedAiChatOpen(null);
        return;
      }

      const cachedDockState = dockStateCacheRef.current.get(activeClusterId);

      if (cachedDockState) {
        setSyncedDockState(cachedDockState);
      }

      const handleSidebarStateChange = (_event: Electron.IpcRendererEvent, payload: PanelStatePayload) => {
        if (payload.clusterId !== activeClusterId) {
          return;
        }

        setSyncedSidebarOpen(payload.isOpen);

        // 🔧 2026-01-28: Root Frame의 sidebarStorage도 업데이트
        // ClusterFrame과 Root Frame은 별도 DI 인스턴스를 가지므로
        // IPC 응답 수신 시 Root Frame의 storage도 동기화 필요
        const currentState = sidebarStorage.get();

        if (currentState.isOpen !== payload.isOpen) {
          sidebarStorage.merge({ isOpen: payload.isOpen });
        }
      };

      const handleDockStateChange = (_event: Electron.IpcRendererEvent, payload: PanelStatePayload) => {
        if (payload.clusterId !== activeClusterId) {
          return;
        }

        dockStateCacheRef.current.set(payload.clusterId, {
          isOpen: payload.isOpen,
          hasTabs: payload.hasTabs,
        });

        setSyncedDockState({
          isOpen: payload.isOpen,
          hasTabs: payload.hasTabs,
        });

        // 🔧 2026-01-28: Root Frame의 dockStore도 업데이트
        // ClusterFrame과 Root Frame은 별도 DI 인스턴스를 가지므로
        // IPC 응답 수신 시 Root Frame의 store도 동기화 필요
        if (dockStore.isOpen !== payload.isOpen) {
          if (payload.isOpen) {
            dockStore.open();
          } else {
            dockStore.close();
          }
        }
      };

      ipcRenderer.on(panelSyncChannels.sidebarStateChanged, handleSidebarStateChange);
      ipcRenderer.on(panelSyncChannels.dockStateChanged, handleDockStateChange);
      return () => {
        ipcRenderer.removeListener(panelSyncChannels.sidebarStateChanged, handleSidebarStateChange);
        ipcRenderer.removeListener(panelSyncChannels.dockStateChanged, handleDockStateChange);
      };
    }, [activeClusterId, clusterConnected, ipcRenderer]);

    useEffect(() => {
      if (!clusterConnected && dockStore.isOpen) {
        dockStore.close();
      }
    }, [clusterConnected, dockStore]);

    const dispatchPanelCommand = (channel: string) => {
      if (!activeClusterId) {
        return false;
      }

      ipcRenderer.send(channel, {
        clusterId: activeClusterId,
        action: "toggle",
      } satisfies PanelSyncPayload);

      return true;
    };

    const handleSidebarToggle = () => {
      if (clusterConnected && dispatchPanelCommand(panelSyncChannels.toggleSidebar)) {
        return;
      }

      toggleSidebarVisibility();
    };

    const handlePanelBottomToggle = () => {
      if (!panelBottomAvailable) {
        return;
      }

      if (clusterConnected && dispatchPanelCommand(panelSyncChannels.toggleDock)) {
        return;
      }

      if (dockStore.isOpen) {
        dockStore.close();
      } else {
        dockStore.open();
      }
    };

    /**
     * 🎯 AI Chat Panel 토글 핸들러
     *
     * 📝 2026-01-17: Root Frame 마이그레이션
     * IPC 대신 직접 store.toggle() 호출 (클러스터 연결 여부와 무관하게 동작)
     */
    const handleAiAssistantToggle = () => {
      // 📝 2026-01-18: 수정 - optional chaining 제거
      // aiChatPanelStore는 이제 항상 주입되므로 null 체크 불필요
      aiChatPanelStore.toggle();
    };

    return (
      <div className={styles.panelControls}>
        <PanelToggle
          label="Toggle sidebar"
          isActive={resolvedSidebarOpen}
          onClick={handleSidebarToggle}
          disabled={isObservabilityRoute}
          ActiveIcon={PanelLeftIconFilled}
          InactiveIcon={PanelLeftIcon}
        />
        <PanelToggle
          label="Toggle terminal panel"
          isActive={panelBottomActive}
          onClick={handlePanelBottomToggle}
          disabled={!panelBottomAvailable}
          ActiveIcon={PanelBottomIconFilled}
          InactiveIcon={PanelBottomIcon}
        />
        {/* 📝 2026-01-17: 클러스터 연결 제한 해제 (disabled={false}) */}
        <PanelToggle
          label="Toggle AI assistant"
          isActive={resolvedAiChatOpen}
          onClick={handleAiAssistantToggle}
          disabled={false}
          ActiveIcon={AiAssistantIconFilled}
          InactiveIcon={AiAssistantIcon}
        />
      </div>
    );
  },
);

const PanelControls = withInjectables<PanelControlsDependencies>(NonInjectedPanelControls, {
  getProps: (di) => {
    // 🎯 2026-01-18: 수정
    // Root Frame 마이그레이션 완료 후 항상 store inject
    // (이전: hostedCluster 조건으로 인해 Root Frame에서 null이 되어 토글 불가)
    const aiChatPanelStore = di.inject(aiChatPanelStoreInjectable);

    return {
      sidebarStorage: di.inject(sidebarStorageInjectable),
      dockStore: di.inject(dockStoreInjectable),
      activeKubernetesCluster: di.inject(activeKubernetesClusterInjectable),
      toggleSidebarVisibility: di.inject(toggleSidebarVisibilityInjectable),
      ipcRenderer: di.inject(ipcRendererInjectable),
      aiChatPanelStore,
      currentRoute: di.inject(currentRouteInjectable),
    };
  },
});

interface PanelToggleProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  ActiveIcon: React.ComponentType;
  InactiveIcon: React.ComponentType;
  disabled?: boolean;
}

const PanelToggle = ({ label, isActive, onClick, ActiveIcon, InactiveIcon, disabled }: PanelToggleProps) => (
  <Tooltip delayDuration={0}>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-pressed={isActive}
        data-state={isActive ? "active" : "inactive"}
        aria-disabled={disabled}
        disabled={disabled}
        className={dockTabsStyles.controlButton}
        onClick={(event) => {
          event.stopPropagation();
          if (disabled) {
            return;
          }
          onClick();
        }}
      >
        {isActive ? <ActiveIcon /> : <InactiveIcon />}
        <span className="sr-only">{label}</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom">{label}</TooltipContent>
  </Tooltip>
);

function PanelLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 2V14M3.33333 2H12.6667C13.403 2 14 2.59695 14 3.33333V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V3.33333C2 2.59695 2.59695 2 3.33333 2Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PanelLeftIconFilled() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.33333 2H12.6667C13.403 2 14 2.59695 14 3.33333V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V3.33333C2 2.59695 2.59695 2 3.33333 2Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 3.33333C2 2.59695 2.59695 2 3.33333 2H6V14H3.33333C2.59695 14 2 13.403 2 12.6667V3.33333Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PanelBottomIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2 10H14M3.33333 2H12.6667C13.403 2 14 2.59695 14 3.33333V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V3.33333C2 2.59695 2.59695 2 3.33333 2Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PanelBottomIconFilled() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.33333 2H12.6667C13.403 2 14 2.59695 14 3.33333V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V3.33333C2 2.59695 2.59695 2 3.33333 2Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 10C2 9.44772 2.44772 9 3 9H13C13.5523 9 14 9.44772 14 10V12.6667C14 13.403 13.403 14 12.6667 14H3.33333C2.59695 14 2 13.403 2 12.6667V10Z"
        fill="currentColor"
      />
    </svg>
  );
}

function AiAssistantIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7.99998 5.33335V2.66669H5.33331M1.33331 9.33335H2.66665M13.3333 9.33335H14.6666M9.99998 8.66669V10M5.99998 8.66669V10M3.99998 5.33335H12C12.7364 5.33335 13.3333 5.93031 13.3333 6.66669V12C13.3333 12.7364 12.7364 13.3334 12 13.3334H3.99998C3.2636 13.3334 2.66665 12.7364 2.66665 12V6.66669C2.66665 5.93031 3.2636 5.33335 3.99998 5.33335Z"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AiAssistantIconFilled() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7.99998 5.33335V2.66669H5.33331M1.33331 9.33335H2.66665M13.3333 9.33335H14.6666"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.99998 5.33335H12C12.7364 5.33335 13.3333 5.93031 13.3333 6.66669V12C13.3333 12.7364 12.7364 13.3334 12 13.3334H3.99998C3.2636 13.3334 2.66665 12.7364 2.66665 12V6.66669C2.66665 5.93031 3.2636 5.33335 3.99998 5.33335Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.99998 8.66669V10M5.99998 8.66669V10"
        stroke="var(--background)"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default panelControlsTopBarItemInjectable;
