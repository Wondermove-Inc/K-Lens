/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { safeStorage } from "electron";

/**
 * 목적: Electron safeStorage API 주입
 *
 * Electron safeStorage는 시스템 키체인을 사용하여 민감한 데이터를 암호화합니다:
 * - macOS: Keychain
 * - Windows: Credential Vault
 * - Linux: Secret Service API
 */
const electronSafeStorageInjectable = getInjectable({
  id: "electron-safe-storage",
  instantiate: () => safeStorage,
  causesSideEffects: true,
});

export default electronSafeStorageInjectable;
