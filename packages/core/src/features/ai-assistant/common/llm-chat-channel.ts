/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Assistant의 LLM Chat을 위한 IPC 채널 정의
 *
 * Renderer Process에서 Main Process로 LLM 호출을 요청합니다.
 * API 키는 Main Process에서만 복호화되어 보안을 강화합니다.
 *
 * 📝 주의사항:
 * - API 키는 Main Process에서만 접근 (Renderer 노출 방지)
 * - @skuberplus/messaging 프레임워크 사용
 * - LangChain BaseMessage를 직렬화하여 IPC 전송
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Extension Host 패턴 마이그레이션)
 */

import { getInjectionToken } from "@ogre-tools/injectable";
import { getRequestChannel } from "@skuberplus/messaging";

import type { AIProvider } from "../../../common/features/user-preferences/encrypt-api-key-channel";

// ============================================
// 🎯 직렬화된 메시지 타입 (IPC 전송용)
// ============================================

/**
 * 🎯 직렬화된 메시지 형식
 *
 * LangChain BaseMessage를 IPC 전송 가능한 형태로 변환
 */
export interface SerializedMessage {
  /** 메시지 역할 */
  role: "system" | "user" | "assistant" | "tool";
  /** 메시지 내용 */
  content: string;
  /** 도구 호출 이름 (tool 메시지용) */
  name?: string;
  /** 도구 호출 ID (tool 메시지용) */
  tool_call_id?: string;
}

// ============================================
// 🎯 LLM Chat 요청/응답 타입
// ============================================

/**
 * 🎯 LLM Chat 요청 인자
 */
export interface LLMChatRequest {
  /** AI Provider (openai, anthropic, google, ollama) */
  provider: AIProvider;
  /** 모델 ID (gpt-5.2, claude-sonnet-4-5-20250929 등) */
  modelId: string;
  /** 직렬화된 메시지 배열 */
  messages: SerializedMessage[];
  /** 옵션 */
  options?: {
    /** Temperature (0-2, 기본: 0) */
    temperature?: number;
    /** 최대 토큰 수 */
    maxTokens?: number;
  };
}

/**
 * 🎯 LLM Chat 에러 타입
 */
export interface LLMChatError {
  /** 에러 타입 */
  type: "AUTH_FAILED" | "RATE_LIMIT" | "NETWORK" | "INVALID_MODEL" | "API_KEY_NOT_SET" | "INTERNAL";
  /** 사용자 친화적 에러 메시지 */
  message: string;
  /** 상세 에러 정보 (디버깅용) */
  details?: string;
}

/**
 * 🎯 LLM Chat 응답
 */
export interface LLMChatResponse {
  /** 성공 여부 */
  success: boolean;
  /** LLM 응답 내용 (성공 시) */
  content?: string;
  /** 에러 정보 (실패 시) */
  error?: LLMChatError;
}

// ============================================
// 🎯 Structured Output 요청/응답 타입
// ============================================

/**
 * 🎯 Structured Output 요청 인자
 *
 * LLM에게 특정 JSON 스키마로 응답하도록 요청
 */
export interface LLMStructuredOutputRequest extends LLMChatRequest {
  /** JSON Schema (zodToJsonSchema 결과) */
  schema: string;
  /** 스키마 이름 */
  schemaName: string;
}

/**
 * 🎯 Structured Output 응답
 */
export interface LLMStructuredOutputResponse {
  /** 성공 여부 */
  success: boolean;
  /** 파싱된 JSON 객체 (성공 시) */
  result?: unknown;
  /** 원본 LLM 응답 (디버깅용) */
  rawContent?: string;
  /** 에러 정보 (실패 시) */
  error?: LLMChatError;
}

// ============================================
// 🎯 IPC 채널 정의
// ============================================

/**
 * 🎯 LLM Chat IPC 채널
 *
 * Renderer → Main 요청 채널 (단순 텍스트 응답)
 */
export const llmChatChannel = getRequestChannel<LLMChatRequest, LLMChatResponse>("ai-assistant:llm-chat");

/**
 * 🎯 Structured Output IPC 채널
 *
 * Renderer → Main 요청 채널 (JSON 스키마 기반 응답)
 */
export const llmStructuredOutputChannel = getRequestChannel<LLMStructuredOutputRequest, LLMStructuredOutputResponse>(
  "ai-assistant:llm-structured-output",
);

// ============================================
// 🎯 DI 토큰 정의
// ============================================

/**
 * 🎯 LLM Chat 함수 타입
 */
export type LLMChat = (request: LLMChatRequest) => Promise<LLMChatResponse>;

/**
 * 🎯 LLM Structured Output 함수 타입
 */
export type LLMStructuredOutput = (request: LLMStructuredOutputRequest) => Promise<LLMStructuredOutputResponse>;

/**
 * 🎯 LLM Chat DI 토큰
 */
export const llmChatInjectionToken = getInjectionToken<LLMChat>({
  id: "ai-assistant-llm-chat",
});

/**
 * 🎯 LLM Structured Output DI 토큰
 */
export const llmStructuredOutputInjectionToken = getInjectionToken<LLMStructuredOutput>({
  id: "ai-assistant-llm-structured-output",
});

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 🎯 에러를 LLMChatError로 분류
 *
 * @param error - 원본 에러
 * @returns 분류된 LLMChatError
 */
export function classifyLLMError(error: unknown): LLMChatError {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // 인증 에러
  if (
    lowerMessage.includes("401") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("invalid api key") ||
    lowerMessage.includes("api 키가 설정되지 않았습니다") ||
    lowerMessage.includes("api 키가 유효하지 않습니다")
  ) {
    return {
      type: "AUTH_FAILED",
      message: "Invalid API key. Please check your API key in settings.",
      details: message,
    };
  }

  // Rate Limit 에러
  if (
    lowerMessage.includes("429") ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("too many requests")
  ) {
    return {
      type: "RATE_LIMIT",
      message: "Rate limit exceeded. Please try again later.",
      details: message,
    };
  }

  // 네트워크 에러
  if (
    lowerMessage.includes("enotfound") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("econnrefused")
  ) {
    return {
      type: "NETWORK",
      message: "Network connection error. Please check your connection.",
      details: message,
    };
  }

  // 모델 에러
  if (
    (lowerMessage.includes("model") && lowerMessage.includes("not found")) ||
    lowerMessage.includes("does not exist") ||
    lowerMessage.includes("지원하지 않는 provider")
  ) {
    return {
      type: "INVALID_MODEL",
      message: "Unsupported model. Please select a different model.",
      details: message,
    };
  }

  // 기본: 내부 에러
  return {
    type: "INTERNAL",
    message: "An error occurred while calling the LLM.",
    details: message,
  };
}
