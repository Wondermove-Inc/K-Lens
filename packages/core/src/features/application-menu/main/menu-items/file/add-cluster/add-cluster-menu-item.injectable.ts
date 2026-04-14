/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import broadcastMessageInjectable from "../../../../../../common/ipc/broadcast-message.injectable";
import { IpcRendererNavigationEvents } from "../../../../../../common/ipc/navigation-events";
import applicationMenuItemInjectionToken from "../../application-menu-item-injection-token";

const addClusterMenuItemInjectable = getInjectable({
  id: "add-cluster-application-menu-item",

  instantiate: (di) => {
    const broadcastMessage = di.inject(broadcastMessageInjectable);

    return {
      kind: "clickable-menu-item" as const,
      parentId: "file",
      id: "add-cluster",
      orderNumber: 10,
      label: "Add Cluster",
      keyboardShortcut: "CmdOrCtrl+Shift+A",

      onClick: () => {
        // 🎯 shadcn 스타일 AddClusterDialog 열기
        broadcastMessage(IpcRendererNavigationEvents.OPEN_ADD_CLUSTER_DIALOG);
      },
    };
  },

  injectionToken: applicationMenuItemInjectionToken,
});

export default addClusterMenuItemInjectable;
