/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { CloudCheck } from "lucide-react";
import { computed } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";
import activeKubernetesClusterInjectable from "../../../cluster-frame-context/active-kubernetes-cluster.injectable";
import { statusBarItemInjectionToken } from "../status-bar-item-injection-token";
import { StatusBarSimpleItem } from "../status-bar-simple-item";

const providerLabels: Record<string, string> = {
  aks: "Azure AKS",
  eks: "Amazon EKS",
  gke: "Google GKE",
  iks: "IBM IKS",
  digitalocean: "DigitalOcean",
  "docker-desktop": "Docker Desktop",
  kind: "kind",
  minikube: "Minikube",
  microk8s: "MicroK8s",
  rancher: "Rancher",
  "rancher-desktop": "Rancher Desktop",
  rke: "RKE",
  rke2: "RKE2",
  vmware: "VMware",
  openshift: "OpenShift",
  tencent: "Tencent TKE",
  alibaba: "Alibaba ACK",
  huawei: "Huawei CCE",
  custom: "Custom",
  unknown: "Unknown",
};

const getProviderLabel = (cluster: { metadata?: { distro?: string | null } } | null | undefined) => {
  const distro = cluster?.metadata?.distro?.toLowerCase() ?? "unknown";

  return providerLabels[distro] ?? providerLabels.custom;
};

const statusBarClusterProviderItemInjectable = getInjectable({
  id: "status-bar-cluster-provider-item",

  instantiate: (di) => {
    const activeCluster = di.inject(activeKubernetesClusterInjectable);
    const providerLabel = computed(() => getProviderLabel(activeCluster.get()));

    const tooltip = computed(() => {
      const cluster = activeCluster.get();

      if (!cluster) {
        return "No cluster connected";
      }

      return `Provider: ${providerLabel.get()}`;
    });

    const component = observer(() => (
      <StatusBarSimpleItem icon={CloudCheck} label={providerLabel.get()} muted={!activeCluster.get()} />
    ));

    return {
      origin: "core",
      component,
      position: "left" as const,
      priority: 10,
      visible: computed(() => false),
      tooltip,
    };
  },

  injectionToken: statusBarItemInjectionToken,
});

export default statusBarClusterProviderItemInjectable;
