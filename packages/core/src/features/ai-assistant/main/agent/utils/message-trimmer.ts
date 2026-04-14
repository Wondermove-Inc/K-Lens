/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: LLM 컨텍스트 윈도우 관리를 위한 메시지 트리밍 유틸리티
 *
 * 📝 주의사항:
 * - 토큰 초과 오류 방지를 위해 메시지 히스토리를 제한
 * - Provider별로 다른 토큰 한도 적용 (Claude: 200K, GPT: 128K 등)
 * - SystemMessage는 항상 보존, 최신 메시지 우선 유지
 *
 * 🔄 변경이력:
 * - 2026-01-09: 초기 생성 (토큰 초과 오류 해결)
 */

import { AIMessage, BaseMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

import type { AIProvider } from "../../../../../common/features/user-preferences/encrypt-api-key-channel";

// ============================================
// 역직렬화 호환 타입 체크 헬퍼
// ============================================

function isAIMessageType(msg: any): msg is AIMessage {
  if (msg instanceof AIMessage) return true;
  if (typeof msg?._getType === "function" && msg._getType() === "ai") return true;
  if (msg?.type === "ai") return true;
  if (msg?.lc_id?.includes("AIMessage")) return true;
  return false;
}

function isToolMessageType(msg: any): msg is ToolMessage {
  if (msg instanceof ToolMessage) return true;
  if (typeof msg?._getType === "function" && msg._getType() === "tool") return true;
  if (msg?.type === "tool") return true;
  if (msg?.lc_id?.includes("ToolMessage")) return true;
  if (msg?.tool_call_id !== undefined) return true;
  return false;
}

// ============================================
// 🎯 Provider별 토큰 한도 설정
// ============================================

/**
 * 🎯 Provider별 최대 토큰 한도
 *
 * 📝 주의사항:
 * - 실제 한도의 85%를 사용하여 안전 마진 확보
 * - 응답 생성을 위한 공간 확보 필요
 */
export const PROVIDER_TOKEN_LIMITS: Record<AIProvider, number> = {
  anthropic: 170000, // Claude: 200K * 0.85
  openai: 108000, // GPT-4: 128K * 0.85
  google: 85000, // Gemini: 1M이지만 비용 고려하여 100K * 0.85
  ollama: 34000, // 로컬 모델: 40K * 0.85 (모델별 상이)
  openrouter: 108000, // 모델별 상이하나 기본 128K * 0.85로 설정
};

/**
 * 🎯 모델별 세부 토큰 한도 (선택적 오버라이드)
 */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  // OpenAI (최신 지원 모델)
  "gpt-5.4": 108000,
  "gpt-5.2": 108000,
  "gpt-5-mini": 108000,
  "gpt-4o-mini": 108000,

  // Anthropic (최신 지원 모델)
  "claude-opus-4-6": 170000,
  "claude-sonnet-4-6": 170000,
  "claude-opus-4-5-20251101": 170000,
  "claude-sonnet-4-5-20250929": 170000,
  "claude-haiku-4-5-20251001": 170000,
};

// ============================================
// 🎯 토큰 추정 함수
// ============================================

/**
 * 🎯 메시지의 토큰 수 추정
 *
 * 📝 주의사항:
 * - 정확한 토큰 카운팅을 위해서는 tiktoken 등 사용 필요
 * - 여기서는 간단한 추정 사용 (영어: 4자당 1토큰, 한국어: 2자당 1토큰)
 * - 안전 마진을 위해 약간 높게 추정
 *
 * @param message - 토큰 수를 추정할 메시지
 * @returns 추정 토큰 수
 */
