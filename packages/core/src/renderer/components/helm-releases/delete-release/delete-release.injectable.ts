/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import requestDeleteHelmReleaseInjectable from "../../../../common/k8s-api/endpoints/helm-releases.api/request-delete.injectable";
import hostedClusterInjectable from "../../../cluster-frame-context/hosted-cluster.injectable";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import releasesInjectable from "../releases.injectable";

import type { HelmRelease } from "../../../../common/k8s-api/endpoints/helm-releases.api";

const deleteReleaseInjectable = getInjectable({
  id: "delete-release",

  instantiate: (di) => {
    const releases = di.inject(releasesInjectable);
    const requestDeleteHelmRelease = di.inject(requestDeleteHelmReleaseInjectable);
    const hostedCluster = di.inject(hostedClusterInjectable);

    return async (release: HelmRelease) => {
      const releaseName = release.getName();
      const namespace = release.getNs();

      await requestDeleteHelmRelease(releaseName, namespace);

      releases.invalidate();

      // 🎯 FIX-038: clusterName을 metadata로만 전달 (description에서 제거)
      const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addSuccess(
        "operations",
        "Helm Release Deleted",
        `${releaseName} deleted successfully from namespace ${namespace}`,
        {
          actionType: "delete",
          resourceKind: "HelmRelease",
          resourceName: releaseName,
          namespace,
          clusterName,
        },
      );
    };
  },
});

export default deleteReleaseInjectable;
