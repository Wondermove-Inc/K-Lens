/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { asLegacyGlobalForExtensionApi } from "@skuberplus/legacy-global-di";
import { loggerInjectionToken } from "@skuberplus/logger";

// APIs
export { App } from "./app";
export * as Catalog from "./catalog";
export * as EventBus from "./event-bus";
export * as Proxy from "./proxy";
export * as Store from "./stores";
export * as Types from "./types";
export { Util } from "./utils";

export type { InstalledExtension, LensExtensionManifest } from "@skuberplus/legacy-extensions";
export type { Logger } from "@skuberplus/logger";

export type { PackageJson } from "type-fest";

export type { LensExtension } from "../lens-extension";

export const logger = asLegacyGlobalForExtensionApi(loggerInjectionToken);
