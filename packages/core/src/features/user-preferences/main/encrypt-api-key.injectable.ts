/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import electronSafeStorageInjectable from "../../../main/electron-app/electron-safe-storage.injectable";

// 🎯 목적: AI Provider 타입 정의 (ollama 추가)
export type AIProvider = "openai" | "anthropic" | "google" | "ollama" | "openrouter";

export interface EncryptedApiKeyService {
  /**
   * 목적: API 키를 암호화하여 저장
   *
   * @param provider - AI Provider (openai, anthropic, google)
   * @param apiKey - 평문 API 키
   * @returns 암호화된 데이터 (Buffer를 base64 문자열로 변환)
   */
  encryptApiKey(provider: AIProvider, apiKey: string): string;

  /**
   * 목적: 암호화된 API 키를 복호화
   *
   * @param provider - AI Provider (openai, anthropic, google)
   * @param encryptedData - 암호화된 데이터 (base64 문자열)
   * @returns 복호화된 평문 API 키
   */
  decryptApiKey(provider: AIProvider, encryptedData: string): string;

  /**
   * 목적: safeStorage가 사용 가능한지 확인
   *
   * @returns safeStorage 사용 가능 여부
   */
  isEncryptionAvailable(): boolean;
}

const encryptApiKeyInjectable = getInjectable({
  id: "encrypt-api-key",
  instantiate: (di): EncryptedApiKeyService => {
    const safeStorage = di.inject(electronSafeStorageInjectable);

    return {
      encryptApiKey: (provider: AIProvider, apiKey: string): string => {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error(`[encryptApiKey] safeStorage를 사용할 수 없습니다. Provider: ${provider}`);
        }

        // API 키를 Buffer로 변환 후 암호화
        const buffer = safeStorage.encryptString(apiKey);

        // 암호화된 Buffer를 base64 문자열로 변환하여 저장 가능하게 만듦
        return buffer.toString("base64");
      },

      decryptApiKey: (provider: AIProvider, encryptedData: string): string => {
        // safeStorage는 app.whenReady() 직후에도 OS 키체인 연결이 지연될 수 있음
        // 최대 3회 재시도하여 타이밍 이슈 방어
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (safeStorage.isEncryptionAvailable()) {
            const buffer = Buffer.from(encryptedData, "base64");

            return safeStorage.decryptString(buffer);
          }

          if (attempt < MAX_RETRIES) {
            console.warn(
              `[decryptApiKey] safeStorage 아직 사용 불가 (시도 ${attempt}/${MAX_RETRIES}). Provider: ${provider}`,
            );
            // 동기 대기 (busy-wait, Main Process에서 짧은 블로킹은 허용)
            const waitMs = attempt * 500;
            const start = Date.now();

            while (Date.now() - start < waitMs) {
              // busy-wait
            }
          }
        }

        throw new Error(
          `[decryptApiKey] safeStorage를 사용할 수 없습니다 (${MAX_RETRIES}회 재시도 후 실패). Provider: ${provider}`,
        );
      },

      isEncryptionAvailable: (): boolean => {
        return safeStorage.isEncryptionAvailable();
      },
    };
  },
});

export default encryptApiKeyInjectable;
