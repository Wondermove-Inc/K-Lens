/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRandomIdInjectionToken } from "@skuberplus/random";
import { getGlobalOverride } from "../../test-utils/get-global-override";

export default getGlobalOverride(getRandomIdInjectionToken, () => () => "some-irrelevant-random-id");
