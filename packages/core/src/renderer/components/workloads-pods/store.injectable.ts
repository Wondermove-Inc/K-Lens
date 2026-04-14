/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import {
  podApiInjectable,
  podMetricsApiInjectable,
  storesAndApisCanBeCreatedInjectionToken,
} from "@skuberplus/kube-api-specifics";
import { loggerInjectionToken } from "@skuberplus/logger";
import assert from "assert";
import apiBaseInjectable from "../../../common/k8s-api/api-base.injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForNamespacedResourcesInjectable from "../../cluster-frame-context/for-namespaced-resources.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { PodStore } from "./store";

const podStoreInjectable = getInjectable({
  id: "pod-store",
  instantiate: (di) => {
    assert(di.inject(storesAndApisCanBeCreatedInjectionToken), "podStore is only available in certain environments");

    const api = di.inject(podApiInjectable);

    return new PodStore(
      {
        podMetricsApi: di.inject(podMetricsApiInjectable),
        apiBase: di.inject(apiBaseInjectable),
        context: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
        // 🔧 수정: hostedCluster 사용 (preferences 접근을 위한 올바른 경로)
        hostedCluster: di.inject(hostedClusterInjectable),
      },
      api,
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default podStoreInjectable;