export function estimateTokenCount(message: BaseMessage): number {
  const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content);

  // 한글/CJK 문자 비율 확인
  const cjkPattern = /[\u3131-\u3163\uAC00-\uD7A3\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g;
  const cjkMatches = content.match(cjkPattern) || [];
  const cjkRatio = cjkMatches.length / Math.max(content.length, 1);

  // CJK 비율에 따라 토큰 추정 조정
  // - 영어: 약 4자당 1토큰
  // - 한국어: 약 1.5자당 1토큰 (더 많은 토큰 사용)
  const avgCharsPerToken = cjkRatio > 0.3 ? 1.5 : 3.5;

  // 메시지 메타데이터 오버헤드 (role, name 등)
  const metadataOverhead = 10;

  // Tool call 오버헤드
  let toolCallOverhead = 0;
  if ("tool_calls" in message && Array.isArray((message as any).tool_calls)) {
    toolCallOverhead = JSON.stringify((message as any).tool_calls).length / 3;
  }

  return Math.ceil(content.length / avgCharsPerToken) + metadataOverhead + toolCallOverhead;
}

/**
 * 🎯 메시지 배열의 총 토큰 수 추정
 *
 * @param messages - 메시지 배열
 * @returns 총 추정 토큰 수
 */
export function estimateTotalTokens(messages: BaseMessage[]): number {
  return messages.reduce((total, msg) => total + estimateTokenCount(msg), 0);
}

// ============================================
// 🎯 헬퍼 함수
// ============================================

/**
 * 🎯 첫 번째 HumanMessage 찾기
 *
 * 📝 주의사항:
 * - Plan 모드에서 초기 사용자 요청을 보존하기 위해 사용
 * - _getType() 사용으로 역직렬화 호환성 확보
 *
 * @param messages - 메시지 배열
 * @returns 첫 번째 HumanMessage 또는 null
 */
function findFirstHumanMessage(messages: BaseMessage[]): BaseMessage | null {
  for (const msg of messages) {
    if (msg._getType() === "human") {
      return msg;
    }
  }
  return null;
}

/**
 * 🎯 메시지 분류 - SystemMessage / 보존 메시지 / 일반 메시지
 *
 * 📝 주의사항:
 * - SystemMessage: 항상 보존
 * - initialHumanMessage: Plan 모드에서 초기 요청 보존
 * - 나머지: trimming 대상
 *
 * @param messages - 원본 메시지 배열
 * @param options - 분류 옵션
 * @returns 분류된 메시지
 */
function classifyMessages(
  messages: BaseMessage[],
  options: {
    preserveSystemMessages: boolean;
    initialHumanMessage: BaseMessage | null;
  },
): ClassifiedMessages {
  const systemMessages: SystemMessage[] = [];
  const preservedMessages: BaseMessage[] = [];
  const nonSystemMessages: BaseMessage[] = [];

  for (const msg of messages) {
    if (options.preserveSystemMessages && msg instanceof SystemMessage) {
      systemMessages.push(msg);
    } else if (options.initialHumanMessage && msg === options.initialHumanMessage) {
      // 초기 HumanMessage는 별도 보존 (Plan 모드)
      preservedMessages.push(msg);
    } else {
      nonSystemMessages.push(msg);
    }
  }

  return { systemMessages, preservedMessages, nonSystemMessages };
}

// ============================================
// 🎯 메시지 트리밍 함수
// ============================================

/**
 * 🎯 메시지 트리밍 옵션
 */
export interface TrimMessagesOptions {
  /** AI Provider */
  provider: AIProvider;
  /** 모델 ID (선택적, 더 정확한 한도 적용) */
  modelId?: string;
  /** 최대 토큰 수 (명시적 오버라이드) */
  maxTokens?: number;
  /** 항상 보존할 최근 메시지 수 (기본: 4) */
  preserveRecentCount?: number;
  /** SystemMessage 항상 보존 여부 (기본: true) */
  preserveSystemMessages?: boolean;
  /** Plan 모드 여부 (초기 HumanMessage 보존) - */
  isPlanMode?: boolean;
  /** 초기 사용자 요청 보존 여부 (기본: false) - */
  preserveInitialRequest?: boolean;
}

/**
 * 🎯 메시지 트리밍 결과
 */
