/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import navigateToPortForwardsInjectable from "../../common/front-end-routing/routes/cluster/network/port-forwards/navigate-to-port-forwards.injectable";
import { notificationPanelStore } from "../components/status-bar/items/notification-panel.store";

const notifyErrorPortForwardingInjectable = getInjectable({
  id: "notify-error-port-forwarding",

  instantiate: (di) => {
    const navigateToPortForwards = di.inject(navigateToPortForwardsInjectable);

    return (msg: string) => {
      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      notificationPanelStore.addError("network", "Port Forwarding Error", msg, {
        actionButton: {
          label: "Check Port Forwarding",
          onClick: () => {
            navigateToPortForwards();
          },
        },
      });
    };
  },
});

export default notifyErrorPortForwardingInjectable;
