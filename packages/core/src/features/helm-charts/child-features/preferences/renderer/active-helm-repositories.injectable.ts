/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { asyncComputed } from "@ogre-tools/injectable-react";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import { runInAction } from "mobx";
import { getActiveHelmRepositoriesChannel } from "../../../../../common/helm/get-active-helm-repositories-channel";
import { notificationPanelStore } from "../../../../../renderer/components/status-bar/items/notification-panel.store";
import helmRepositoriesErrorStateInjectable from "./helm-repositories-error-state.injectable";

const activeHelmRepositoriesInjectable = getInjectable({
  id: "active-helm-repositories",

  instantiate: (di) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);
    const helmRepositoriesErrorState = di.inject(helmRepositoriesErrorStateInjectable);

    return asyncComputed({
      getValueFromObservedPromise: async () => {
        const result = await requestFromChannel(getActiveHelmRepositoriesChannel);

        if (result.callWasSuccessful) {
          return result.response;
        } else {
          notificationPanelStore.addError("extensions", "Helm Repositories Error", result.error);

          runInAction(() =>
            helmRepositoriesErrorState.set({
              controlsAreShown: false,
              errorMessage: result.error,
            }),
          );

          return [];
        }
      },

      valueWhenPending: [],
    });
  },
});

export default activeHelmRepositoriesInjectable;
