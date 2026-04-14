/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@skuberplus/messaging";
import { notificationPanelStore } from "../../../renderer/components/status-bar/items/notification-panel.store";
import { shellSyncFailedChannel } from "../common/failure-channel";

const shellSyncFailureListenerInjectable = getMessageChannelListenerInjectable({
  id: "notification",
  channel: shellSyncFailedChannel,
  getHandler: () => {
    return (errorMessage) =>
      notificationPanelStore.addError(
        "system",
        "Shell Sync Failed",
        `Failed to sync shell environment: ${errorMessage}`,
      );
  },
});

export default shellSyncFailureListenerInjectable;
