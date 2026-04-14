/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannel } from "@skuberplus/messaging";

// 🎯 목적: AI Provider 타입 정의 (ollama 추가)
export type AIProvider = "openai" | "anthropic" | "google" | "ollama" | "openrouter";

export interface EncryptApiKeyRequest {
  provider: AIProvider;
  apiKey: string;
}

export interface DecryptApiKeyRequest {
  provider: AIProvider;
  encryptedData: string;
}

/**
 * 목적: API 키 암호화 요청 채널 (Renderer → Main)
 */
export const encryptApiKeyChannel = getRequestChannel<EncryptApiKeyRequest, string>("encrypt-api-key-channel");

/**
 * 목적: API 키 복호화 요청 채널 (Renderer → Main)
 */
export const decryptApiKeyChannel = getRequestChannel<DecryptApiKeyRequest, string>("decrypt-api-key-channel");

/**
 * 목적: 암호화 사용 가능 여부 확인 채널 (Renderer → Main)
 */
export const isEncryptionAvailableChannel = getRequestChannel<void, boolean>("is-encryption-available-channel");
