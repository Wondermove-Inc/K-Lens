/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import {
  customResourceDefinitionApiInjectable,
  storesAndApisCanBeCreatedInjectionToken,
} from "@skuberplus/kube-api-specifics";
import { loggerInjectionToken } from "@skuberplus/logger";
import assert from "assert";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForClusterScopedResourcesInjectable from "../../cluster-frame-context/for-cluster-scoped-resources.injectable";
import { CustomResourceDefinitionStore } from "./store";

const customResourceDefinitionStoreInjectable = getInjectable({
  id: "custom-resource-definition-store",
  instantiate: (di) => {
    assert(
      di.inject(storesAndApisCanBeCreatedInjectionToken),
      "customResourceDefinitionStore is only available in certain environments",
    );

    const api = di.inject(customResourceDefinitionApiInjectable);

    // 🔇 개발 로그 제거: CRD Store 인스턴스화 로그
    // console.info("[crd-store] instantiate 호출");

    return new CustomResourceDefinitionStore(
      {
        context: di.inject(clusterFrameContextForClusterScopedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
      },
      api,
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default customResourceDefinitionStoreInjectable;
