/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { applicationInformationToken } from "@skuberplus/application";

const productNameInjectable = getInjectable({
  id: "product-name",
  instantiate: (di) => di.inject(applicationInformationToken).productName,
});

export default productNameInjectable;
