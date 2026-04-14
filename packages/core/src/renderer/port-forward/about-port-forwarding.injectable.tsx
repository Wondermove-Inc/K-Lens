/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { notificationPanelStore } from "../components/status-bar/items/notification-panel.store";

const aboutPortForwardingInjectable = getInjectable({
  id: "about-port-forwarding",

  instantiate: () => {
    return () => {
      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      notificationPanelStore.addInfo(
        "network",
        "Port Forwarding",
        "You can manage your port forwards on the Port Forwarding Page.",
      );
    };
  },
});

export default aboutPortForwardingInjectable;
