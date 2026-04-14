/**
 * 🎯 목적: AI 모델 정의 및 Provider 관리
 * 관리자가 이 파일의 AI_MODELS 배열을 수정하여 지원 모델을 통제할 수 있음
 */

// ============================================
// 🎯 Provider 정의
// ============================================

// 🎯 목적: AI Provider 타입 정의
export type AIProvider = "openai" | "anthropic" | "google" | "ollama" | "openrouter";

export enum AIProviders {
  OPEN_AI = "openai",
  ANTHROPIC = "anthropic",
  GOOGLE = "google",
  OLLAMA = "ollama",
  OPENROUTER = "openrouter",
}

// ============================================
// 🎯 비용 등급 타입 (2026-01 추가)
// ============================================

/**
 * 🎯 목적: 비용 등급 타입 정의
 *
 * 📝 등급별 기준 (Input $/MTok):
 * - premium: 💎 $5.00 이상 (최고급)
 * - expensive: 💰 $2.00~$4.99 (고급)
 * - moderate: 💵 $0.50~$1.99 (균형)
 * - cheap: 🪙 $0.50 미만 (경제적)
 *
 * 📊 등급별 모델 분포:
 * - premium: 4개 (Claude Opus 시리즈)
 * - expensive: 6개 (GPT-4.1, GPT-4o, o3, Claude Sonnet 시리즈)
 * - moderate: 2개 (GPT-5.2, Claude Haiku 4.5)
 * - cheap: 2개 (GPT-5-mini, GPT-4o-mini)
 * - Google Gemini 모델은 현재 주석 처리
 */
export type CostTier = "premium" | "expensive" | "moderate" | "cheap" | "free";

// ============================================
// 🎯 모델 정의 인터페이스
// ============================================

/**
 * 🎯 목적: AI 모델 정의 인터페이스
 *
 * 📝 변경 사항:
 * - costTier 필드 추가 (v2026.01)
 *
 * 📊 사용처:
 * - AI_MODELS 배열
 * - getAvailableModels() 반환 타입
 * - Settings UI 렌더링
 */
export interface AIModelDefinition {
  /** 모델 ID (API 호출용) - 예: "gpt-5.2", "claude-opus-4-5-20251101" */
  id: string;
  /** UI 표시용 이름 - 예: "GPT-5.2", "Claude 4.5 Opus" */
  displayName: string;
  /** 소속 Provider */
  provider: AIProvider;
  /** 사용 가능 여부 (관리자 설정) - 기본값 true */
  available: boolean;
  /** 💎💰💵🪙 비용 등급 (v2026.01 추가) */
  costTier: CostTier;
  /** tool calling (function calling) 지원 여부 — 모니터 에이전트에서 필수 */
  supportsTools: boolean;
}

// ============================================
// 🎯 지원 모델 목록 (2026년 2월 기준)
// 📊 총 14개 모델: OpenAI 6개, Anthropic 8개 (Google Gemini는 주석 처리)
// ============================================

