/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import {
  decryptApiKeyChannel,
  encryptApiKeyChannel,
  isEncryptionAvailableChannel,
} from "../../../common/features/user-preferences/encrypt-api-key-channel";
import encryptApiKeyInjectable from "./encrypt-api-key.injectable";

/**
 * 목적: 암호화 요청 IPC 핸들러 (Renderer → Main)
 */
export const encryptApiKeyChannelResponderInjectable = getRequestChannelListenerInjectable({
  id: "encrypt-api-key-channel-responder-listener",
  channel: encryptApiKeyChannel,
  getHandler: (di) => {
    const service = di.inject(encryptApiKeyInjectable);

    return (req) => service.encryptApiKey(req.provider, req.apiKey);
  },
});

/**
 * 목적: 복호화 요청 IPC 핸들러 (Renderer → Main)
 */
export const decryptApiKeyChannelResponderInjectable = getRequestChannelListenerInjectable({
  id: "decrypt-api-key-channel-responder-listener",
  channel: decryptApiKeyChannel,
  getHandler: (di) => {
    const service = di.inject(encryptApiKeyInjectable);

    return (req) => service.decryptApiKey(req.provider, req.encryptedData);
  },
});

/**
 * 목적: 암호화 사용 가능 여부 확인 IPC 핸들러 (Renderer → Main)
 */
export const isEncryptionAvailableChannelResponderInjectable = getRequestChannelListenerInjectable({
  id: "is-encryption-available-channel-responder-listener",
  channel: isEncryptionAvailableChannel,
  getHandler: (di) => {
    const service = di.inject(encryptApiKeyInjectable);

    return () => service.isEncryptionAvailable();
  },
});
