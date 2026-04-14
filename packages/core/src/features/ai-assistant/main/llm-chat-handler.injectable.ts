/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant의 LLM Chat IPC 핸들러
 *
 * Renderer에서 요청된 LLM 호출을 Main Process에서 실행합니다.
 * API 키는 Main Process에서만 복호화되어 보안을 강화합니다.
 *
 * 📝 주의사항:
 * - API 키는 절대 Renderer로 전송되지 않음
 * - LLM 응답 내용만 Renderer로 반환
 * - Ollama는 별도의 IPC 채널 사용 (기존 유지)
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Extension Host 패턴 마이그레이션)
 */

import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { loggerInjectionToken } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import { classifyLLMError, llmChatChannel, llmStructuredOutputChannel } from "../common/llm-chat-channel";
import llmModelFactoryInjectable from "./llm-model-factory.injectable";

import type { BaseMessage } from "@langchain/core/messages";

import type { LLMChatResponse, LLMStructuredOutputResponse, SerializedMessage } from "../common/llm-chat-channel";

// ============================================
// 🎯 메시지 직렬화/역직렬화 유틸리티
// ============================================

/**
 * 🎯 직렬화된 메시지를 LangChain BaseMessage로 변환
 *
 * @param serialized - IPC로 받은 직렬화된 메시지
 * @returns LangChain BaseMessage
 */
function deserializeMessage(serialized: SerializedMessage): BaseMessage {
  switch (serialized.role) {
    case "system":
      return new SystemMessage(serialized.content);
    case "user":
      return new HumanMessage(serialized.content);
    case "assistant":
      return new AIMessage(serialized.content);
    case "tool":
      return new ToolMessage({
        content: serialized.content,
        tool_call_id: serialized.tool_call_id ?? "",
        name: serialized.name,
      });
    default:
      // 기본값: HumanMessage
      return new HumanMessage(serialized.content);
  }
}

/**
 * 🎯 직렬화된 메시지 배열을 LangChain BaseMessage 배열로 변환
 */
function deserializeMessages(serialized: SerializedMessage[]): BaseMessage[] {
  return serialized.map(deserializeMessage);
}

// ============================================
// 🎯 LLM Chat IPC 핸들러
// ============================================

/**
 * 🎯 LLM Chat IPC 핸들러
 *
 * Main Process에서 LLM 호출을 실행하고 결과를 반환합니다.
 */
const llmChatHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-llm-chat-handler",
  channel: llmChatChannel,
  getHandler: (di) => {
    const modelFactory = di.inject(llmModelFactoryInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (request): Promise<LLMChatResponse> => {
      const { provider, modelId, messages, options } = request;

      logger.info(`[LLM-Chat] Request: provider=${provider}, model=${modelId}, messages=${messages.length}`);

      // 🎯 Ollama는 별도 채널 사용 (기존 올라마 IPC 유지)
      if (provider === "ollama") {
        logger.warn("[LLM-Chat] Ollama uses a separate IPC channel");
        return {
          success: false,
          error: {
            type: "INTERNAL",
            message: "Ollama uses a separate IPC channel.",
          },
        };
      }

      try {
        // 🎯 모델 생성 (API 키 복호화는 내부에서 처리)
        const model = modelFactory.createModel(provider, modelId, options);

        // 🎯 메시지 역직렬화
        const langchainMessages = deserializeMessages(messages);

        // 🎯 LLM 호출
        logger.debug("[LLM-Chat] LLM 호출 시작...");
        const result = await model.invoke(langchainMessages);

        // 🎯 응답 추출
        const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);

        logger.info(`[LLM-Chat] Response: ${content.length} chars`);

        return {
          success: true,
          content,
        };
      } catch (error) {
        logger.error("[LLM-Chat] Error:", error);

        return {
          success: false,
          error: classifyLLMError(error),
        };
      }
    };
  },
});

// ============================================
// 🎯 Structured Output IPC 핸들러
// ============================================

/**
 * 🎯 LLM Structured Output IPC 핸들러
 *
 * JSON 스키마 기반으로 구조화된 응답을 요청합니다.
 */
const llmStructuredOutputHandlerInjectable = getRequestChannelListenerInjectable({
  id: "ai-assistant-llm-structured-output-handler",
  channel: llmStructuredOutputChannel,
  getHandler: (di) => {
    const modelFactory = di.inject(llmModelFactoryInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (request): Promise<LLMStructuredOutputResponse> => {
      const { provider, modelId, messages, schema, schemaName, options } = request;

      logger.info(`[LLM-StructuredOutput] Request: provider=${provider}, schema=${schemaName}`);

      // 🎯 Ollama는 Structured Output 미지원
      if (provider === "ollama") {
        logger.warn("[LLM-StructuredOutput] Ollama does not support Structured Output");
        return {
          success: false,
          error: {
            type: "INTERNAL",
            message: "Ollama does not support Structured Output.",
          },
        };
      }

      try {
        // 🎯 모델 생성
        const model = modelFactory.createModel(provider, modelId, options);

        // 🎯 JSON Schema 파싱
        const jsonSchema = JSON.parse(schema);

        // 🎯 withStructuredOutput 지원 여부 확인
        if (!("withStructuredOutput" in model) || typeof model.withStructuredOutput !== "function") {
          return {
            success: false,
            error: {
              type: "INTERNAL",
              message: `${provider} does not support Structured Output.`,
            },
          };
        }

        // 🎯 Structured Output 모델 생성
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const structuredModel = (model as any).withStructuredOutput(jsonSchema, {
          name: schemaName,
        });

        // 🎯 메시지 역직렬화
        const langchainMessages = deserializeMessages(messages);

        // 🎯 LLM 호출
        logger.debug("[LLM-StructuredOutput] LLM 호출 시작...");
        const result = await structuredModel.invoke(langchainMessages);

        logger.info("[LLM-StructuredOutput] Response received");

        return {
          success: true,
          result,
          rawContent: JSON.stringify(result),
        };
      } catch (error) {
        logger.error("[LLM-StructuredOutput] Error:", error);

        return {
          success: false,
          error: classifyLLMError(error),
        };
      }
    };
  },
});

export { llmChatHandlerInjectable, llmStructuredOutputHandlerInjectable };