export const AI_MODELS: AIModelDefinition[] = [
  // ============================================
  // OpenAI (4개) - 구버전 모델 제거
  // ============================================
  {
    id: "gpt-5.4",
    displayName: "GPT-5.4",
    provider: "openai",
    available: true,
    costTier: "expensive",
    supportsTools: true,
  },
  {
    id: "gpt-5.2",
    displayName: "GPT-5.2",
    provider: "openai",
    available: true,
    costTier: "moderate",
    supportsTools: true,
  },
  {
    id: "gpt-5-mini",
    displayName: "GPT-5 Mini",
    provider: "openai",
    available: true,
    costTier: "cheap",
    supportsTools: true,
  },
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    provider: "openai",
    available: true,
    costTier: "cheap",
    supportsTools: true,
  },

  // ============================================
  // Anthropic (5개) - 구버전 모델 제거
  // ============================================
  {
    id: "claude-opus-4-6",
    displayName: "Claude 4.6 Opus",
    provider: "anthropic",
    available: true,
    costTier: "premium",
    supportsTools: true,
  },
  {
    id: "claude-sonnet-4-6",
    displayName: "Claude 4.6 Sonnet",
    provider: "anthropic",
    available: true,
    costTier: "expensive",
    supportsTools: true,
  },
  {
    id: "claude-opus-4-5-20251101",
    displayName: "Claude 4.5 Opus",
    provider: "anthropic",
    available: true,
    costTier: "premium",
    supportsTools: true,
  },
  {
    id: "claude-sonnet-4-5-20250929",
    displayName: "Claude 4.5 Sonnet",
    provider: "anthropic",
    available: true,
    costTier: "expensive",
    supportsTools: true,
  },
  {
    id: "claude-haiku-4-5-20251001",
    displayName: "Claude 4.5 Haiku",
    provider: "anthropic",
    available: true,
    costTier: "moderate",
    supportsTools: true,
  },

  // ============================================
  // Google (Gemini) - 주석 처리
  // ============================================
  /*
  { id: "gemini-3-flash-preview", displayName: "Gemini 3 Flash", provider: "google", available: true, costTier: "moderate", supportsTools: true },
  { id: "gemini-3-pro-preview", displayName: "Gemini 3 Pro", provider: "google", available: true, costTier: "expensive", supportsTools: true },
  { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", provider: "google", available: true, costTier: "moderate", supportsTools: true },
  { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", provider: "google", available: true, costTier: "cheap", supportsTools: true },
  */

  // ============================================
  // OpenRouter (8개, 대형 3사 제외 — 2026-04 리더보드 기준)
  // ⚠️ Free 모델은 수시로 변경되므로 Browse Models에서 실시간 확인 권장
  // ============================================
  {
    id: "x-ai/grok-4.1-fast",
    displayName: "Grok 4.1 Fast",
    provider: "openrouter",
    available: true,
    costTier: "cheap",
    supportsTools: true,
  },
  {
    id: "deepseek/deepseek-v3.2",
    displayName: "DeepSeek V3.2",
    provider: "openrouter",
    available: true,
    costTier: "cheap",
    supportsTools: true,
  },
  {
    id: "minimax/minimax-m2.7",
    displayName: "MiniMax M2.7",
    provider: "openrouter",
    available: true,
    costTier: "cheap",
    supportsTools: true,
  },
  {
    id: "moonshotai/kimi-k2.5",
    displayName: "Kimi K2.5",
    provider: "openrouter",
    available: true,
    costTier: "cheap",
    supportsTools: true,
  },
  {
    id: "xiaomi/mimo-v2-omni",
    displayName: "MiMo-V2-Omni",
    provider: "openrouter",
    available: true,
    costTier: "cheap",
    supportsTools: true,
  },
  {
    id: "z-ai/glm-5",
    displayName: "GLM 5",
    provider: "openrouter",
    available: true,
    costTier: "moderate",
    supportsTools: true,
  },
  {
    id: "xiaomi/mimo-v2-pro",
    displayName: "MiMo-V2-Pro",
    provider: "openrouter",
    available: true,
    costTier: "moderate",
    supportsTools: true,
  },
  {
    id: "z-ai/glm-5-turbo",
    displayName: "GLM 5 Turbo",
    provider: "openrouter",
    available: true,
    costTier: "moderate",
    supportsTools: true,
  },
];

// 기본 모델 ID (2026-01: gpt-5.2로 변경)
export const DEFAULT_MODEL_ID = "gpt-5.2";

// ============================================
// 🎯 헬퍼 함수
// ============================================

/**
 * 🎯 목적: 비용 등급 아이콘 반환
 *
 * @param costTier - 비용 등급
 * @returns 이모지 아이콘 문자열
 *
 * 📊 매핑:
 * - premium → "💎"
 * - expensive → "💰"
 * - moderate → "💵"
 * - cheap → "🪙"
 */
export function getCostTierIcon(costTier: CostTier): string {
  const icons: Record<CostTier, string> = {
    premium: "💎",
    expensive: "💰",
    moderate: "💵",
    cheap: "🪙",
    free: "🆓",
  };

  return icons[costTier];
}

/**
 * 🎯 목적: 비용 등급 라벨 반환 (영어)
 *
 * @param costTier - 비용 등급
 * @returns 영어 라벨 문자열
 *
 * 📊 매핑:
 * - premium → "Premium"
 * - expensive → "Expensive"
 * - moderate → "Moderate"
 * - cheap → "Cheap"
 */
export function getCostTierLabel(costTier: CostTier): string {
  const labels: Record<CostTier, string> = {
    premium: "Premium",
    expensive: "Expensive",
    moderate: "Moderate",
    cheap: "Cheap",
    free: "Free",
  };

  return labels[costTier];
}

/**
 * 특정 Provider의 모델 목록 반환
 */
export function getModelsByProvider(provider: AIProvider): AIModelDefinition[] {
  return AI_MODELS.filter((model) => model.provider === provider && model.available);
}

/**
 * 모델 ID로 Provider 찾기
 */
export function getProviderByModel(modelId: string): AIProvider | undefined {
  const model = AI_MODELS.find((m) => m.id === modelId);

  return model?.provider;
}

/**
 * 모델 ID로 모델 정의 찾기
 */
export function getModelById(modelId: string): AIModelDefinition | undefined {
  return AI_MODELS.find((m) => m.id === modelId);
}

/**
 * 모델 ID로 표시 이름 가져오기
 */
export function getModelDisplayName(modelId: string): string {
  const model = getModelById(modelId);

  return model?.displayName ?? modelId;
}

