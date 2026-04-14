/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { runInAction } from "mobx";
import userPreferencesStateInjectable from "../../features/user-preferences/common/state.injectable";
import { notificationPanelStore } from "../components/status-bar/items/notification-panel.store";

const addSyncEntriesInjectable = getInjectable({
  id: "add-sync-entries",

  instantiate: (di) => {
    const state = di.inject(userPreferencesStateInjectable);

    return async (paths: string[]) => {
      runInAction(() => {
        for (const path of paths) {
          state.syncKubeconfigEntries.set(path, {});
        }
      });

      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      notificationPanelStore.addInfo(
        "cluster",
        "Kubeconfig Sync",
        "Selected items has been added to Kubeconfig Sync. Check Preferences to see full list.",
      );
    };
  },
});

export default addSyncEntriesInjectable;
