/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import kubeconfigDialogStateInjectable from "./state.injectable";

import type { StrictReactNode } from "@skuberplus/utilities";

export interface OpenKubeconfigDialogArgs {
  title?: StrictReactNode;
  loader: () => Promise<string>;
}

export type OpenKubeconfigDialog = (openArgs: OpenKubeconfigDialogArgs) => void;

const openKubeconfigDialogInjectable = getInjectable({
  id: "open-kubeconfig-dialog",
  instantiate: (di): OpenKubeconfigDialog => {
    const state = di.inject(kubeconfigDialogStateInjectable);
    const logger = di.inject(loggerInjectionToken);

    return ({ title, loader }) => {
      (async () => {
        try {
          const config = await loader();

          state.set({ title, config });
        } catch (error) {
          // 🎯 FIX-037: NotificationPanel으로 마이그레이션
          notificationPanelStore.addCheckedError("cluster", error, "Failed to retrieve config for dialog");
          logger.warn("[KUBECONFIG-DIALOG]: failed to retrieve config for dialog", error);
        }
      })();
    };
  },
});

export default openKubeconfigDialogInjectable;
