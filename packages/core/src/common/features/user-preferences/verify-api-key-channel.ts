/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannel } from "@skuberplus/messaging";

import type { AIProvider } from "./encrypt-api-key-channel";

export interface VerifyApiKeyRequest {
  provider: AIProvider;
  apiKey: string;
}

export interface VerifyApiKeyResponse {
  valid: boolean;
  error?: string;
}

/**
 * 목적: AI Provider API Key 유효성 검증 요청 채널 (Renderer → Main)
 */
export const verifyApiKeyChannel = getRequestChannel<VerifyApiKeyRequest, VerifyApiKeyResponse>(
  "verify-api-key-channel",
);
