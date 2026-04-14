/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 상태바에 모든 클러스터의 경고(Alerts)를 표시하는 아이템
 *
 * 주요 기능:
 * - 모든 연결된 클러스터의 경고 요약 표시
 * - 클릭 시 Popover로 클러스터별 경고 상세 표시
 * - 클러스터 클릭 시 해당 클러스터로 이동
 * - AI 분석 버튼으로 Alert 분석 트리거 + Chat 패널 자동 열기
 *
 * 🔄 변경이력:
 * - 초기 버전 - 단일 클러스터 경고 표시
 * - 2025-12-10 - 모든 클러스터 경고 Popover 기능 추가
 * - 2025-12-10 - navigateToClusterView로 클러스터 이동 수정
 * - 2025-12-18 - panelSyncChannels.navigateInCluster IPC로 특정 클러스터 navigation 수정
 * - 2026-03-12 - AI Alert Analysis 기능 추가 (Phase 1)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { observer } from "mobx-react-lite";
import React, { useCallback } from "react";
import navigateToClusterViewInjectable from "../../../../common/front-end-routing/routes/cluster-view/navigate-to-cluster-view.injectable";
import { panelSyncChannels } from "../../../../common/ipc/panel-sync";
import { alertAgentTriggerChannel } from "../../../../features/ai-assistant/common/alert-agent-channels";
import userPreferencesStateInjectable from "../../../../features/user-preferences/common/state.injectable";
import ipcRendererInjectable from "../../../utils/channel/ipc-renderer.injectable";
import aiChatPanelStoreInjectable from "../../ai-chat/ai-chat-panel-store.injectable";
import { statusBarItemInjectionToken } from "../status-bar-item-injection-token";
import { ClusterAlertsPopover } from "./cluster-alerts-popover";

import type { IpcRenderer } from "electron";

import type { AlertAgentTriggerRequest } from "../../../../features/ai-assistant/common/alert-agent-channels";
import type { UserPreferencesState } from "../../../../features/user-preferences/common/state.injectable";
import type { AIChatPanelStore } from "../../ai-chat/ai-chat-panel-store";

/**
 * 🎯 목적: Cluster View로 이동하는 함수 타입
 */
type NavigateToClusterView = (clusterId: string) => void;

interface StatusBarAlertsComponentProps {
  navigateToClusterView: NavigateToClusterView;
  ipcRenderer: IpcRenderer;
  userPreferencesState: UserPreferencesState;
  aiChatPanelStore: AIChatPanelStore;
}

/**
 * 🎯 목적: 상태바 Alerts 컴포넌트
 * Popover를 포함하여 모든 클러스터 경고를 표시
 */
const StatusBarAlertsComponent: React.FC<StatusBarAlertsComponentProps> = observer(
  ({ navigateToClusterView, ipcRenderer, userPreferencesState, aiChatPanelStore }) => {
    /**
     * 🎯 목적: 클러스터 이동 핸들러
     * @param clusterId - 이동할 클러스터 ID
     */
    const handleNavigateToCluster = useCallback(
      (clusterId: string) => {
        navigateToClusterView(clusterId);
        ipcRenderer.send(panelSyncChannels.navigateInCluster, { clusterId, url: "/overview" });
      },
      [navigateToClusterView, ipcRenderer],
    );

    /**
     * 🎯 목적: AI 알림 분석 요청 핸들러
     * IPC로 분석 트리거 → 성공 시 AI Chat 패널을 열고 해당 threadId로 전환
     */
    const handleAnalyzeAlert = useCallback(
      async (request: AlertAgentTriggerRequest) => {
        try {
          const response = await ipcRenderer.invoke(alertAgentTriggerChannel.id, request);
          if (response.accepted && response.threadId) {
            // AI Chat 패널 열기 + alert threadId로 전환
            aiChatPanelStore.openForAlertAnalysis(response.threadId);
          } else {
            console.warn("[StatusBarAlerts] Alert analysis rejected:", response.reason);
          }
        } catch (error) {
          console.error("[StatusBarAlerts] Alert analysis error:", error);
        }
      },
      [ipcRenderer, aiChatPanelStore],
    );

    return (
      <ClusterAlertsPopover
        onNavigateToCluster={handleNavigateToCluster}
        onAnalyzeAlert={handleAnalyzeAlert}
        aiProvider={(userPreferencesState as any).aiProvider ?? "anthropic"}
      />
    );
  },
);

StatusBarAlertsComponent.displayName = "StatusBarAlertsComponent";

const statusBarWarningCountItemInjectable = getInjectable({
  id: "status-bar-warning-count-item",

  instantiate: (di) => {
    const navigateToClusterView = di.inject(navigateToClusterViewInjectable);
    const ipcRenderer = di.inject(ipcRendererInjectable);
    const userPreferencesState = di.inject(userPreferencesStateInjectable);
    const aiChatPanelStore = di.inject(aiChatPanelStoreInjectable);

    const component = observer(() => (
      <StatusBarAlertsComponent
        navigateToClusterView={navigateToClusterView}
        ipcRenderer={ipcRenderer}
        userPreferencesState={userPreferencesState}
        aiChatPanelStore={aiChatPanelStore}
      />
    ));

    return {
      origin: "core",
      component,
      position: "right" as const,
      priority: 10,
      visible: computed(() => true),
    };
  },

  injectionToken: statusBarItemInjectionToken,
});

export default statusBarWarningCountItemInjectable;
