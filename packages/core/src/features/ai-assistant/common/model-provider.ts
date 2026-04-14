/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: AI Provider별 LLM 모델 인스턴스를 생성하는 헬퍼
 *
 * 📝 Extension Host 패턴 적용:
 * - OpenAI/Anthropic/Google: IPCChatModel 사용 (API 키는 Main에서만 복호화)
 * - Ollama: OllamaChatModel 사용 (기존 IPC 패턴 유지)
 *
 * 🔒 보안 개선:
 * - API 키가 Renderer Process에서 절대 노출되지 않음
 * - 모든 LLM 호출은 Main Process에서 실행
 *
 * 🔄 변경이력:
 * - 2025-12-16: Extension Host 패턴으로 리팩토링 (API 키 Renderer 노출 방지)
 */

import { OllamaChatModel } from "../../ollama/renderer/ollama-chat-model";
import { IPCChatModel } from "../renderer/ipc-chat-model";
import { DEFAULT_MODEL_ID, getModelsByProvider } from "../renderer/provider/ai-models";

import type { AIProvider } from "../../../common/features/user-preferences/encrypt-api-key-channel";
import type { OllamaService } from "../../ollama/renderer/ollama-service.injectable";
import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";
import type { CreateIPCChatModel } from "../renderer/ipc-chat-model.injectable";

// ============================================
// 🎯 LLM 모델 타입 정의
// ============================================

/**
 * 🎯 LLM 모델 타입
 *
 * - IPCChatModel: OpenAI/Anthropic/Google (Main Process에서 실행)
 * - OllamaChatModel: Ollama (기존 IPC 패턴)
 */
export type LLMModel = IPCChatModel | OllamaChatModel;

/**
 * 🎯 모델과 모델 ID를 함께 반환하는 결과 타입
 *
 * modelId는 조건부 프롬프트 스키마 빌드에 사용
 * @see schema-utils.ts - buildPromptWithSchema()
 */
export interface ModelWithId {
  model: LLMModel;
  modelId: string;
}

// ============================================
// 🎯 ModelProvider 의존성
// ============================================

export interface ModelProviderDependencies {
  readonly userPreferencesState: UserPreferencesState;
  /** 🎯 IPCChatModel 팩토리 (OpenAI/Anthropic/Google용) */
  readonly createIPCChatModel: CreateIPCChatModel;
  /** 🎯 Ollama IPC 서비스 (기존 패턴 유지) */
  readonly ollamaService: OllamaService;
}

// ============================================
// 🎯 ModelProvider 클래스
// ============================================

/**
 * 🎯 AI Provider별 LLM 모델 생성기
 *
 * Extension Host 패턴 적용으로 API 키가 Renderer에서 노출되지 않습니다.
 *
 * @example
 * ```typescript
 * const modelProvider = new ModelProvider(dependencies);
 * const model = await modelProvider.getModelFromPreferences();
 * if (model) {
 *   const result = await model.invoke([new HumanMessage("Hello")]);
 * }
 * ```
 */
export class ModelProvider {
  constructor(private readonly dependencies: ModelProviderDependencies) {}

  /**
   * 🎯 UserPreferences에서 현재 선택된 모델로 LLM 인스턴스 생성
   *
   * @param providerOverride - 강제로 사용할 provider (없으면 preferences 기준)
   * @param modelIdOverride - 강제로 사용할 모델 ID (없으면 preferences 기준)
   * @returns LLM 모델 또는 null (provider 미설정 시)
   */
  async getModelFromPreferences(providerOverride?: AIProvider, modelIdOverride?: string): Promise<LLMModel | null> {
    const result = await this.getModelWithIdFromPreferences(providerOverride, modelIdOverride);

    return result?.model ?? null;
  }

