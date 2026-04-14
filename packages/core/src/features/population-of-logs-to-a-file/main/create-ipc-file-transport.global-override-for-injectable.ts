/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { noop } from "@skuberplus/utilities";
import { getGlobalOverride } from "../../../test-utils/get-global-override";
import createIpcFileLoggerTransportInjectable from "./create-ipc-file-transport.injectable";

import type { transports } from "winston";

export default getGlobalOverride(
  createIpcFileLoggerTransportInjectable,
  () => () =>
    ({
      log: noop,
      close: noop,
    }) as typeof transports.File,
);