/**
 * 🎯 목적: Ollama Provider 여부 확인
 * Ollama는 동적 모델 목록이므로 별도 처리 필요
 */
export function isOllamaProvider(provider: AIProvider): boolean {
  return provider === "ollama";
}

/**
 * 🎯 목적: Ollama 설정 인터페이스
 */
export interface OllamaSettings {
  baseUrl?: string;
  model?: string;
}

/**
 * 사용 가능한 모델 목록 반환
 *
 * @param enabledProviders - Provider별 활성화 상태 (스위치)
 * @param apiKeys - Provider별 API 키
 * @param enabledModels - 개별 모델 활성화 상태 (스위치) - 선택적
 * @param ollamaSettings - Ollama 설정 (baseUrl, model) - 선택적
 *
 * 필터링 조건:
 * 1. model.available === true (관리자 설정)
 * 2. Provider에 API 키가 있음 (Ollama 제외)
 * 3. Provider가 활성화됨 (enabledProviders)
 * 4. 개별 모델이 활성화됨 (enabledModels) - 기본값 true
 */
export function getAvailableModels(
  enabledProviders: Record<string, boolean>,
  apiKeys: Record<string, string | undefined>,
  enabledModels?: Record<string, boolean>,
  ollamaSettings?: OllamaSettings,
  openrouterCustomModel?: string,
): AIModelDefinition[] {
  const models = AI_MODELS.filter((model) => {
    if (!model.available) return false;

    const key = apiKeys[model.provider];
    const hasApiKey = key && key.trim() !== "";
    // 🎯 명시적으로 true인 경우만 활성화 (기본값: false)
    const isProviderEnabled = enabledProviders[model.provider] === true;
    // 🎯 개별 모델 활성화 체크 (기본값: false - 명시적으로 true인 경우만 활성화)
    const isModelEnabled = enabledModels?.[model.id] === true;

    return hasApiKey && isProviderEnabled && isModelEnabled;
  });

  // 🎯 Ollama가 명시적으로 활성화(=== true)되어 있고 모델명이 설정되어 있으면 동적 모델 추가
  // 기본값이 undefined이면 비활성화로 처리 (명시적으로 켜야만 활성화)
  // Ollama는 로컬 실행이므로 costTier: "cheap" (무료)
  if (enabledProviders["ollama"] === true && ollamaSettings?.model) {
    models.push({
      id: ollamaSettings.model,
      displayName: `Ollama: ${ollamaSettings.model}`,
      provider: "ollama",
      available: true,
      costTier: "cheap",
      supportsTools: false,
    });
  }

  // OpenRouter 커스텀 모델: 사용자가 직접 입력한 모델 ID 지원
  if (enabledProviders["openrouter"] === true && openrouterCustomModel) {
    const alreadyExists = models.some((m) => m.id === openrouterCustomModel);
    if (!alreadyExists) {
      models.push({
        id: openrouterCustomModel,
        displayName: `OR: ${openrouterCustomModel}`,
        provider: "openrouter",
        available: true,
        costTier: "moderate",
        supportsTools: true,
      });
    }
  }

  return models;
}

/**
 * Provider별 사용 가능한 모델이 있는지 확인
 */
export function hasAvailableModelsForProvider(
  provider: AIProvider,
  enabledProviders: Record<string, boolean>,
  apiKeys: Record<string, string | undefined>,
): boolean {
  const key = apiKeys[provider];
  const hasApiKey = key && key.trim() !== "";
  const isEnabled = enabledProviders[provider] !== false;

  if (!hasApiKey || !isEnabled) return false;

  return AI_MODELS.some((model) => model.provider === provider && model.available);
}

// ============================================
// 🎯 레거시 호환용 (기존 코드와의 호환성 유지)
// 📊 2026-02 업데이트: 14개 모델 (Google Gemini 주석 처리)
// ============================================

export interface AIModelInfo {
  description: string;
  provider: string;
}

export enum AIModelsEnum {
  // ============================================
  // OpenAI (4개) - 구버전 모델 제거
  // ============================================
  GPT_5_4 = "gpt-5.4",
  GPT_5_2 = "gpt-5.2",
  GPT_5_MINI = "gpt-5-mini",
  GPT_4O_MINI = "gpt-4o-mini",

  // ============================================
  // Anthropic (5개) - 구버전 모델 제거
  // ============================================
  CLAUDE_4_6_OPUS = "claude-opus-4-6",
  CLAUDE_4_6_SONNET = "claude-sonnet-4-6",
  CLAUDE_4_5_OPUS = "claude-opus-4-5-20251101",
  CLAUDE_4_5_SONNET = "claude-sonnet-4-5-20250929",
  CLAUDE_4_5_HAIKU = "claude-haiku-4-5-20251001",

