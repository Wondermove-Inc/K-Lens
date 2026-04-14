/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannel } from "@skuberplus/messaging";

import type { Result } from "@skuberplus/utilities";

import type { DownloadJsonOptions } from "../../main/fetch/download-json.injectable";

export const downloadJsonChannel = getRequestChannel<
  { url: string; opts: DownloadJsonOptions },
  Result<unknown, string>
>("download-json-channel");
