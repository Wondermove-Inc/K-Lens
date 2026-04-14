/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { topBarItemOnLeftSideInjectionToken } from "../top-bar-item-injection-token";
import { NavigationControls } from "./navigation-controls";

const navigationControlsTopBarItemInjectable = getInjectable({
  id: "navigation-controls-top-bar-item",

  instantiate: () => ({
    id: "navigation-controls",
    isShown: computed(() => true),
    orderNumber: 20,
    Component: NavigationControls,
  }),

  injectionToken: topBarItemOnLeftSideInjectionToken,
});

export default navigationControlsTopBarItemInjectable;
