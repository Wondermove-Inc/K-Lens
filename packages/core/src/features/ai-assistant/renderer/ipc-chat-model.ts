/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: IPC 기반 LLM Chat Model (Renderer용 프록시)
 *
 * Renderer Process에서 LangChain 호환 모델로 동작하면서
 * 실제 LLM 호출은 Main Process에서 실행합니다.
 *
 * 📝 주의사항:
 * - API 키는 Main Process에서만 복호화 (Renderer 노출 방지)
 * - LangChain의 SimpleChatModel을 상속하여 호환성 유지
 * - withStructuredOutput 오버라이드하여 IPC 기반 Structured Output 지원
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Extension Host 패턴 마이그레이션)
 * - 2025-12-16: withStructuredOutput 메서드 추가 (bindTools 에러 해결)
 */

import { type BaseChatModelCallOptions, SimpleChatModel } from "@langchain/core/language_models/chat_models";
import { RunnableLambda } from "@langchain/core/runnables";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { BaseMessage, ToolMessage } from "@langchain/core/messages";

import type { AIProvider } from "../../../common/features/user-preferences/encrypt-api-key-channel";
import type { LLMChat, LLMStructuredOutput, SerializedMessage } from "../common/llm-chat-channel";

// ============================================
// 🎯 IPCChatModel 파라미터 타입
// ============================================

export interface IPCChatModelParams {
  /** AI Provider (openai, anthropic, google) */
  provider: AIProvider;
  /** 모델 ID */
  modelId: string;
  /** LLM Chat IPC 함수 */
  llmChat: LLMChat;
  /** Structured Output IPC 함수 */
  llmStructuredOutput: LLMStructuredOutput;
  /** Temperature (0-2, 기본: 0) */
  temperature?: number;
  /** 최대 토큰 수 */
  maxTokens?: number;
}

// ============================================
// 🎯 메시지 직렬화 유틸리티
// ============================================

/**
 * 🎯 LangChain BaseMessage를 IPC 전송용 형태로 변환
 *
 * @param message - LangChain 메시지
 * @returns 직렬화된 메시지
 */
function serializeMessage(message: BaseMessage): SerializedMessage {
  const msgType = message._getType();
  const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);

  switch (msgType) {
    case "system":
      return { role: "system", content };
    case "human":
      return { role: "user", content };
    case "ai":
      return { role: "assistant", content };
    case "tool": {
      const toolMsg = message as ToolMessage;
      return {
        role: "tool",
        content,
        name: toolMsg.name,
        tool_call_id: toolMsg.tool_call_id,
      };
    }
    default:
      // 기본값: user
      return { role: "user", content };
  }
}

/**
 * 🎯 메시지 배열 직렬화
 */
function serializeMessages(messages: BaseMessage[]): SerializedMessage[] {
  return messages.map(serializeMessage);
}

// ============================================
// 🎯 IPC Chat Model 클래스
// ============================================

/**
 * 🎯 IPC 기반 Chat Model (Renderer용)
 *
 * LangChain의 SimpleChatModel을 상속하여 LangGraph와 호환됩니다.
 * 실제 LLM 호출은 Main Process에서 실행되어 API 키가 Renderer에 노출되지 않습니다.
 *
 * @example
 * ```typescript
 * const model = new IPCChatModel({
 *   provider: "openai",
 *   modelId: "gpt-4o",
 *   llmChat,
 *   llmStructuredOutput,
 * });
 *
 * // 일반 호출
 * const result = await model.invoke([new HumanMessage("Hello")]);
 *
 * // Structured Output (LangChain 표준 메서드)
 * const structured = model.withStructuredOutput(schema);
 * const result = await structured.invoke(messages);
 * ```
 */
export class IPCChatModel extends SimpleChatModel<BaseChatModelCallOptions> {
  private provider: AIProvider;
  private modelId: string;
  private llmChat: LLMChat;
  private llmStructuredOutput: LLMStructuredOutput;
  private chatTemperature?: number;
  private chatMaxTokens?: number;

  constructor(params: IPCChatModelParams) {
    super({});
    this.provider = params.provider;
    this.modelId = params.modelId;
    this.llmChat = params.llmChat;
    this.llmStructuredOutput = params.llmStructuredOutput;
    this.chatTemperature = params.temperature;
    this.chatMaxTokens = params.maxTokens;
  }

