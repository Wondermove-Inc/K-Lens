/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getGlobalOverrideForFunction } from "../../test-utils/get-global-override-for-function";
import nodeFetchInjectable from "./node-fetch.injectable";

export default getGlobalOverrideForFunction(nodeFetchInjectable);
