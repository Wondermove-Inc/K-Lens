/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannel } from "@skuberplus/messaging";

import type { AppPaths } from "./app-path-injection-token";

export const appPathsChannel = getRequestChannel<void, AppPaths>("app-paths");
