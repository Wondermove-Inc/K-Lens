/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { type BaseChatModelCallOptions, SimpleChatModel } from "@langchain/core/language_models/chat_models";

import type { BaseMessage } from "@langchain/core/messages";

import type { OllamaService } from "./ollama-service.injectable";

// ============================================
// 🎯 Ollama Chat Model (IPC 기반)
// - LangChain 호환 Chat Model
// - Renderer에서 Main Process를 통해 Ollama 요청
// - CORS/Electron 보안 정책 우회
// ============================================

export interface OllamaChatModelParams {
  model: string;
  baseUrl: string;
  ollamaService: OllamaService;
  temperature?: number;
}

/**
 * 🎯 IPC 기반 Ollama Chat Model
 * - LangChain의 SimpleChatModel을 상속
 * - Main Process를 통해 Ollama API 호출
 */
export class OllamaChatModel extends SimpleChatModel<BaseChatModelCallOptions> {
  private model: string;
  private baseUrl: string;
  private ollamaService: OllamaService;

  constructor(params: OllamaChatModelParams) {
    super({});
    this.model = params.model;
    this.baseUrl = params.baseUrl;
    this.ollamaService = params.ollamaService;
  }

  _llmType(): string {
    return "ollama-ipc";
  }

  /**
   * 🎯 LangChain 호출 구현
   * - messages를 Ollama 포맷으로 변환
   * - IPC를 통해 Main Process에서 실행
   */
  async _call(messages: BaseMessage[]): Promise<string> {
    // 🎯 LangChain 메시지를 Ollama 포맷으로 변환
    const ollamaMessages = messages.map((msg) => {
      let role: "system" | "user" | "assistant" = "user";

      if (msg._getType() === "system") {
        role = "system";
      } else if (msg._getType() === "ai") {
        role = "assistant";
      } else {
        role = "user";
      }

      return {
        role,
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      };
    });

    // 🎯 IPC를 통해 Main Process에서 Ollama 호출
    const result = await this.ollamaService.chat(this.baseUrl, this.model, ollamaMessages);

    if (result.success && result.message) {
      return result.message;
    }

    throw new Error(`Ollama 요청 실패: ${result.error || "Unknown error"}`);
  }
}
