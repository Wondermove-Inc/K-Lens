/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { apiKubeInjectionToken } from "@skuberplus/kube-api";
import { storesAndApisCanBeCreatedInjectionToken } from "@skuberplus/kube-api-specifics";
import assert from "assert";
import { apiBaseServerAddressInjectionToken } from "../../common/k8s-api/api-base-configs";
import createKubeJsonApiInjectable from "../../common/k8s-api/create-kube-json-api.injectable";
import windowLocationInjectable from "../../common/k8s-api/window-location.injectable";
import { apiKubePrefix } from "../../common/vars";
import isDevelopmentInjectable from "../../common/vars/is-development.injectable";
import { notificationPanelStore } from "../components/status-bar/items/notification-panel.store";

const apiKubeInjectable = getInjectable({
  id: "api-kube",
  instantiate: (di) => {
    assert(di.inject(storesAndApisCanBeCreatedInjectionToken), "apiKube is only available in certain environments");
    const createKubeJsonApi = di.inject(createKubeJsonApiInjectable);
    const apiBaseServerAddress = di.inject(apiBaseServerAddressInjectionToken);
    const isDevelopment = di.inject(isDevelopmentInjectable);
    const { host } = di.inject(windowLocationInjectable);

    const apiKube = createKubeJsonApi(
      {
        serverAddress: apiBaseServerAddress,
        apiBase: apiKubePrefix,
        debug: isDevelopment,
      },
      {
        headers: {
          Host: host,
        },
      },
    );

    apiKube.onError.addListener((error, res) => {
      switch (res.status) {
        case 403:
          error.isUsedForNotification = true;
          // 🎯 FIX-037: NotificationPanel으로 마이그레이션
          notificationPanelStore.addError(
            "system",
            "API Error",
            error instanceof Error ? error.message : String(error),
          );
          break;
      }
    });

    return apiKube;
  },
  injectionToken: apiKubeInjectionToken,
});

export default apiKubeInjectable;
