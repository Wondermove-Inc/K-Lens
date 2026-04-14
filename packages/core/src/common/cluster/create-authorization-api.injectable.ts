/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { AuthorizationV1Api } from "@skuberplus/kubernetes-client-node";

import type { KubeConfig } from "@skuberplus/kubernetes-client-node";

export type CreateAuthorizationApi = (config: KubeConfig) => AuthorizationV1Api;

const createAuthorizationApiInjectable = getInjectable({
  id: "create-authorization-api",
  instantiate: (): CreateAuthorizationApi => (config) => config.makeApiClient(AuthorizationV1Api),
});

export default createAuthorizationApiInjectable;