  /**
   * 🎯 LLM 타입 식별자
   */
  _llmType(): string {
    return `ipc-${this.provider}`;
  }

  /**
   * 🎯 모델 ID 반환 (조건부 프롬프트에 사용)
   */
  getModelId(): string {
    return this.modelId;
  }

  /**
   * 🎯 LangChain 호출 구현
   *
   * IPC를 통해 Main Process에서 LLM을 실행합니다.
   * API 키는 Main에서만 복호화됩니다.
   *
   * @param messages - LangChain 메시지 배열
   * @returns LLM 응답 텍스트
   * @throws LLM 호출 실패 시 에러
   */
  async _call(messages: BaseMessage[]): Promise<string> {
    // 🎯 메시지 직렬화
    const serializedMessages = serializeMessages(messages);

    // 🎯 IPC를 통해 Main Process에서 LLM 호출
    const response = await this.llmChat({
      provider: this.provider,
      modelId: this.modelId,
      messages: serializedMessages,
      options: {
        temperature: this.chatTemperature,
        maxTokens: this.chatMaxTokens,
      },
    });

    // 🎯 응답 처리
    if (response.success && response.content) {
      return response.content;
    }

    // 🎯 에러 처리
    const errorType = response.error?.type ?? "INTERNAL";
    const errorMessage = response.error?.message ?? "LLM 호출에 실패했습니다.";

    throw new Error(`[${errorType}] ${errorMessage}`);
  }

  /**
   * 🎯 Structured Output 지원 (LangChain 표준 메서드 오버라이드)
   *
   * SimpleChatModel의 withStructuredOutput은 bindTools를 필요로 하지만,
   * IPCChatModel은 Main Process에서 Structured Output을 처리하므로
   * 직접 IPC 채널을 사용합니다.
   *
   * @param schema - Zod 스키마 또는 JSON Schema
   * @param config - 설정 옵션 (name, includeRaw 등)
   * @returns Structured Output Runnable
   *
   * @example
   * ```typescript
   * const structured = model.withStructuredOutput(myZodSchema);
   * const result = await structured.invoke(messages);
   * ```
   */
  withStructuredOutput<T>(
    schema: unknown,
    config?: { name?: string; includeRaw?: boolean },
  ): RunnableLambda<unknown, T> {
    // 🎯 Zod 스키마를 JSON Schema로 변환
    const jsonSchema = this.convertToJsonSchema(schema);
    const schemaName = config?.name ?? "structured_output";

    // 🎯 RunnableLambda로 래핑하여 LangChain 파이프라인과 호환
    // 입력은 BaseMessage[] 또는 ChatPromptValue (prompt.pipe() 결과) 둘 다 가능
    return new RunnableLambda({
      func: async (input: unknown): Promise<T> => {
        // 🎯 입력 타입에 따라 메시지 추출
        const messages = this.extractMessages(input);
        const serializedMessages = serializeMessages(messages);

        const response = await this.llmStructuredOutput({
          provider: this.provider,
          modelId: this.modelId,
          messages: serializedMessages,
          schema: JSON.stringify(jsonSchema),
          schemaName,
          options: {
            temperature: this.chatTemperature,
            maxTokens: this.chatMaxTokens,
          },
        });

        if (response.success && response.result !== undefined) {
          return response.result as T;
        }

        const errorType = response.error?.type ?? "INTERNAL";
        const errorMessage = response.error?.message ?? "Structured Output 호출에 실패했습니다.";

        throw new Error(`[${errorType}] ${errorMessage}`);
      },
    });
  }

