/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { EndpointSlice } from "@skuberplus/kube-object";
import { KubeApi } from "../kube-api";

import type { EndpointSliceData } from "@skuberplus/kube-object";

import type { DerivedKubeApiOptions, KubeApiDependencies } from "../kube-api";

export class EndpointSliceApi extends KubeApi<EndpointSlice, EndpointSliceData> {
  constructor(deps: KubeApiDependencies, opts: DerivedKubeApiOptions = {}) {
    super(deps, {
      objectConstructor: EndpointSlice,
      ...opts,
    });
  }
}
