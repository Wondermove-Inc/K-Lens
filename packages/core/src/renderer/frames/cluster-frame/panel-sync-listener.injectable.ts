/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { withInjectables } from "@ogre-tools/injectable-react";
import { clusterFrameChildComponentInjectionToken } from "@skuberplus/react-application";
import { computed, reaction } from "mobx";
import { useEffect } from "react";
import { panelSyncChannels } from "../../../common/ipc/panel-sync";
import activeKubernetesClusterInjectable from "../../cluster-frame-context/active-kubernetes-cluster.injectable";
import aiChatPanelStoreInjectable from "../../components/ai-chat/ai-chat-panel-store.injectable";
import dockStoreInjectable from "../../components/dock/dock/store.injectable";
import sidebarStorageInjectable from "../../components/layout/sidebar-storage/sidebar-storage.injectable";
import ipcRendererInjectable from "../../utils/channel/ipc-renderer.injectable";

import type { IpcRenderer, IpcRendererEvent } from "electron";
import type { IComputedValue } from "mobx";

import type { KubernetesCluster } from "../../../common/catalog-entities";
import type { PanelSyncPayload, SidebarWidthPayload } from "../../../common/ipc/panel-sync";
import type { AIChatPanelStore } from "../../components/ai-chat/ai-chat-panel-store";
import type { DockStore } from "../../components/dock/dock/store";
import type { SidebarStorageState } from "../../components/layout/sidebar-storage/sidebar-storage.injectable";
import type { StorageLayer } from "../../utils/storage-helper";

interface Dependencies {
  ipcRenderer: IpcRenderer;
  sidebarStorage: StorageLayer<SidebarStorageState>;
  dockStore: DockStore;
  aiChatPanelStore: AIChatPanelStore;
  activeKubernetesCluster: IComputedValue<KubernetesCluster | null>;
}

/**
 * 🎯 목적: ClusterFrame (iframe) 내에서 IPC 메시지를 수신하여 패널 상태를 동기화
 *
 * 📝 동작 흐름:
 * 1. Root Frame의 TopBar 버튼 클릭 → IPC 메시지 전송
 * 2. Main Process → ClusterFrame iframe으로 메시지 전달
 * 3. 이 컴포넌트가 메시지 수신 → sidebarStorage/dockStore 상태 변경
 * 4. 상태 변경 완료 후 Root Frame으로 상태 알림
 *
 * 🔄 변경이력: 2025-11-17 - 초기 생성 (merge/full과 merge/ai 병합 후 IPC 리스너 누락 문제 해결)
 */
