/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import openLinkInBrowserInjectable from "../../common/utils/open-link-in-browser.injectable";
import { notificationPanelStore } from "../components/status-bar/items/notification-panel.store";
import { portForwardAddress } from "./port-forward-utils";

import type { ForwardedPort } from "./port-forward-item";

export type OpenPortForward = (portForward: ForwardedPort) => void;

const openPortForwardInjectable = getInjectable({
  id: "open-port-forward",
  instantiate: (di): OpenPortForward => {
    const openLinkInBrowser = di.inject(openLinkInBrowserInjectable);
    const logger = di.inject(loggerInjectionToken);

    return (portForward) => {
      const browseTo = portForwardAddress(portForward);

      openLinkInBrowser(browseTo).catch((error) => {
        logger.error(`failed to open in browser: ${error}`, {
          port: portForward.port,
          kind: portForward.kind,
          namespace: portForward.namespace,
          name: portForward.name,
        });
        // 🎯 FIX-037: NotificationPanel으로 마이그레이션
        notificationPanelStore.addError("network", "Failed to Open Browser", `Failed to open ${browseTo} in browser`);
      });
    };
  },
});

export default openPortForwardInjectable;