export interface TrimMessagesResult {
  /** 트리밍된 메시지 배열 */
  messages: BaseMessage[];
  /** 원본 메시지 수 */
  originalCount: number;
  /** 트리밍 후 메시지 수 */
  trimmedCount: number;
  /** 제거된 메시지 수 */
  removedCount: number;
  /** 추정 토큰 수 */
  estimatedTokens: number;
  /** 토큰 한도 */
  tokenLimit: number;
  /** 트리밍 발생 여부 */
  wasTrimmed: boolean;
}

/**
 * 🎯 메시지 분류 결과
 */
interface ClassifiedMessages {
  /** SystemMessage 목록 */
  systemMessages: SystemMessage[];
  /** 항상 보존할 메시지 (Plan 모드 초기 요청 등) */
  preservedMessages: BaseMessage[];
  /** 일반 메시지 (trimming 대상) */
  nonSystemMessages: BaseMessage[];
}

/**
 * 🎯 메시지 트리밍 - 토큰 한도 내로 메시지 제한
 *
 * 📝 알고리즘:
 * 1. SystemMessage 분리 (항상 보존)
 * 2. Plan 모드: 초기 HumanMessage 보존
 * 3. 최근 N개 메시지 보존 (preserveRecentCount)
 * 4. 토큰 한도 초과 시 오래된 메시지부터 제거
 * 5. Tool call/result 쌍 유지 (일관성)
 *
 * @param messages - 원본 메시지 배열
 * @param options - 트리밍 옵션
 * @returns 트리밍 결과
 */
export function trimMessages(messages: BaseMessage[], options: TrimMessagesOptions): TrimMessagesResult {
  const {
    provider,
    modelId,
    maxTokens,
    preserveRecentCount = 4,
    preserveSystemMessages = true,
    isPlanMode = false,
    preserveInitialRequest = false,
  } = options;

  // 🎯 토큰 한도 결정
  let tokenLimit = maxTokens;
  if (!tokenLimit) {
    tokenLimit = modelId && MODEL_TOKEN_LIMITS[modelId] ? MODEL_TOKEN_LIMITS[modelId] : PROVIDER_TOKEN_LIMITS[provider];
  }

  const originalCount = messages.length;

  // 🎯 메시지가 없거나 매우 적으면 그대로 반환
  if (messages.length <= preserveRecentCount) {
    return {
      messages,
      originalCount,
      trimmedCount: messages.length,
      removedCount: 0,
      estimatedTokens: estimateTotalTokens(messages),
      tokenLimit,
      wasTrimmed: false,
    };
  }

  // 🎯 Plan 모드에서 초기 HumanMessage 찾기
  const shouldPreserveInitial = isPlanMode || preserveInitialRequest;
  const initialHumanMessage = shouldPreserveInitial ? findFirstHumanMessage(messages) : null;

  // 🎯 메시지 분류: SystemMessage / 보존 메시지 / 일반 메시지
  const { systemMessages, preservedMessages, nonSystemMessages } = classifyMessages(messages, {
    preserveSystemMessages,
    initialHumanMessage,
  });

  // 🎯 SystemMessage + 보존 메시지 토큰 계산
  const systemTokens = estimateTotalTokens(systemMessages);
  const preservedTokens = estimateTotalTokens(preservedMessages);
  const remainingTokenLimit = tokenLimit - systemTokens - preservedTokens;

  // 🎯 최근 메시지부터 토큰 한도까지 포함
  const trimmedNonSystem: BaseMessage[] = [];
  let currentTokens = 0;

  // 하드 리밋: preserveRecentCount 미달이더라도 토큰 한도의 95%를 넘으면 중단
  // 이는 개별 메시지가 매우 큰 경우 (예: read_file 결과) API 400 에러를 방지
  const hardTokenLimit = Math.floor(remainingTokenLimit * 0.95);
  // 최소 보장 메시지 수: 토큰이 넘더라도 최소 2개는 유지 (마지막 user + assistant)
  const minGuaranteedMessages = 2;

  // 역순으로 순회 (최신 메시지 우선)
  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const msg = nonSystemMessages[i];
    const msgTokens = estimateTokenCount(msg);

    // 토큰 한도 체크
    if (currentTokens + msgTokens > remainingTokenLimit) {
      // 최소 보존 개수에 도달했으면 중단
      if (trimmedNonSystem.length >= preserveRecentCount) {
        break;
      }
      // 하드 리밋: 최소 보장 수를 넘겼으면 토큰 초과 시 강제 중단
      if (trimmedNonSystem.length >= minGuaranteedMessages && currentTokens + msgTokens > hardTokenLimit) {
        break;
      }
    }

    trimmedNonSystem.unshift(msg);
    currentTokens += msgTokens;
  }

  // 🎯 Tool 메시지 쌍 유지 (ToolMessage는 반드시 해당 AIMessage 뒤에 와야 함)
  const finalMessages = ensureToolMessagePairs(trimmedNonSystem);

  // 🎯 SystemMessage + 보존 메시지 + 트리밍된 메시지 결합
  // 순서: SystemMessage → 초기 HumanMessage → 나머지 메시지
  const result = [...systemMessages, ...preservedMessages, ...finalMessages];
  const estimatedTokens = estimateTotalTokens(result);

  return {
    messages: result,
    originalCount,
    trimmedCount: result.length,
    removedCount: originalCount - result.length,
    estimatedTokens,
    tokenLimit,
    wasTrimmed: originalCount !== result.length,
  };
}