const NonInjectedPanelSyncListener = ({
  ipcRenderer,
  sidebarStorage,
  dockStore,
  aiChatPanelStore,
  activeKubernetesCluster,
}: Dependencies) => {
  /**
   * 🎯 목적: 사이드바 폭 변경 브로드캐스트 수신 (전역 상태)
   * 📝 배경: 사이드바 폭은 모든 클러스터에 공통 적용되므로 클러스터 활성화와 무관하게 즉시 등록
   * 📝 문제: 기존에는 if (!clusterId) return; 내부에 있어서 hidden iframe에서 리스너 등록 실패
   * 🔄 변경이력: 2026-01-20 - ISSUE-118 깜빡임 제거 (hidden iframe에서도 리스너 등록)
   */
  useEffect(() => {
    const handleSidebarWidthChanged = (_event: IpcRendererEvent, payload: SidebarWidthPayload) => {
      const currentWidth = sidebarStorage.get().width;
      if (payload.width !== currentWidth) {
        sidebarStorage.merge({ width: payload.width });
      }
    };

    ipcRenderer.on(panelSyncChannels.sidebarWidthChanged, handleSidebarWidthChanged);

    return () => {
      ipcRenderer.removeListener(panelSyncChannels.sidebarWidthChanged, handleSidebarWidthChanged);
    };
  }, [ipcRenderer, sidebarStorage]);

  /**
   * 🎯 목적: 클러스터 활성화 시 IPC 리스너 등록 (사이드바/터미널 토글)
   *
   * 📝 문제 (2026-01-28 수정):
   * - 기존 useEffect는 마운트 시 1회 실행
   * - activeKubernetesCluster가 null이면 조기 return → IPC 리스너 미등록
   * - 클러스터 초기화(catalogEntityRegistry.activeEntity 설정) 후에도 재실행되지 않음
   * - 결과: AWS 클러스터 연결 직후 버튼 영구 미동작
   *
   * 🔧 해결책: MobX reaction() 사용
   * - activeKubernetesCluster 값 변경 시 콜백 실행
   * - null → clusterId 변경 시점에 IPC 리스너 등록
   * - fireImmediately: true로 마운트 시에도 현재 값 확인
   *
   * 🔄 변경이력: 2026-01-28 - Race condition 해결 (useEffect → reaction 패턴)
   */
  useEffect(() => {
    let cleanupFns: (() => void)[] = [];
    let disposed = false;

    // ✅ reaction: activeKubernetesCluster 값 변경 시 실행
    const disposer = reaction(
      () => activeKubernetesCluster.get()?.getId(),
      (clusterId) => {
        if (disposed) return;

        // 이전 리스너 정리
        cleanupFns.forEach((fn) => fn());
        cleanupFns = [];

        if (!clusterId) {
          return; // 클러스터 비활성화
        }

        // ✅ 이제 clusterId가 반드시 존재 (catalogEntityRegistry 초기화 후)

        // 🎯 Sidebar 토글 IPC 메시지 핸들러
        const handleToggleSidebar = (_event: IpcRendererEvent, payload: PanelSyncPayload) => {
          if (payload.clusterId !== clusterId) {
            return;
          }

          const currentState = sidebarStorage.get();
          const newIsOpen = !currentState.isOpen;

          sidebarStorage.merge({ isOpen: newIsOpen });

          // 📝 2026-01-28: Root Frame 알림 제거
          // cluster-frame-layout-child-component의 reaction이 storage 변경을 감지하여
          // sidebarStateChanged IPC 메시지를 전송합니다. 여기서 중복 전송하면
          // Root Frame에서 두 번의 상태 변경이 발생하여 원래 상태로 돌아가는 문제 발생.
        };

        // 🎯 Dock 토글 IPC 메시지 핸들러
        const handleToggleDock = (_event: IpcRendererEvent, payload: PanelSyncPayload) => {
          if (payload.clusterId !== clusterId) {
            return;
          }

          const newIsOpen = !dockStore.isOpen;

          if (newIsOpen) {
            dockStore.open();
          } else {
            dockStore.close();
          }

          // 📝 2026-01-28: Root Frame 알림 제거
          // cluster-frame-layout-child-component의 reaction이 dockStore 변경을 감지하여
          // dockStateChanged IPC 메시지를 전송합니다.
        };

        // 📝 2026-01-17: AI Chat Panel IPC 핸들러 제거 (Root Frame 마이그레이션)
        // AI Chat Panel은 이제 Root Frame에서 직접 관리하므로 IPC 통신 불필요

        // 📝 2026-01-20: ISSUE-118 - sidebarWidthChanged 핸들러는 별도 useEffect로 이동
        // 사이드바 폭은 전역 상태이므로 클러스터 활성화와 무관하게 즉시 등록 필요
        // hidden iframe에서도 브로드캐스트를 수신하여 깜빡임 제거

        // 🎯 IPC 리스너 등록 (클러스터별 토글 기능만)
        ipcRenderer.on(panelSyncChannels.toggleSidebar, handleToggleSidebar);
        ipcRenderer.on(panelSyncChannels.toggleDock, handleToggleDock);
        // cleanup 함수 저장
        cleanupFns.push(
          () => ipcRenderer.removeListener(panelSyncChannels.toggleSidebar, handleToggleSidebar),
          () => ipcRenderer.removeListener(panelSyncChannels.toggleDock, handleToggleDock),
        );
      },
      { fireImmediately: true }, // 마운트 시에도 현재 값으로 실행
    );

    // 🎯 cleanup: 컴포넌트 언마운트 시 리스너 제거
    return () => {
      disposed = true;
      disposer();
      cleanupFns.forEach((fn) => fn());
    };
  }, [ipcRenderer, sidebarStorage, dockStore, aiChatPanelStore, activeKubernetesCluster]);

  // 🎯 이 컴포넌트는 UI를 렌더링하지 않음 (IPC 리스너만 담당)
  return null;
};

const PanelSyncListener = withInjectables<Dependencies>(NonInjectedPanelSyncListener, {
  getProps: (di) => ({
    ipcRenderer: di.inject(ipcRendererInjectable),
    sidebarStorage: di.inject(sidebarStorageInjectable),
    dockStore: di.inject(dockStoreInjectable),
    aiChatPanelStore: di.inject(aiChatPanelStoreInjectable),
    activeKubernetesCluster: di.inject(activeKubernetesClusterInjectable),
  }),
});

const panelSyncListenerInjectable = getInjectable({
  id: "panel-sync-listener",

  instantiate: () => ({
    id: "panel-sync-listener",
    shouldRender: computed(() => true),
    Component: PanelSyncListener,
  }),

  injectionToken: clusterFrameChildComponentInjectionToken,
});

export default panelSyncListenerInjectable;
