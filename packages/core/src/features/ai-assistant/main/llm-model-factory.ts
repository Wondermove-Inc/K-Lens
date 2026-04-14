/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Main Process에서 LLM 모델 인스턴스를 생성하는 팩토리
 *
 * API 키를 Main Process에서만 복호화하여 보안을 강화합니다.
 * Renderer Process에서는 API 키에 접근할 수 없습니다.
 *
 * 📝 주의사항:
 * - 이 파일은 Main Process에서만 실행됩니다
 * - API 키는 이 팩토리 내부에서만 사용되고 외부로 노출되지 않습니다
 * - LangChain 모델 인스턴스를 생성하여 invoke() 결과만 반환합니다
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Extension Host 패턴 마이그레이션)
 * - 2025-12-16: Ollama 직접 지원 추가 (Main Process에서 fetch 사용)
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOpenRouter } from "@langchain/openrouter";

import type { AIProvider } from "../../../common/features/user-preferences/encrypt-api-key-channel";
import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";
import type { EncryptedApiKeyService } from "../../user-preferences/main/encrypt-api-key.injectable";

// ============================================
// 🎯 Temperature 미지원 모델 목록
// 📊 2026-01 업데이트: o3 시리즈 추가
// ============================================

const TEMPERATURE_RESTRICTED_MODELS = [
  "gpt-5", // GPT-5, GPT-5-mini, GPT-5.2 등
  "o1", // o1-preview, o1-mini 등
  "o3", // o3 reasoning 시리즈 (2026-01 추가)
];

/**
 * 🎯 모델이 temperature 파라미터를 지원하는지 확인
 */
function supportsTemperature(modelId: string): boolean {
  return !TEMPERATURE_RESTRICTED_MODELS.some((prefix) => modelId.startsWith(prefix));
}

// ============================================
// 🎯 Gemini Pro 모델 감지 (2026-01 추가)
// 📝 Pro 모델은 Deep Think 모드로 인해 더 긴 타임아웃 필요
// ============================================

/**
 * 🎯 Gemini Pro 모델인지 확인
 *
 * @param modelId - 모델 ID
 * @returns Pro 모델 여부
 *
 * 📝 주의사항:
 * - Pro 모델은 Flash 대비 응답 시간이 길어 타임아웃 증가 필요
 * - "Deep Think" 모드로 인해 streamEvents에서 빈 응답 이슈 존재 (LangChain 알려진 이슈)
 */
function isGeminiProModel(modelId: string): boolean {
  return modelId.includes("-pro") || modelId.includes(".pro");
}

// ============================================
// 🎯 LLM 모델 타입 정의
// ============================================

export type MainLLMModel = ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI | ChatOllama | ChatOpenRouter;

/**
 * 🎯 Provider별 경량(저비용) 모델 매핑
 *
 * ai-models.ts의 costTier 기준:
 * - cheap 우선 선택, 없으면 moderate fallback
 * - openai: gpt-4o-mini (cheap) — 가장 저렴
 * - anthropic: claude-haiku-4-5-20251001 (moderate) — cheap 없음
 * - google: gemini-2.5-flash (cheap) — 주석 처리 상태지만 API 호출 가능
 */
const LIGHT_MODELS: Partial<Record<AIProvider, string>> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  google: "gemini-2.5-flash",
  // OpenRouter: Free 모델은 수시로 변경되므로 유료 모델 사용
  openrouter: "xiaomi/mimo-v2-pro",
};

// ============================================
// 🎯 LLM Model Factory 의존성
// ============================================

export interface LLMModelFactoryDependencies {
  readonly encryptedApiKeyService: EncryptedApiKeyService;
  readonly userPreferencesState: UserPreferencesState;
}

// ============================================
// 🎯 LLM Model Factory 클래스
// ============================================

/**
 * 🎯 Main Process용 LLM 모델 팩토리
 *
 * API 키를 안전하게 관리하면서 LLM 모델 인스턴스를 생성합니다.
 */
