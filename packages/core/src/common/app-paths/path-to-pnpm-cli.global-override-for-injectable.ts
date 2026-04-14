/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getGlobalOverride } from "../../test-utils/get-global-override";
import pathToPnpmCliInjectable from "./path-to-pnpm-cli.injectable";

export default getGlobalOverride(pathToPnpmCliInjectable, () => "node_modules/pnpm/bin/pnpm.cjs");
