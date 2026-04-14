/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { historyInjectionToken } from "@skuberplus/routing";
import { createMemoryHistory } from "history";
import { getGlobalOverride } from "../../test-utils/get-global-override";

export default getGlobalOverride(historyInjectionToken, () => createMemoryHistory());