export class LLMModelFactory {
  constructor(private readonly dependencies: LLMModelFactoryDependencies) {}

  /**
   * 🎯 Provider와 모델 ID로 LLM 인스턴스 생성
   *
   * @param provider - AI Provider (openai, anthropic, google, ollama)
   * @param modelId - 모델 ID
   * @param options - 추가 옵션
   * @returns LLM 모델 인스턴스
   * @throws API 키가 없거나 복호화 실패 시 에러
   */
  createModel(
    provider: AIProvider,
    modelId: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): MainLLMModel {
    // 🎯 Ollama는 네이티브 ChatOllama 사용 (bindTools() 지원)
    if (provider === "ollama") {
      const ollamaBaseUrl = this.dependencies.userPreferencesState.ollamaBaseUrl || "http://localhost:11434";
      console.log("[LLMModelFactory] ChatOllama 모델 생성:", { model: modelId, baseUrl: ollamaBaseUrl });
      return new ChatOllama({
        model: modelId,
        baseUrl: ollamaBaseUrl,
      });
    }

    // 🎯 암호화된 API 키 가져오기
    const encryptedKey = this.dependencies.userPreferencesState.aiApiKeys?.[provider];

    if (!encryptedKey) {
      throw new Error(`API 키가 설정되지 않았습니다: ${provider}`);
    }

    // 🎯 API 키 복호화 (Main Process 내부에서만)
    const apiKey = this.dependencies.encryptedApiKeyService.decryptApiKey(provider, encryptedKey);

    // 🎯 API 키 유효성 검증 및 디버깅 (2026-01-08)
    // LangChain은 apiKey가 falsy면 환경 변수를 사용하므로 명시적 검증 필요
    if (!apiKey || apiKey.trim() === "") {
      console.error(`[LLMModelFactory] API 키 복호화 실패 또는 빈 키: ${provider}`);
      throw new Error(`API 키가 유효하지 않습니다: ${provider}. 설정에서 API 키를 다시 확인해주세요.`);
    }

    // 디버그 로그 (키의 앞 8자만 표시)
    const maskedKey = apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4);
    console.log(`[LLMModelFactory] ${provider} API 키 로드 성공: ${maskedKey}`);

    // 🎯 Temperature 지원 여부 확인
    const useTemperature = supportsTemperature(modelId);
    const temperature = options?.temperature ?? (useTemperature ? 0 : undefined);

