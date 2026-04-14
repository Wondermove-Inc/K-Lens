/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannel } from "@skuberplus/messaging";

export const resolveSystemProxyChannel = getRequestChannel<string, string>("resolve-system-proxy-channel");
