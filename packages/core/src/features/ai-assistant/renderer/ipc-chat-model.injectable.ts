/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: IPC Chat Model Injectable 정의
 *
 * Renderer에서 IPCChatModel을 생성하기 위한 DI 팩토리를 제공합니다.
 *
 * 📝 주의사항:
 * - IPC 채널 requester들을 주입받아 IPCChatModel 생성
 * - LLM Chat과 Structured Output 두 채널 모두 사용
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Extension Host 패턴 마이그레이션)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { requestFromChannelInjectionToken } from "@skuberplus/messaging";
import {
  type LLMChatRequest,
  type LLMStructuredOutputRequest,
  llmChatChannel,
  llmStructuredOutputChannel,
} from "../common/llm-chat-channel";
import { IPCChatModel } from "./ipc-chat-model";

import type { AIProvider } from "../../../common/features/user-preferences/encrypt-api-key-channel";

// ============================================
// 🎯 IPCChatModel 팩토리 타입
// ============================================

export type CreateIPCChatModel = (
  provider: AIProvider,
  modelId: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
  },
) => IPCChatModel;

// ============================================
// 🎯 IPCChatModel 팩토리 Injectable
// ============================================

/**
 * 🎯 IPCChatModel 팩토리 Injectable
 *
 * Provider와 모델 ID를 받아 IPCChatModel 인스턴스를 생성합니다.
 * API 키는 Main Process에서만 복호화됩니다.
 *
 * @example
 * ```typescript
 * const createModel = di.inject(createIPCChatModelInjectable);
 * const model = createModel("openai", "gpt-4o");
 * ```
 */
const createIPCChatModelInjectable = getInjectable({
  id: "ai-assistant-create-ipc-chat-model",
  instantiate: (di): CreateIPCChatModel => {
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);

    // 🎯 IPC 함수 바인딩 (명시적 타입 사용)
    const llmChat = (request: LLMChatRequest) => requestFromChannel(llmChatChannel, request);

    const llmStructuredOutput = (request: LLMStructuredOutputRequest) =>
      requestFromChannel(llmStructuredOutputChannel, request);

    // 🎯 팩토리 함수 반환
    return (provider, modelId, options) => {
      return new IPCChatModel({
        provider,
        modelId,
        llmChat,
        llmStructuredOutput,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });
    };
  },
});

export default createIPCChatModelInjectable;
