/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import operatingSystemThemeInjectable from "../../../../main/theme/operating-system-theme.injectable";
import { initialSystemThemeTypeChannel } from "../common/channels";

const initialSystemThemeTypeHandler = getRequestChannelListenerInjectable({
  id: "initial-system-theme-type-listener",
  channel: initialSystemThemeTypeChannel,
  getHandler: (di) => {
    const operatingSystemTheme = di.inject(operatingSystemThemeInjectable);

    return () => operatingSystemTheme.get();
  },
});

export default initialSystemThemeTypeHandler;
