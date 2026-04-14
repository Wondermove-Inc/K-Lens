/**
 * 🎯 목적: AI Assistant Feature Flags 관리 모듈
 *
 * 01: Feature Flags 상수 및 유틸리티 함수
 *
 * 주요 기능:
 * - Phase별 기능 그룹 정의
 * - 런타임 기능 활성화/비활성화
 * - 환경 변수 오버라이드 지원
 *
 * @packageDocumentation
 */

// ============================================
// 🎯 타입 정의
// ============================================

/** Feature Flag 키 타입 - AI Assistant의 모든 기능 정의 */
export type FeatureFlagKey =
  // Phase 1: 기본 UX 고도화
  | "CONTEXT_PILLS"
  | "MENTION_AUTOCOMPLETE"
  | "SLASH_COMMANDS"
  | "MCP_INTEGRATION"
  // Phase 1+: 실시간 피드백
  | "STREAMING_RESPONSE"
  | "THINKING_INDICATOR"
  | "PLAN_MODE"
  // Phase 2: Diff + Agent Mode
  | "DIFF_VIEWER"
  | "AGENT_MODE"
  | "SESSION_RESUME"
  // Phase 2+: 모니터링 & 스킬 전문가
  | "CLUSTER_MONITOR"
  | "SKILL_EXPERT"
  // Phase 3: 고급 기능
  | "AUDIT_LOGGING"
  | "IMAGE_ATTACHMENT"
  | "BACKGROUND_AGENT"
  // Future
  | "MULTI_MODEL"
  | "I18N"
  | "THEME"
  // 🎯 Intent System 개선 (6단계 Intent 체계)
  | "NEW_INTENT_SYSTEM";

/** Feature Group 키 타입 - Phase별 기능 그룹 정의 */
export type FeatureGroupKey =
  | "PHASE_1"
  | "PHASE_1_PLUS"
  | "PHASE_2"
  | "PHASE_2_PLUS"
  | "PHASE_3"
  | "FUTURE"
  | "INTENT_IMPROVEMENT";

/**
 * 🎯 Rollout 설정 인터페이스
 *
 * 점진적 롤아웃을 위한 설정값
 */
export interface RolloutConfig {
  /** 롤아웃 비율 (0-100) */
  percentage: number;
  /** 롤아웃 시작 시간 (optional) */
  startTime?: Date;
  /** 로깅 활성화 여부 */
  enableLogging: boolean;
}

/** Feature Flags 객체 타입 */
export type FeatureFlagsType = Record<FeatureFlagKey, boolean>;

/** Feature Groups 객체 타입 */
export type FeatureGroupsType = Record<FeatureGroupKey, readonly FeatureFlagKey[]>;

// ============================================
// 🎯 기본 Feature Flags 정의
// ============================================

/** 기본 Feature Flag 값 - P0 활성화, P1/P2 비활성화 */
const DEFAULT_FLAGS: FeatureFlagsType = {
  // Phase 1: 기본 UX 고도화 (P0)
  CONTEXT_PILLS: true,
  MENTION_AUTOCOMPLETE: true,
  SLASH_COMMANDS: true,
  MCP_INTEGRATION: true,
  // Phase 1+: 실시간 피드백 (P0)
  STREAMING_RESPONSE: true,
  THINKING_INDICATOR: true,
  PLAN_MODE: true,
  // Phase 2: Diff + Agent Mode (P1)
  DIFF_VIEWER: false,
  AGENT_MODE: false,
  SESSION_RESUME: false,
  // Phase 2+: 모니터링 & 스킬 전문가 (미검증 — UI 숨김)
  CLUSTER_MONITOR: false,
  SKILL_EXPERT: false,
  // Phase 3: 고급 기능 (P1)
  AUDIT_LOGGING: false,
  IMAGE_ATTACHMENT: false,
  BACKGROUND_AGENT: false,
  // Future (P2)
  MULTI_MODEL: false,
  I18N: false,
  THEME: false,
  // 🎯 Intent System 개선 (6단계 Intent 체계)
  NEW_INTENT_SYSTEM: false, // 초기: 비활성화, 점진적 롤아웃 예정
};

