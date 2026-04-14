/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { NodeMetrics } from "@skuberplus/kube-object";
import { KubeApi } from "../kube-api";

import type { NodeMetricsData } from "@skuberplus/kube-object";

import type { DerivedKubeApiOptions, KubeApiDependencies } from "../kube-api";

export class NodeMetricsApi extends KubeApi<NodeMetrics, NodeMetricsData> {
  constructor(deps: KubeApiDependencies, opts: DerivedKubeApiOptions = {}) {
    super(deps, {
      ...opts,
      objectConstructor: NodeMetrics,
    });
  }
}
