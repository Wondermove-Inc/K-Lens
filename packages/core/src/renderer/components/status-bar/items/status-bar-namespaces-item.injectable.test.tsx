/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { storesAndApisCanBeCreatedInjectionToken } from "@skuberplus/kube-api-specifics";
import { computed } from "mobx";
import activeKubernetesClusterInjectable from "../../../cluster-frame-context/active-kubernetes-cluster.injectable";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import statusBarNamespacesItemInjectable from "./status-bar-namespaces-item.injectable";

describe("status-bar-namespaces-item.injectable", () => {
  it("falls back gracefully when namespace store is unavailable", () => {
    const di = getDiForUnitTesting();

    di.override(storesAndApisCanBeCreatedInjectionToken, () => false);
    di.override(
      activeKubernetesClusterInjectable,
      () =>
        computed(() => ({
          metadata: { name: "cluster" },
        })) as ReturnType<typeof activeKubernetesClusterInjectable.instantiate>,
    );

    const item = di.inject(statusBarNamespacesItemInjectable);

    expect(item.tooltip?.get()).toBe("Namespace metrics unavailable for this view.");
  });
});
