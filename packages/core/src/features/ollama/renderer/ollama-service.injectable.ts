/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import {
  type OllamaChatResponse,
  type OllamaListRunningModelsResponse,
  type OllamaTestConnectionResponse,
  ollamaChatChannel,
  ollamaListRunningModelsChannel,
  ollamaTestConnectionChannel,
} from "../../../common/features/ollama/ollama-channel";

// ============================================
// 🎯 Ollama 서비스 인터페이스
// - Renderer에서 IPC를 통해 Main Process로 요청
// ============================================
export interface OllamaService {
  /**
   * 🎯 Ollama 서버 연결 테스트
   * @param baseUrl - Ollama 서버 URL (기본: http://localhost:11434)
   * @returns 연결 결과 (성공 여부, 모델 수, 모델 목록)
   */
  testConnection(baseUrl: string): Promise<OllamaTestConnectionResponse>;

  /**
   * 🎯 Ollama Chat 요청
   * @param baseUrl - Ollama 서버 URL
   * @param model - 모델명 (예: gemma3:4b)
   * @param messages - 대화 메시지 배열
   * @returns Chat 응답
   */
  chat(
    baseUrl: string,
    model: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ): Promise<OllamaChatResponse>;

  /**
   * 🎯 실행 중인 모델 목록 조회
   * @param baseUrl - Ollama 서버 URL
   * @returns 현재 메모리에 로드된 모델 목록
   */
  listRunningModels(baseUrl: string): Promise<OllamaListRunningModelsResponse>;
}

const ollamaServiceInjectable = getInjectable({
  id: "ollama-service-renderer",
  instantiate: (di): OllamaService => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    return {
      testConnection: async (baseUrl: string): Promise<OllamaTestConnectionResponse> => {
        return await requestFromChannel(ollamaTestConnectionChannel, { baseUrl });
      },

      chat: async (
        baseUrl: string,
        model: string,
        messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
      ): Promise<OllamaChatResponse> => {
        return await requestFromChannel(ollamaChatChannel, {
          baseUrl,
          model,
          messages,
          stream: false,
        });
      },

      listRunningModels: async (baseUrl: string): Promise<OllamaListRunningModelsResponse> => {
        return await requestFromChannel(ollamaListRunningModelsChannel, { baseUrl });
      },
    };
  },
});

export default ollamaServiceInjectable;
