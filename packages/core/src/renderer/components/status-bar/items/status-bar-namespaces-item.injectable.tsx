/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { storesAndApisCanBeCreatedInjectionToken } from "@skuberplus/kube-api-specifics";
import { Layers } from "lucide-react";
import { computed } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import activeKubernetesClusterInjectable from "../../../cluster-frame-context/active-kubernetes-cluster.injectable";
import namespaceStoreInjectable from "../../namespaces/store.injectable";
import { statusBarItemInjectionToken } from "../status-bar-item-injection-token";
import { StatusBarSimpleItem } from "../status-bar-simple-item";

import type { NamespaceStore } from "../../namespaces/store";

const ALL_NAMESPACES_LABEL = "All Namespaces";

const statusBarNamespacesItemInjectable = getInjectable({
  id: "status-bar-namespaces-item",

  instantiate: (di) => {
    const activeCluster = di.inject(activeKubernetesClusterInjectable);
    const storesAvailable = di.inject(storesAndApisCanBeCreatedInjectionToken);
    let namespaceStore: NamespaceStore | undefined;

    const getNamespaceStore = () => {
      if (!storesAvailable) {
        return undefined;
      }

      if (!namespaceStore) {
        namespaceStore = di.inject(namespaceStoreInjectable);
      }

      return namespaceStore;
    };

    const label = computed(() => {
      if (!activeCluster.get()) {
        return ALL_NAMESPACES_LABEL;
      }

      const store = getNamespaceStore();

      if (!store) {
        return ALL_NAMESPACES_LABEL;
      }

      const selected = store.contextNamespaces;

      if (store.hasAllContexts || selected.length === 0) {
        return ALL_NAMESPACES_LABEL;
      }

      if (selected.length === 1) {
        return selected[0];
      }

      return `${selected.length} namespaces`;
    });

    const tooltip = computed(() => {
      if (!activeCluster.get()) {
        return "No cluster connected.";
      }

      const store = getNamespaceStore();

      if (!store) {
        return "Namespace metrics unavailable for this view.";
      }

      const selected = store.contextNamespaces;

      if (store.hasAllContexts || selected.length === 0) {
        return "All namespaces are selected.";
      }

      return selected.join(", ");
    });

    const component = observer(() => (
      <StatusBarSimpleItem icon={Layers} label={label.get()} muted={!activeCluster.get()} />
    ));

    return {
      origin: "core",
      component,
      position: "left" as const,
      priority: 30,
      visible: computed(() => false),
      tooltip,
    };
  },

  injectionToken: statusBarItemInjectionToken,
});

export default statusBarNamespacesItemInjectable;
