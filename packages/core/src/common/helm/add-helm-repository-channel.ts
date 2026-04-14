/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannel } from "@skuberplus/messaging";

import type { Result } from "@skuberplus/utilities";

import type { HelmRepo } from "./helm-repo";

export const addHelmRepositoryChannel = getRequestChannel<HelmRepo, Result<void, string>>(
  "add-helm-repository-channel",
);
