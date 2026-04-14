/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { sidebarItemInjectionToken } from "@skuberplus/cluster-sidebar";
import { noop } from "lodash/fp";

const userManagementSidebarItemInjectable = getInjectable({
  id: "sidebar-item-user-management",

  instantiate: () => ({
    parentId: null,
    title: "Access Control",
    onClick: noop,
    orderNumber: 100,
  }),

  injectionToken: sidebarItemInjectionToken,
});

export default userManagementSidebarItemInjectable;
