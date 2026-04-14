/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import { addHelmRepositoryChannel } from "../../../../../../../common/helm/add-helm-repository-channel";
import { notificationPanelStore } from "../../../../../../../renderer/components/status-bar/items/notification-panel.store";
import activeHelmRepositoriesInjectable from "../../active-helm-repositories.injectable";

import type { HelmRepo } from "../../../../../../../common/helm/helm-repo";

const addHelmRepositoryInjectable = getInjectable({
  id: "add-public-helm-repository",

  instantiate: (di) => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);
    const activeHelmRepositories = di.inject(activeHelmRepositoriesInjectable);

    return async (repository: HelmRepo) => {
      const result = await requestFromChannel(addHelmRepositoryChannel, repository);

      if (result.callWasSuccessful) {
        notificationPanelStore.addSuccess(
          "extensions",
          "Helm Repository Added",
          `Helm repository ${repository.name} has been added.`,
        );

        activeHelmRepositories.invalidate();
      } else {
        notificationPanelStore.addError("extensions", "Helm Repository Error", result.error);
      }
    };
  },
});

export default addHelmRepositoryInjectable;