/**
 * 🎯 AIMessage에서 tool_calls 추출 (수정)
 *
 * 📝 주의사항:
 * - LangChain에서 직렬화/역직렬화 시 tool_calls가 여러 위치에 저장될 수 있음
 * - msg.tool_calls (기본 속성)
 * - msg.additional_kwargs.tool_calls (OpenAI 응답 원본)
 * - checkpointer에서 복원 시 위치가 달라질 수 있음
 *
 * @param msg - AIMessage
 * @returns tool_calls 배열 (없으면 빈 배열)
 *
 * 🔄 변경이력:
 * - 2026-01-09: - additional_kwargs.tool_calls도 확인하도록 추가
 */
function getToolCallsFromMessage(msg: AIMessage): Array<{ id?: string; name: string; args: any }> {
  // 1. 기본 tool_calls 속성 확인
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    return msg.tool_calls;
  }

  // 2. additional_kwargs.tool_calls 확인 (OpenAI 응답 원본)
  const additionalKwargs = (msg as any).additional_kwargs;
  if (
    additionalKwargs?.tool_calls &&
    Array.isArray(additionalKwargs.tool_calls) &&
    additionalKwargs.tool_calls.length > 0
  ) {
    return additionalKwargs.tool_calls;
  }

  return [];
}

/**
 * 🎯 Tool 메시지 쌍 유지 (, 수정)
 *
 * 📝 주의사항:
 * - AIMessage(tool_calls) 다음에는 반드시 해당 tool_call_id에 대한 ToolMessage가 와야 함
 * - 쌍이 깨지면 API 오류 발생: "tool_use ids were found without tool_result blocks"
 * - 트리밍 후에도 모든 tool_call_id에 대해 ToolMessage가 있어야 함
 *
 * 📝 알고리즘 (3-pass):
 * 1. 첫 번째 패스: 전체 메시지에서 유효한 AIMessage-ToolMessage 쌍 식별
 * 2. 두 번째 패스: 유효한 쌍만 포함하여 결과 생성
 * 3. 🎯 불완전한 쌍의 AIMessage는 제거하지 않고 tool_calls만 제거하여 복구
 *
 * 📝 해결 (2026-01-09):
 * - 기존: 불완전한 쌍의 AIMessage를 제거 → 대화 기록 손실
 * - 변경: tool_calls만 제거하고 content는 유지 → 대화 흐름 보존 + API 오류 방지
 *
 * @param messages - 메시지 배열
 * @returns Tool 쌍이 유지된 메시지 배열
 *
 * 🔄 변경이력:
 * - 2026-01-09: 수정 - 2-pass 알고리즘으로 완전한 쌍 보장
 * - 2026-01-09: 수정 - additional_kwargs.tool_calls도 확인
 * - 2026-01-09: 수정 - 불완전한 쌍 복구 (대화 기록 유지)
 */