  /**
   * 🎯 UserPreferences에서 현재 선택된 모델과 모델 ID를 함께 반환
   *
   * @param providerOverride - 강제로 사용할 provider (없으면 preferences 기준)
   * @param modelIdOverride - 강제로 사용할 모델 ID (없으면 preferences 기준)
   * @returns { model, modelId } 또는 null (provider 미설정 시)
   *
   * 📝 주의사항:
   * - API 키 유효성 검사는 Main Process에서 실행 시 수행됨
   * - modelId는 조건부 프롬프트 스키마 빌드에 필요
   */
  async getModelWithIdFromPreferences(
    providerOverride?: AIProvider,
    modelIdOverride?: string,
  ): Promise<ModelWithId | null> {
    const provider = providerOverride ?? (this.dependencies.userPreferencesState.aiProvider as AIProvider | undefined);

    if (!provider) {
      console.warn("[ModelProvider] No AI provider configured");

      return null;
    }

    // 🎯 모델 ID 결정
    const modelId = this.determineModelId(provider, modelIdOverride);

    // 🎯 Provider별 모델 생성
    const model = this.createModel(provider, modelId);

    // 🎯 디버그: 선택된 모델 확인용 로그
    console.log(`[ModelProvider] 🤖 Using model: ${modelId} (provider: ${provider})`);

    return { model, modelId };
  }

  /**
   * 🎯 모델 ID 결정 로직
   *
   * @param provider - AI Provider
   * @param modelIdOverride - 강제 지정 모델 ID
   * @returns 최종 모델 ID
   */
  private determineModelId(provider: AIProvider, modelIdOverride?: string): string {
    if (modelIdOverride) {
      return modelIdOverride;
    }

    // 🎯 Ollama는 별도 설정 사용
    if (provider === "ollama") {
      return this.dependencies.userPreferencesState.ollamaModel || "gemma3:4b";
    }

    // 🎯 preferences > provider별 첫 번째 모델 > 기본값
    return this.dependencies.userPreferencesState.aiModel ?? getModelsByProvider(provider)[0]?.id ?? DEFAULT_MODEL_ID;
  }

  /**
   * 🎯 Provider별 LLM 모델 인스턴스 생성
   *
   * @param provider - AI Provider
   * @param modelId - 모델 ID
   * @returns LLM 모델 인스턴스
   *
   * 📝 Extension Host 패턴:
   * - OpenAI/Anthropic/Google → IPCChatModel (Main에서 API 호출)
   * - Ollama → OllamaChatModel (기존 IPC 패턴)
   */
  createModel(provider: AIProvider, modelId: string): LLMModel {
    switch (provider) {
      // 🎯 OpenAI/Anthropic/Google: IPC 기반 모델 (API 키는 Main에서만 복호화)
      case "openai":
      case "anthropic":
      case "google":
      case "openrouter":
        return this.dependencies.createIPCChatModel(provider, modelId);

      // 🎯 Ollama: 기존 IPC 패턴 유지 (API 키 불필요)
      case "ollama": {
        const ollamaBaseUrl = this.dependencies.userPreferencesState.ollamaBaseUrl || "http://localhost:11434";
        const ollamaUrl = ollamaBaseUrl.replace("localhost", "127.0.0.1");

        console.log(`[ModelProvider] 🦙 Using Ollama model: ${modelId} at ${ollamaUrl}`);

        return new OllamaChatModel({
          model: modelId,
          baseUrl: ollamaUrl,
          ollamaService: this.dependencies.ollamaService,
          temperature: 0,
        });
      }

      default:
        throw new Error(`지원하지 않는 Provider입니다: ${provider}`);
    }
  }

  /**
   * @deprecated LangGraph 통합에서는 `getModelFromPreferences` 사용을 권장합니다.
   *
   * 기존 코드와의 호환용 동기 메서드입니다.
   * OpenAI/Anthropic/Google의 경우 API 키 파라미터는 무시됩니다 (Main에서 복호화).
   */
  getModel(provider: AIProvider, _apiKey: string, modelId?: string): LLMModel {
    const effectiveModelId = modelId ?? this.determineModelId(provider, undefined);

    return this.createModel(provider, effectiveModelId);
  }
}
