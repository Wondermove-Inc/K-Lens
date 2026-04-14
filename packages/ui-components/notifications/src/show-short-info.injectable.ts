/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { showInfoNotificationInjectable } from "./show-info-notification.injectable";

import type { ShowNotification } from "./message-utils";

export const showShortInfoNotificationInjectable = getInjectable({
  id: "show-short-info-notification",
  instantiate: (di): ShowNotification => {
    const showInfoNotification = di.inject(showInfoNotificationInjectable);

    return (message, customOpts = {}) => {
      return showInfoNotification(message, {
        timeout: 5_000,
        ...customOpts,
      });
    };
  },
});