function ensureToolMessagePairs(messages: BaseMessage[]): BaseMessage[] {
  // 🎯 Pass 1: 전체 메시지에서 tool_call_id → ToolMessage 인덱스 매핑 생성
  const toolMessageByCallId = new Map<string, number>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    // 🎯 instanceof 대신 헬퍼 함수 사용 (역직렬화 호환)
    if (isToolMessageType(msg)) {
      const toolCallId = (msg as any).tool_call_id;
      if (toolCallId) {
        toolMessageByCallId.set(toolCallId, i);
      }
    }
  }

  // 🎯 Pass 2: 유효한 AIMessage(tool_calls) 식별 (모든 tool_call_id에 대한 ToolMessage가 있는 경우만)
  const validAIMessageIndices = new Set<number>();
  const validToolMessageIndices = new Set<number>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // 🎯 getToolCallsFromMessage 사용하여 tool_calls 추출
    // 🎯 instanceof 대신 헬퍼 함수 사용 (역직렬화 호환)
    if (isAIMessageType(msg)) {
      const toolCalls = getToolCallsFromMessage(msg as AIMessage);

      if (toolCalls.length > 0) {
        const toolCallIds = toolCalls.map((tc) => tc.id).filter(Boolean) as string[];

        // 모든 tool_call_id에 대해 ToolMessage가 존재하는지 확인
        const allToolMessagesExist = toolCallIds.length > 0 && toolCallIds.every((id) => toolMessageByCallId.has(id));

        if (allToolMessagesExist) {
          // 이 AIMessage와 연결된 모든 ToolMessage를 유효 목록에 추가
          validAIMessageIndices.add(i);
          toolCallIds.forEach((id) => {
            const toolMsgIndex = toolMessageByCallId.get(id);
            if (toolMsgIndex !== undefined) {
              validToolMessageIndices.add(toolMsgIndex);
            }
          });
        }
        // 📝 allToolMessagesExist가 false면 이 AIMessage는 복구 대상
      }
    }
  }

  // 🎯 Pass 3: 결과 생성 - 일반 메시지 + 유효한 AIMessage + 유효한 ToolMessage
  // 🎯 불완전한 AIMessage는 tool_calls 제거 후 복구
  const result: BaseMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // 🎯, AIMessage with tool_calls 처리
    // 🎯 instanceof 대신 헬퍼 함수 사용 (역직렬화 호환)
    if (isAIMessageType(msg)) {
      const toolCalls = getToolCallsFromMessage(msg as AIMessage);

      if (toolCalls.length > 0) {
        if (validAIMessageIndices.has(i)) {
          // ✅ 완전한 쌍: 그대로 포함
          result.push(msg);
        } else {
          // 🎯 불완전한 쌍 - tool_calls 제거하고 content만 유지하여 복구
          // 대화 기록을 유지하면서 API 오류를 방지
          //
          // 📝 중요: 이것은 "앞으로 Tool을 호출해야 할 메시지"가 아님
          // "과거에 Tool을 호출하려고 했지만 실패/중단된 메시지"임
          // - HITL에서 사용자가 거부했거나
          // - Tool 실행 중 에러가 발생했거나
          // - 세션이 종료되었거나
          // 따라서 tool_calls를 유지할 필요가 없음
          // AI는 다음 대화에서 필요하면 새로 Tool을 호출함
          const content = extractTextContent(msg.content);

          if (content.trim()) {
            // content가 있으면 tool_calls 없는 새 AIMessage 생성
            // 📝 새 메시지 생성 시 tool_calls와 additional_kwargs.tool_calls는 포함하지 않음
            const recoveredMessage = new AIMessage({
              content: content,
              name: msg.name,
              // tool_calls, additional_kwargs는 의도적으로 제외
            });
            result.push(recoveredMessage);
          } else {
            // 🎯 content가 없는 경우 - Tool 호출 의도를 텍스트로 변환하여 컨텍스트 유지
            // 이를 통해 AI가 이전에 무엇을 하려고 했는지 알 수 있음
            const toolNames = toolCalls.map((tc) => tc.name).join(", ");
            const placeholderMessage = new AIMessage({
              content: `[이전 세션에서 ${toolNames} 도구 실행이 완료되지 않았습니다]`,
            });
            result.push(placeholderMessage);
          }
        }
        continue;
      }
    }

    // ToolMessage: 유효한 것만 포함
    // 🎯 instanceof 대신 헬퍼 함수 사용 (역직렬화 호환)
    if (isToolMessageType(msg)) {
      if (validToolMessageIndices.has(i)) {
        result.push(msg);
      }
      continue;
    }

    // 일반 메시지 (HumanMessage, SystemMessage, tool_calls 없는 AIMessage 등)는 항상 포함
    result.push(msg);
  }

  return result;
}

