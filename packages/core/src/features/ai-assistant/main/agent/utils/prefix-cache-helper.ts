/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Anthropic Prefix Caching Helper
 *
 * Anthropic의 서버측 prefix caching을 활용하여 반복되는 시스템 프롬프트의
 * 입력 토큰 비용을 최대 90% 절감합니다.
 *
 * - cache_control: { type: "ephemeral" } 마킹으로 캐시 breakpoint 설정
 * - 고정 프롬프트(static)와 동적 컨텍스트(dynamic)를 분리하여
 *   고정 부분만 캐시되도록 구성
 * - Anthropic 외 provider는 기존 문자열 방식 유지
 *
 * 변경이력:
 * - 2026-03-09: 초기 생성
 */

import { SystemMessage } from "@langchain/core/messages";

import type { AIProvider } from "../../../../../common/features/user-preferences/encrypt-api-key-channel";

/**
 * Anthropic prefix caching이 적용된 SystemMessage를 생성합니다.
 *
 * Anthropic provider일 때:
 * - staticPrompt에 cache_control breakpoint를 설정하여 서버측 캐싱 활성화
 * - dynamicContext는 캐시 breakpoint 이후에 배치 (캐시되지 않음)
 *
 * 다른 provider일 때:
 * - 기존과 동일하게 문자열 concatenation 방식 사용
 *
 * @param staticPrompt - 고정 시스템 프롬프트 (캐시 대상)
 * @param provider - AI provider 타입
 * @param dynamicContext - 동적 컨텍스트 (캐시 비대상, 선택적)
 * @returns SystemMessage 인스턴스
 */
export function createCachedSystemMessage(
  staticPrompt: string,
  provider: AIProvider,
  dynamicContext?: string,
): SystemMessage {
  if (provider === "anthropic") {
    const content: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> = [
      {
        type: "text",
        text: staticPrompt,
        cache_control: { type: "ephemeral" },
      },
    ];
    if (dynamicContext) {
      content.push({ type: "text", text: dynamicContext });
    }
    return new SystemMessage({ content });
  }

  // Anthropic 외 provider: 기존 문자열 방식
  const fullText = dynamicContext ? staticPrompt + dynamicContext : staticPrompt;
  return new SystemMessage(fullText);
}
