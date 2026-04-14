/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { EndpointSliceApi } from "@skuberplus/kube-api";
import type { EndpointSlice, EndpointSliceData } from "@skuberplus/kube-object";

export class EndpointSliceStore extends KubeObjectStore<EndpointSlice, EndpointSliceApi, EndpointSliceData> {}