/**
 * 🎯 메시지 content에서 텍스트 추출 (헬퍼)
 *
 * 📝 주의사항:
 * - content가 string인 경우 (OpenAI): 그대로 반환
 * - content가 배열인 경우 (Claude): type='text' 블록만 추출
 * - content가 undefined/null인 경우: 빈 문자열 반환
 *
 * @param content - 메시지 content (string | array | unknown)
 * @returns 추출된 텍스트
 *
 * 🔄 변경이력:
 * - 2026-01-09: - 불완전한 AIMessage 복구용 헬퍼 함수 추가
 */
function extractTextContent(content: unknown): string {
  // 1️⃣ string인 경우 (OpenAI 등) - 그대로 반환
  if (typeof content === "string") {
    return content;
  }

  // 2️⃣ 배열인 경우 (Claude/Anthropic) - type: 'text' 블록만 추출
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block?.type === "text" && typeof block?.text === "string")
      .map((block: any) => block.text)
      .join("");
  }

  // 3️⃣ 그 외 (undefined, null, object 등) - 빈 문자열
  return "";
}

// ============================================
// 🎯 편의 함수
// ============================================

/**
 * 🎯 토큰 한도 초과 여부 확인
 *
 * @param messages - 메시지 배열
 * @param provider - AI Provider
 * @param modelId - 모델 ID (선택)
 * @returns 토큰 한도 초과 여부
 */
export function isTokenLimitExceeded(messages: BaseMessage[], provider: AIProvider, modelId?: string): boolean {
  const tokenLimit =
    modelId && MODEL_TOKEN_LIMITS[modelId] ? MODEL_TOKEN_LIMITS[modelId] : PROVIDER_TOKEN_LIMITS[provider];

  const estimatedTokens = estimateTotalTokens(messages);
  return estimatedTokens > tokenLimit;
}

/**
 * 🎯 토큰 사용률 계산 (%)
 *
 * @param messages - 메시지 배열
 * @param provider - AI Provider
 * @param modelId - 모델 ID (선택)
 * @returns 토큰 사용률 (0-100+)
 */
export function getTokenUsagePercent(messages: BaseMessage[], provider: AIProvider, modelId?: string): number {
  const tokenLimit =
    modelId && MODEL_TOKEN_LIMITS[modelId] ? MODEL_TOKEN_LIMITS[modelId] : PROVIDER_TOKEN_LIMITS[provider];

  const estimatedTokens = estimateTotalTokens(messages);
  return Math.round((estimatedTokens / tokenLimit) * 100);
}
