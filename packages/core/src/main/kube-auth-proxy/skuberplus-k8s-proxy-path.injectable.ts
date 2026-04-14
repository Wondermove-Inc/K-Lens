/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import bundledBinaryPathInjectable from "../../common/utils/bundled-binary-path.injectable";

const skuberPlusK8sProxyPathInjectable = getInjectable({
  id: "skuberplus-k8s-proxy-path",
  instantiate: (di) => di.inject(bundledBinaryPathInjectable, "skuberplus-k8s-proxy"),
});

export default skuberPlusK8sProxyPathInjectable;