// ============================================
// 🎯 런타임 Feature Flags 상태
// ============================================

/** 현재 Feature Flag 상태 (런타임 변경 가능) */
let currentFlags: FeatureFlagsType = { ...DEFAULT_FLAGS };

/**
 * AI_ASSISTANT_FLAGS - 외부 참조용 현재 Feature Flag 상태
 * Proxy로 currentFlags 값 반영
 */
export const AI_ASSISTANT_FLAGS: Readonly<FeatureFlagsType> = new Proxy({} as FeatureFlagsType, {
  get(_target, prop: string) {
    return currentFlags[prop as FeatureFlagKey];
  },
  set() {
    return false; // 직접 수정 불가
  },
});

// ============================================
// 🎯 Feature Groups 정의
// ============================================

/** Phase별 Feature 그룹 정의 */
export const FEATURE_GROUPS: FeatureGroupsType = {
  PHASE_1: ["CONTEXT_PILLS", "MENTION_AUTOCOMPLETE", "SLASH_COMMANDS", "MCP_INTEGRATION"] as const,
  PHASE_1_PLUS: ["STREAMING_RESPONSE", "THINKING_INDICATOR", "PLAN_MODE"] as const,
  PHASE_2: ["DIFF_VIEWER", "AGENT_MODE", "SESSION_RESUME"] as const,
  PHASE_2_PLUS: ["CLUSTER_MONITOR", "SKILL_EXPERT"] as const,
  PHASE_3: ["AUDIT_LOGGING", "IMAGE_ATTACHMENT", "BACKGROUND_AGENT"] as const,
  FUTURE: ["MULTI_MODEL", "I18N", "THEME"] as const,
  INTENT_IMPROVEMENT: ["NEW_INTENT_SYSTEM"] as const,
};

// ============================================
// 🎯 Intent System Rollout 설정
// ============================================

/**
 * NEW_INTENT_SYSTEM 롤아웃 설정
 * 점진적 롤아웃: 0% → 20% → 50% → 100%
 */
let intentSystemRolloutConfig: RolloutConfig = {
  percentage: 0, // 초기: 0%
  enableLogging: true,
};

/**
 * Intent System 롤아웃 설정 변경
 * @param config - 새로운 롤아웃 설정
 */
export function setIntentSystemRollout(config: Partial<RolloutConfig>): void {
  intentSystemRolloutConfig = { ...intentSystemRolloutConfig, ...config };
  console.log(`[Feature Flags] NEW_INTENT_SYSTEM 롤아웃 설정 변경:`, intentSystemRolloutConfig);
}

/**
 * 현재 Intent System 롤아웃 설정 반환
 */
export function getIntentSystemRolloutConfig(): RolloutConfig {
  return { ...intentSystemRolloutConfig };
}

/**
 * 🎯 사용자/세션에 대해 새 Intent 시스템 활성화 여부 결정
 *
 * 롤아웃 비율에 따라 확률적으로 결정합니다.
 * 동일 세션에서는 일관된 결과를 위해 sessionId 기반으로 결정.
 *
 * @param sessionId - 세션 ID (일관된 A/B 그룹 할당용)
 * @returns 새 Intent 시스템 사용 여부
 *
 * @example
 * const useNewSystem = shouldUseNewIntentSystem("session-123");
 * if (useNewSystem) {
 *   // 6단계 Intent 시스템 사용
 * } else {
 *   // 4단계 레거시 시스템 사용
 * }
 */
