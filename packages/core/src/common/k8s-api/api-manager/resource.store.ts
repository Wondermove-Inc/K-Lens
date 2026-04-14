/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObjectStore } from "../kube-object.store";

import type { KubeApi } from "@skuberplus/kube-api";
import type { KubeObject } from "@skuberplus/kube-object";

import type { KubeObjectStoreDependencies } from "../kube-object.store";

export class CustomResourceStore<K extends KubeObject> extends KubeObjectStore<K, KubeApi<K>> {
  constructor(deps: KubeObjectStoreDependencies, api: KubeApi<K>) {
    super(deps, api);
  }
}