    // 🎯 Provider별 모델 생성
    switch (provider) {
      case "openai":
        return new ChatOpenAI({
          apiKey,
          model: modelId,
          ...(temperature !== undefined && { temperature }),
          ...(options?.maxTokens && { maxTokens: options.maxTokens }),
        });

      case "anthropic": {
        // 🎯 환경 변수 ANTHROPIC_API_KEY 존재 시 경고
        // LangChain이 환경 변수를 폴백으로 사용할 수 있으므로 명시적으로 경고
        if (process.env.ANTHROPIC_API_KEY) {
          console.warn(
            "[LLMModelFactory] 경고: 환경 변수 ANTHROPIC_API_KEY가 설정되어 있습니다. " +
              "앱 설정의 API 키가 우선 사용됩니다.",
          );
        }

        // 🎯 Phase 2: Prompt Caching 활성화 (2026-01-31)
        // - 비용 90% 절감 (캐시 히트 시)
        // - 지연 시간 80% 감소
        // - 5분 TTL (ephemeral)
        return new ChatAnthropic({
          apiKey,
          model: modelId,
          ...(temperature !== undefined && { temperature }),
          ...(options?.maxTokens && { maxTokens: options.maxTokens }),
          // 🎯 Prompt Caching Beta 활성화
          betas: ["prompt-caching-2024-07-31"],
        });
      }

      case "google": {
        // 🎯 Pro 모델은 Deep Think 모드로 인해 더 긴 타임아웃 필요 (2026-01)
        const isProModel = isGeminiProModel(modelId);
        // Pro: 120초, Flash: 30초
        const googleTimeout = isProModel ? 120000 : 30000;
        // Pro: 3회, Flash: 2회
        const googleMaxRetries = isProModel ? 3 : 2;

        if (isProModel) {
          console.log(
            `[LLMModelFactory] Gemini Pro 모델 감지 - 확장 타임아웃 적용: ${googleTimeout}ms, maxRetries: ${googleMaxRetries}`,
          );
        }

        // 🎯 타입 단언: @langchain/google-genai 2.x 타입 정의에 timeout/maxRetries 미포함
        // 실제 런타임에서는 BaseChatModel 옵션으로 지원됨
        return new ChatGoogleGenerativeAI({
          apiKey,
          model: modelId,
          ...(temperature !== undefined && { temperature }),
          streamUsage: false,
          timeout: googleTimeout,
          maxRetries: googleMaxRetries,
        } as any);
      }

      case "openrouter":
        console.log(`[LLMModelFactory] OpenRouter 모델 생성: ${modelId}`);
        return new ChatOpenRouter({
          model: modelId,
          apiKey,
          ...(temperature !== undefined && { temperature }),
          ...(options?.maxTokens && { maxTokens: options.maxTokens }),
        });

      default:
        throw new Error(`지원하지 않는 Provider입니다: ${provider}`);
    }
  }

  /**
   * 🎯 UserPreferences에서 현재 선택된 Provider와 모델로 인스턴스 생성
   *
   * @returns LLM 모델 인스턴스 또는 null
   */
  createModelFromPreferences(): MainLLMModel | null {
    const provider = this.dependencies.userPreferencesState.aiProvider as AIProvider | undefined;

    if (!provider) {
      console.warn("[LLMModelFactory] AI Provider가 설정되지 않았습니다");
      return null;
    }

    const modelId = this.dependencies.userPreferencesState.aiModel;

    if (!modelId) {
      console.warn("[LLMModelFactory] 모델 ID가 설정되지 않았습니다");
      return null;
    }

    try {
      return this.createModel(provider, modelId);
    } catch (error) {
      console.error("[LLMModelFactory] 모델 생성 실패:", error);
      return null;
    }
  }

  /**
   * 🎯 프로필 추출용 경량(저비용) 모델 생성
   *
   * 유저가 설정한 provider 기준으로 가장 저렴한(cheap) 모델을 선택합니다.
   * cheap 모델이 없으면 moderate로 fallback합니다.
   *
   * @returns 경량 LLM 모델 인스턴스 또는 null
   */
  createLightModel(): MainLLMModel | null {
    const provider = this.dependencies.userPreferencesState.aiProvider as AIProvider | undefined;

    if (!provider) {
      console.warn("[LLMModelFactory] AI Provider가 설정되지 않았습니다");
      return null;
    }

    // Ollama는 유저 설정 모델 그대로 사용 (로컬이라 비용 없음)
    if (provider === "ollama") {
      return this.createModelFromPreferences();
    }

    const lightModelId = LIGHT_MODELS[provider];

    if (!lightModelId) {
      console.warn("[LLMModelFactory] 경량 모델 미정의, 기본 모델 사용:", provider);
      return this.createModelFromPreferences();
    }

    try {
      return this.createModel(provider, lightModelId, {
        temperature: 0,
        maxTokens: 1024,
      });
    } catch (error) {
      console.warn("[LLMModelFactory] 경량 모델 생성 실패, 기본 모델 fallback:", error);
      return this.createModelFromPreferences();
    }
  }

  /**
   * 🎯 API 키가 설정되어 있는지 확인
   *
   * @param provider - AI Provider
   * @returns API 키 설정 여부
   */
  hasApiKey(provider: AIProvider): boolean {
    if (provider === "ollama") {
      return true; // Ollama는 API 키 불필요
    }

    return !!this.dependencies.userPreferencesState.aiApiKeys?.[provider];
  }
}