export function shouldUseNewIntentSystem(sessionId: string): boolean {
  // Feature Flag가 비활성화면 무조건 false
  if (!isFeatureEnabled("NEW_INTENT_SYSTEM")) {
    return false;
  }

  const { percentage, enableLogging } = intentSystemRolloutConfig;

  // 100% 롤아웃이면 모든 사용자에게 적용
  if (percentage >= 100) {
    if (enableLogging) {
      console.log(`[Intent System] 100% 롤아웃 - 새 시스템 사용`, { sessionId });
    }
    return true;
  }

  // 0% 롤아웃이면 아무도 사용 안함
  if (percentage <= 0) {
    if (enableLogging) {
      console.log(`[Intent System] 0% 롤아웃 - 레거시 시스템 사용`, { sessionId });
    }
    return false;
  }

  // 세션 ID 기반 해시로 일관된 그룹 할당
  const hash = hashString(sessionId);
  const bucket = hash % 100; // 0-99
  const useNew = bucket < percentage;

  if (enableLogging) {
    console.log(`[Intent System] A/B 그룹 할당`, {
      sessionId,
      bucket,
      percentage,
      useNewSystem: useNew,
    });
  }

  return useNew;
}

/**
 * 문자열을 숫자 해시로 변환 (djb2 알고리즘)
 * @param str - 해시할 문자열
 * @returns 0 이상의 정수 해시값
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// ============================================
// 🎯 유틸리티 함수
// ============================================

/**
 * 특정 기능 활성화 여부 확인
 * @param feature - Feature Flag 키
 * @returns 활성화 여부
 */
export function isFeatureEnabled(feature: FeatureFlagKey | string): boolean {
  if (!(feature in currentFlags)) {
    return false;
  }
  return currentFlags[feature as FeatureFlagKey] ?? false;
}

/**
 * 특정 그룹의 모든 기능 활성화
 * @param group - Feature Group 키
 */
export function enableFeatureGroup(group: FeatureGroupKey): void {
  const features = FEATURE_GROUPS[group];
  if (!features) {
    console.warn(`[Feature Flags] 알 수 없는 그룹: ${group}`);
    return;
  }
  for (const feature of features) {
    currentFlags[feature] = true;
  }
}

/**
 * 특정 그룹의 모든 기능 비활성화
 * @param group - Feature Group 키
 */
export function disableFeatureGroup(group: FeatureGroupKey): void {
  const features = FEATURE_GROUPS[group];
  if (!features) {
    console.warn(`[Feature Flags] 알 수 없는 그룹: ${group}`);
    return;
  }
  for (const feature of features) {
    currentFlags[feature] = false;
  }
}

/** 모든 Feature Flag를 기본값으로 리셋 */
export function resetFeatureFlags(): void {
  currentFlags = { ...DEFAULT_FLAGS };
}

/**
 * 개별 기능 활성화 상태 설정
 * @param feature - Feature Flag 키
 * @param enabled - 활성화 여부
 */
export function setFeatureEnabled(feature: FeatureFlagKey, enabled: boolean): void {
  currentFlags[feature] = enabled;
}

/** 현재 활성화된 기능 목록 반환 (디버깅용) */
export function getEnabledFeatures(): FeatureFlagKey[] {
  return (Object.keys(currentFlags) as FeatureFlagKey[]).filter((key) => currentFlags[key]);
}

/** 현재 비활성화된 기능 목록 반환 (디버깅용) */
export function getDisabledFeatures(): FeatureFlagKey[] {
  return (Object.keys(currentFlags) as FeatureFlagKey[]).filter((key) => !currentFlags[key]);
}

// ============================================
// 🎯 환경 변수 오버라이드
// ============================================

/**
 * 환경 변수에서 Feature Flag 오버라이드 적용
 * 형식: DAIVE_FEATURE_{FLAG_NAME}=true|false
 * 📝 앱 초기화 시 한 번만 호출
 */
export function applyEnvironmentOverrides(): void {
  if (typeof process === "undefined" || !process.env) {
    return;
  }
  const prefix = "DAIVE_FEATURE_";
  for (const key of Object.keys(currentFlags) as FeatureFlagKey[]) {
    const envKey = `${prefix}${key}`;
    const envValue = process.env[envKey];
    if (envValue !== undefined) {
      const enabled = envValue.toLowerCase() === "true";
      currentFlags[key] = enabled;
      console.log(`[Feature Flags] 환경 변수 오버라이드: ${key} = ${enabled}`);
    }
  }
}