  /**
   * 🎯 다양한 입력 타입에서 BaseMessage[] 추출
   *
   * LangChain 파이프라인에서는 다양한 형태로 메시지가 전달됩니다:
   * - BaseMessage[] (직접 호출)
   * - ChatPromptValue (prompt.pipe() 결과)
   * - { messages: BaseMessage[] } (일부 체인 결과)
   */
  private extractMessages(input: unknown): BaseMessage[] {
    // 🎯 이미 BaseMessage[] 인 경우
    if (Array.isArray(input)) {
      return input as BaseMessage[];
    }

    // 🎯 ChatPromptValue 또는 유사 객체인 경우 (toChatMessages 메서드 사용)
    if (input && typeof input === "object") {
      const obj = input as Record<string, unknown>;

      // ChatPromptValue.toChatMessages()
      if (typeof obj.toChatMessages === "function") {
        return (obj as any).toChatMessages();
      }

      // { messages: BaseMessage[] } 형태
      if (Array.isArray(obj.messages)) {
        return obj.messages as BaseMessage[];
      }

      // BaseMessagePromptTemplateLike의 결과
      if (typeof obj.toMessages === "function") {
        return (obj as any).toMessages();
      }
    }

    // 🎯 단일 메시지인 경우
    if (input && typeof input === "object" && "_getType" in input) {
      return [input as BaseMessage];
    }

    console.error("[IPCChatModel] 알 수 없는 입력 타입:", input);
    throw new Error("withStructuredOutput: 지원하지 않는 입력 형식입니다.");
  }

  /**
   * 🎯 스키마를 JSON Schema로 변환
   *
   * @param schema - Zod 스키마 또는 이미 JSON Schema인 객체
   * @returns JSON Schema 객체
   */
  private convertToJsonSchema(schema: unknown): unknown {
    // 🎯 Zod 스키마 감지: _def 속성이 있으면 Zod 스키마
    if (schema && typeof schema === "object" && "_def" in schema) {
      return zodToJsonSchema(schema as any);
    }

    // 🎯 이미 JSON Schema인 경우 그대로 반환
    return schema;
  }

  /**
   * 🎯 Structured Output 모델 생성 (대체 메서드)
   *
   * withStructuredOutput의 대안으로, 명시적인 타입 지정이 필요한 경우 사용합니다.
   *
   * @param schema - JSON Schema 객체 (zodToJsonSchema 결과)
   * @param schemaName - 스키마 이름 (기본: "structured_output")
   * @returns Structured Output이 가능한 모델
   */
  getStructuredModel<T>(schema: unknown, schemaName = "structured_output"): IPCStructuredOutputModel<T> {
    return new IPCStructuredOutputModel<T>({
      provider: this.provider,
      modelId: this.modelId,
      schema: JSON.stringify(schema),
      schemaName,
      llmStructuredOutput: this.llmStructuredOutput,
      temperature: this.chatTemperature,
      maxTokens: this.chatMaxTokens,
    });
  }
}

// ============================================
// 🎯 Structured Output 전용 모델
// ============================================

interface IPCStructuredOutputParams<T> {
  provider: AIProvider;
  modelId: string;
  schema: string;
  schemaName: string;
  llmStructuredOutput: LLMStructuredOutput;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 🎯 IPC Structured Output Model
 *
 * getStructuredModel()으로 생성된 모델입니다.
 * invoke() 시 JSON 스키마에 맞는 구조화된 응답을 반환합니다.
 */
export class IPCStructuredOutputModel<T> {
  private provider: AIProvider;
  private modelId: string;
  private schema: string;
  private schemaName: string;
  private llmStructuredOutput: LLMStructuredOutput;
  private temperature?: number;
  private maxTokens?: number;

  constructor(params: IPCStructuredOutputParams<T>) {
    this.provider = params.provider;
    this.modelId = params.modelId;
    this.schema = params.schema;
    this.schemaName = params.schemaName;
    this.llmStructuredOutput = params.llmStructuredOutput;
    this.temperature = params.temperature;
    this.maxTokens = params.maxTokens;
  }

  /**
   * 🎯 Structured Output 호출
   *
   * @param messages - LangChain 메시지 배열
   * @returns 구조화된 JSON 응답
   */
  async invoke(messages: BaseMessage[]): Promise<T> {
    const serializedMessages = serializeMessages(messages);

    const response = await this.llmStructuredOutput({
      provider: this.provider,
      modelId: this.modelId,
      messages: serializedMessages,
      schema: this.schema,
      schemaName: this.schemaName,
      options: {
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      },
    });

    if (response.success && response.result !== undefined) {
      return response.result as T;
    }

    const errorType = response.error?.type ?? "INTERNAL";
    const errorMessage = response.error?.message ?? "Structured Output 호출에 실패했습니다.";

    throw new Error(`[${errorType}] ${errorMessage}`);
  }
}
