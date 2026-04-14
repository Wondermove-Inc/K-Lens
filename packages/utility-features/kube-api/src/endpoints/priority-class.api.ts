/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { PriorityClass } from "@skuberplus/kube-object";
import { KubeApi } from "../kube-api";

import type { PriorityClassData } from "@skuberplus/kube-object";

import type { DerivedKubeApiOptions, KubeApiDependencies } from "../kube-api";

export class PriorityClassApi extends KubeApi<PriorityClass, PriorityClassData> {
  constructor(deps: KubeApiDependencies, opts: DerivedKubeApiOptions = {}) {
    super(deps, {
      objectConstructor: PriorityClass,
      ...opts,
    });
  }
}
