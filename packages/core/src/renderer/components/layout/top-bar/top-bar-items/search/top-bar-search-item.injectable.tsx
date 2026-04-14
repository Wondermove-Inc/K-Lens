/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { InlineCommandPalette } from "../../../../command-palette/inline-command-palette";
import { topBarItemOnLeftSideInjectionToken } from "../top-bar-item-injection-token";

const topBarSearchItemInjectable = getInjectable({
  id: "top-bar-search-item",

  instantiate: () => ({
    id: "top-bar-search",
    isShown: computed(() => true),
    orderNumber: 50,
    Component: InlineCommandPalette,
  }),

  injectionToken: topBarItemOnLeftSideInjectionToken,
});

export default topBarSearchItemInjectable;