  // ============================================
  // Google (Gemini) - 주석 처리
  // ============================================
  // GEMINI_3_FLASH = "gemini-3-flash-preview",
  // GEMINI_3_PRO = "gemini-3-pro-preview",
  // GEMINI_2_5_PRO = "gemini-2.5-pro",
  // GEMINI_2_5_FLASH = "gemini-2.5-flash",

  // ============================================
  // OpenRouter (8개) - Free 모델은 Browse Models에서 실시간 확인
  // ============================================
  OR_GROK_4_1_FAST = "x-ai/grok-4.1-fast",
  OR_DEEPSEEK_V3_2 = "deepseek/deepseek-v3.2",
  OR_MINIMAX_M2_7 = "minimax/minimax-m2.7",
  OR_KIMI_K2_5 = "moonshotai/kimi-k2.5",
  OR_MIMO_V2_OMNI = "xiaomi/mimo-v2-omni",
  OR_GLM_5 = "z-ai/glm-5",
  OR_MIMO_V2_PRO = "xiaomi/mimo-v2-pro",
  OR_GLM_5_TURBO = "z-ai/glm-5-turbo",
}

export const toAIModelEnum = (value: string): AIModelsEnum | undefined => {
  return Object.values(AIModelsEnum).includes(value as AIModelsEnum) ? (value as AIModelsEnum) : undefined;
};

export const AIModelInfos: Record<string, AIModelInfo> = {
  // ============================================
  // OpenAI (4개) - 구버전 모델 제거
  // ============================================
  [AIModelsEnum.GPT_5_4]: { description: "GPT-5.4", provider: AIProviders.OPEN_AI },
  [AIModelsEnum.GPT_5_2]: { description: "GPT-5.2", provider: AIProviders.OPEN_AI },
  [AIModelsEnum.GPT_5_MINI]: { description: "GPT-5 Mini", provider: AIProviders.OPEN_AI },
  [AIModelsEnum.GPT_4O_MINI]: { description: "GPT-4o Mini", provider: AIProviders.OPEN_AI },

  // ============================================
  // Anthropic (5개) - 구버전 모델 제거
  // ============================================
  [AIModelsEnum.CLAUDE_4_6_OPUS]: { description: "Claude 4.6 Opus", provider: AIProviders.ANTHROPIC },
  [AIModelsEnum.CLAUDE_4_6_SONNET]: { description: "Claude 4.6 Sonnet", provider: AIProviders.ANTHROPIC },
  [AIModelsEnum.CLAUDE_4_5_OPUS]: { description: "Claude 4.5 Opus", provider: AIProviders.ANTHROPIC },
  [AIModelsEnum.CLAUDE_4_5_SONNET]: { description: "Claude 4.5 Sonnet", provider: AIProviders.ANTHROPIC },
  [AIModelsEnum.CLAUDE_4_5_HAIKU]: { description: "Claude 4.5 Haiku", provider: AIProviders.ANTHROPIC },

  // ============================================
  // Google (Gemini) - 주석 처리
  // ============================================
  // [AIModelsEnum.GEMINI_3_FLASH]: { description: "Gemini 3 Flash", provider: AIProviders.GOOGLE },
  // [AIModelsEnum.GEMINI_3_PRO]: { description: "Gemini 3 Pro", provider: AIProviders.GOOGLE },
  // [AIModelsEnum.GEMINI_2_5_PRO]: { description: "Gemini 2.5 Pro", provider: AIProviders.GOOGLE },
  // [AIModelsEnum.GEMINI_2_5_FLASH]: { description: "Gemini 2.5 Flash", provider: AIProviders.GOOGLE },

  // ============================================
  // OpenRouter (8개) - Free 모델은 Browse Models에서 실시간 확인
  // ============================================
  [AIModelsEnum.OR_GROK_4_1_FAST]: { description: "Grok 4.1 Fast", provider: AIProviders.OPENROUTER },
  [AIModelsEnum.OR_DEEPSEEK_V3_2]: { description: "DeepSeek V3.2", provider: AIProviders.OPENROUTER },
  [AIModelsEnum.OR_MINIMAX_M2_7]: { description: "MiniMax M2.7", provider: AIProviders.OPENROUTER },
  [AIModelsEnum.OR_KIMI_K2_5]: { description: "Kimi K2.5", provider: AIProviders.OPENROUTER },
  [AIModelsEnum.OR_MIMO_V2_OMNI]: { description: "MiMo-V2-Omni", provider: AIProviders.OPENROUTER },
  [AIModelsEnum.OR_GLM_5]: { description: "GLM 5", provider: AIProviders.OPENROUTER },
  [AIModelsEnum.OR_MIMO_V2_PRO]: { description: "MiMo-V2-Pro", provider: AIProviders.OPENROUTER },
  [AIModelsEnum.OR_GLM_5_TURBO]: { description: "GLM 5 Turbo", provider: AIProviders.OPENROUTER },
};
