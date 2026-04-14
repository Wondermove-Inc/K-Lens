/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getMessageChannelListenerInjectable } from "@skuberplus/messaging";
import { syncBoxChannel } from "./channels";
import syncBoxStateInjectable from "./sync-box-state.injectable";

const syncBoxChannelListenerInjectable = getMessageChannelListenerInjectable({
  id: "init",
  channel: syncBoxChannel,
  getHandler:
    (di) =>
    ({ id, value }) =>
      di.inject(syncBoxStateInjectable, id).set(value),
});

export default syncBoxChannelListenerInjectable;
