/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { withInjectables } from "@ogre-tools/injectable-react";
import { rootFrameChildComponentInjectionToken } from "@skuberplus/react-application";
import { computed, reaction } from "mobx";
import { useEffect } from "react";
import aiChatPanelStoreInjectable from "../../../../renderer/components/ai-chat/ai-chat-panel-store.injectable";
import requestClusterActivationInjectable from "../../../cluster/activation/renderer/request-activation.injectable";
import { monitorState } from "./monitor-state";

import type { AIChatPanelStore } from "../../../../renderer/components/ai-chat/ai-chat-panel-store";

type RequestClusterActivation = (req: { clusterId: string; force?: boolean }) => Promise<void>;

interface Dependencies {
  aiChatPanelStore: AIChatPanelStore;
  requestClusterActivation: RequestClusterActivation;
}

/**
 * 목적: monitor 알림을 채팅 패널로 연동
 */
const NonInjectedMonitorAlertHandler = ({ aiChatPanelStore, requestClusterActivation }: Dependencies) => {
  useEffect(() => {
    let lastHandledTimestamp = 0;

    const dispose = reaction(
      () => monitorState.latestAlert,
      async (alert) => {
        if (!alert) {
          return;
        }

        // 이미 처리한 alert는 스킵 (MobX reaction 재실행 방어)
        if (alert.timestamp <= lastHandledTimestamp) {
          return;
        }

        lastHandledTimestamp = alert.timestamp;

        try {
          await requestClusterActivation({ clusterId: alert.clusterId, force: true });
          aiChatPanelStore.selectSingleCluster(alert.clusterId);
          aiChatPanelStore.open();
        } catch (error) {
          console.error("[MonitorAlertHandler] Failed to handle alert:", error);
        }
      },
    );

    return dispose;
  }, [aiChatPanelStore, requestClusterActivation]);

  return null;
};

const MonitorAlertHandler = withInjectables<Dependencies>(NonInjectedMonitorAlertHandler, {
  getProps: (di) => ({
    aiChatPanelStore: di.inject(aiChatPanelStoreInjectable),
    requestClusterActivation: di.inject(requestClusterActivationInjectable),
  }),
});

/**
 * 목적: Root Frame에서 alert handler 등록
 */
const monitorAlertHandlerInjectable = getInjectable({
  id: "monitor-alert-handler",
  instantiate: () => ({
    id: "monitor-alert-handler",
    shouldRender: computed(() => window.location.pathname !== "/log-window"),
    Component: MonitorAlertHandler,
  }),
  injectionToken: rootFrameChildComponentInjectionToken,
});

export default monitorAlertHandlerInjectable;
