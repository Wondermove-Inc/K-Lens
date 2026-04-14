/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import {
  type AIProvider,
  decryptApiKeyChannel,
  encryptApiKeyChannel,
  isEncryptionAvailableChannel,
} from "../../../common/features/user-preferences/encrypt-api-key-channel";
import {
  type VerifyApiKeyResponse,
  verifyApiKeyChannel,
} from "../../../common/features/user-preferences/verify-api-key-channel";

export interface EncryptedApiKeyService {
  /**
   * 목적: API 키를 암호화하여 저장
   *
   * @param provider - AI Provider (openai, anthropic, google)
   * @param apiKey - 평문 API 키
   * @returns 암호화된 데이터 (base64 문자열)
   */
  encryptApiKey(provider: AIProvider, apiKey: string): Promise<string>;

  /**
   * 목적: 암호화된 API 키를 복호화
   *
   * @param provider - AI Provider (openai, anthropic, google)
   * @param encryptedData - 암호화된 데이터 (base64 문자열)
   * @returns 복호화된 평문 API 키
   */
  decryptApiKey(provider: AIProvider, encryptedData: string): Promise<string>;

  /**
   * 목적: safeStorage가 사용 가능한지 확인
   *
   * @returns safeStorage 사용 가능 여부
   */
  isEncryptionAvailable(): Promise<boolean>;

  /**
   * 목적: AI Provider API Key의 실제 유효성을 API 호출로 검증
   *
   * @param provider - AI Provider (openai, anthropic)
   * @param apiKey - 검증할 API 키
   * @returns 검증 결과 (valid + 에러 메시지)
   */
  verifyApiKey(provider: AIProvider, apiKey: string): Promise<VerifyApiKeyResponse>;
}

const encryptApiKeyInjectable = getInjectable({
  id: "encrypt-api-key-renderer",
  instantiate: (di): EncryptedApiKeyService => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return {
      encryptApiKey: async (provider: AIProvider, apiKey: string): Promise<string> => {
        return await requestFromChannel(encryptApiKeyChannel, { provider, apiKey });
      },

      decryptApiKey: async (provider: AIProvider, encryptedData: string): Promise<string> => {
        return await requestFromChannel(decryptApiKeyChannel, { provider, encryptedData });
      },

      isEncryptionAvailable: async (): Promise<boolean> => {
        return await requestFromChannel(isEncryptionAvailableChannel);
      },

      verifyApiKey: async (provider: AIProvider, apiKey: string): Promise<VerifyApiKeyResponse> => {
        return await requestFromChannel(verifyApiKeyChannel, { provider, apiKey });
      },
    };
  },
});

export default encryptApiKeyInjectable;
