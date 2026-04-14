/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { EndpointsApi } from "@skuberplus/kube-api";
import type { Endpoints, EndpointsData } from "@skuberplus/kube-object";

export class EndpointsStore extends KubeObjectStore<Endpoints, EndpointsApi, EndpointsData> {}
