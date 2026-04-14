/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable, lifecycleEnum } from "@ogre-tools/injectable";
import { sendMessageToChannelInjectionToken } from "@skuberplus/messaging";
import path from "path";
import electronTrayInjectable from "../../../../main/tray/electron-tray/electron-tray.injectable";
import getTrayIconPathInjectable from "../../../../main/tray/menu-icon/get-tray-icon-path.injectable";
import { monitorAlertChannel, monitorStatusUpdateChannel } from "../../common/agent-ipc-channels";
import { MonitorSupervisor } from "./monitor-supervisor";

/**
 * 목적: 모니터 슈퍼바이저 DI 등록
 */
const monitorSupervisorInjectable = getInjectable({
  id: "ai-assistant-monitor-supervisor",
  instantiate: (di) => {
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);
    const getTrayIconPath = di.inject(getTrayIconPathInjectable);
    const electronTray = di.inject(electronTrayInjectable);
    const workerPath = path.join(__dirname, "monitor-worker.js");

    return new MonitorSupervisor({
      workerPath,
      onAlert: (alert) => {
        sendMessageToChannel(monitorAlertChannel, alert);
      },
      onStatus: (status) => {
        sendMessageToChannel(monitorStatusUpdateChannel, status);
      },
      onStatusIcon: (severity) => {
        if (severity === "critical") {
          electronTray.setIconPath(getTrayIconPath("red"));
          return;
        }

        if (severity === "warning") {
          electronTray.setIconPath(getTrayIconPath("yellow"));
          return;
        }

        electronTray.setIconPath(getTrayIconPath(""));
      },
      onStatusMessage: (message) => {
        sendMessageToChannel(monitorStatusUpdateChannel, {
          clusterId: "*",
          health: "unknown",
          lastChecked: Date.now(),
          error: message,
        });
      },
    });
  },
  lifecycle: lifecycleEnum.singleton,
});

export default monitorSupervisorInjectable;
