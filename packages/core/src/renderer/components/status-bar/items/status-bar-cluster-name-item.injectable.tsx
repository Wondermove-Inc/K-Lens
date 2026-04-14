/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { Server } from "lucide-react";
import { computed } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import activeKubernetesClusterInjectable from "../../../cluster-frame-context/active-kubernetes-cluster.injectable";
import { statusBarItemInjectionToken } from "../status-bar-item-injection-token";
import { StatusBarSimpleItem } from "../status-bar-simple-item";

const statusBarClusterNameItemInjectable = getInjectable({
  id: "status-bar-cluster-name-item",

  instantiate: (di) => {
    const activeCluster = di.inject(activeKubernetesClusterInjectable);

    const label = computed(() => activeCluster.get()?.metadata?.name ?? "No Cluster");
    const tooltip = computed(() => {
      const cluster = activeCluster.get();

      if (!cluster) {
        return "클러스터가 연결되어 있지 않습니다.";
      }

      return `Cluster: ${cluster.metadata.name}\nContext: ${cluster.spec?.kubeconfigContext ?? "unknown"}`;
    });

    const component = observer(() => (
      <StatusBarSimpleItem icon={Server} label={label.get()} muted={!activeCluster.get()} />
    ));

    return {
      origin: "core",
      component,
      position: "left" as const,
      priority: 20,
      visible: computed(() => false),
      tooltip,
      // 🎯 클릭 시 아무 동작 없음 (onClick 제거)
    };
  },

  injectionToken: statusBarItemInjectionToken,
});

export default statusBarClusterNameItemInjectable;
