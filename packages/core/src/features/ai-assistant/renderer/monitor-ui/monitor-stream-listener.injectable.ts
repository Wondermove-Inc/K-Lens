/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@skuberplus/messaging";
import { getClusterIdFromHost } from "../../../../common/utils";
import { monitorAlertChannel, monitorStatusUpdateChannel } from "../../common/agent-ipc-channels";
import { monitorState } from "./monitor-state";

import type { MonitorAlert, MonitorStatus } from "../../common/monitor-types";

/**
 * 목적: Root Frame 여부 확인
 */
function isRootFrame(): boolean {
  return getClusterIdFromHost(window.location.host) === undefined;
}

/**
 * 목적: monitor alert 수신 리스너
 */
const monitorAlertListenerInjectable = getMessageChannelListenerInjectable({
  id: "monitor-alert-listener",
  channel: monitorAlertChannel,
  getHandler: () => {
    return (alert: MonitorAlert) => {
      if (!isRootFrame()) {
        return;
      }

      monitorState.pushAlert(alert);
    };
  },
});

/**
 * 목적: monitor status 수신 리스너
 */
const monitorStatusListenerInjectable = getMessageChannelListenerInjectable({
  id: "monitor-status-listener",
  channel: monitorStatusUpdateChannel,
  getHandler: () => {
    return (status: MonitorStatus) => {
      if (!isRootFrame()) {
        return;
      }

      monitorState.setStatus(status);
    };
  },
});

export { monitorAlertListenerInjectable, monitorStatusListenerInjectable };
