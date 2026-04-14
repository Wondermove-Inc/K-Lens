/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { clusterFrameChildComponentInjectionToken } from "@skuberplus/react-application";
import { computed } from "mobx";
import { KubeObjectDetails } from "./kube-object-details";

const kubeObjectDetailsClusterFrameChildComponentInjectable = getInjectable({
  id: "kube-object-details-cluster-frame-child-component",

  instantiate: () => ({
    id: "kube-object-details",
    shouldRender: computed(() => true),
    Component: KubeObjectDetails,
  }),

  injectionToken: clusterFrameChildComponentInjectionToken,
});

export default kubeObjectDetailsClusterFrameChildComponentInjectable;
