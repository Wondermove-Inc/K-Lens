/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: DAIVE 에이전트 자동 개인화 — 유저 프로필 타입 정의
 *
 * 대화 패턴에서 자동으로 추출된 유저 특성을 저장하는 타입입니다.
 * Settings UI에서 수동 설정하는 것이 아니라, LLM이 대화 종료 시 자동 추출합니다.
 *
 * @packageDocumentation
 *
 * 🔄 변경이력:
 * - 2026-03-19: 초기 생성
 */

// ============================================
// 🎯 유저 프로필 타입
// ============================================

/**
 * 응답 스타일 선호도
 * - concise: 간결한 응답 선호
 * - balanced: 적당한 수준
 * - detailed: 상세한 설명 선호
 */
export type ResponseStyle = "concise" | "balanced" | "detailed";

/**
 * 기술 수준
 * - beginner: 초보자 — 기본 개념 설명 포함
 * - intermediate: 중급 — 핵심 위주 설명
 * - advanced: 고급 — 전문 용어, 깊은 분석
 */
export type TechLevel = "beginner" | "intermediate" | "advanced";

/**
 * 에이전트 톤
 * - formal: 격식체, 전문적
 * - casual: 비격식체, 친근
 */
export type AgentTone = "formal" | "casual";

/**
 * 관심 영역 (복수 선택 가능)
 */
export type FocusArea = "security" | "cost" | "performance" | "reliability" | "scalability";

/**
 * 🎯 부정 피드백 카테고리
 * 사용자가 👎 클릭 시 선택할 수 있는 불만족 이유 분류
 */
export type FeedbackCategory = "inaccurate" | "not-helpful" | "too-verbose" | "too-brief" | "other";

export const FEEDBACK_CATEGORIES: Record<FeedbackCategory, string> = {
  inaccurate: "Inaccurate",
  "not-helpful": "Not helpful",
  "too-verbose": "Too verbose",
  "too-brief": "Too brief",
  other: "Other",
};

/**
 * 피드백 기록
 */
export interface FeedbackEntry {
  /** 피드백 타임스탬프 (ISO 8601) */
  timestamp: string;
  /** 대화 threadId */
  threadId: string;
  /** 긍정/부정 */
  rating: "positive" | "negative";
  /** 🎯 부정 피드백 카테고리 */
  category?: FeedbackCategory;
  /** 부정 피드백 시 불만족 이유 (선택) */
  reason?: string;
  /** 🎯 추가 텍스트 의견 (선택) */
  detail?: string;
}

// ============================================
// 🎯 v3: 카테고리 기반 메모리 아이템
// ============================================

/**
 * 메모리 카테고리 — 프롬프트 강도 결정
 * - preference: 출력/스타일 선호 → Default (항상 적용, 부적절하면 skip)
 * - environment: 기술 스택/인프라 → When [topic] (관련 질문에서만)
 * - behavior: 행동 패턴 → For reference (참고만)
 *
 * feedback은 MemoryItem에 포함하지 않음 — feedbackHistory에서 별도 생성
 */
export type MemoryCategory = "preference" | "environment" | "behavior";

/**
 * 메모리 상태 — 승급(Promotion) 구조
 * - pending: 후보 상태, 프롬프트 미주입
 * - active: 승급됨, 프롬프트 주입
 * - archived: active에서 밀려남, 재추출 시 즉시 복귀
 */
export type MemoryStatus = "pending" | "active" | "archived";

/**
 * 카테고리별 승급 threshold
 * - environment: 1 (사실 정보, 즉시 active)
 * - preference: 2 (명시적 요청, 2회 확인)
 * - behavior: 3 (패턴, 3회 반복 확인)
 */
export const PROMOTION_THRESHOLD: Record<MemoryCategory, number> = {
  environment: 1,
  preference: 2,
  behavior: 3,
};

/**
 * 카테고리 기반 메모리 아이템
 *
 * 각 메모리는 fact(관찰된 사실) + category(분류) + action(AI 행동 지시)로 구성됩니다.
 * environment 카테고리는 topic 필드로 조건부 적용 범위를 지정합니다.
 *
 * @example
 * { fact: "EKS 3개 클러스터 운영", category: "environment", topic: "Kubernetes", action: "Tailor K8s answers to EKS-specific features" }
 * { fact: "YAML 형태 출력 선호", category: "preference", action: "Use YAML for code/config examples" }
 * { fact: "에러 핸들링 후속 질문 많음", category: "behavior", action: "Proactively cover edge cases" }
 */
export interface MemoryItem {
  /** 관찰된 사실 */
  fact: string;
  /** 카테고리 — 프롬프트 강도 결정 */
  category: MemoryCategory;
  /** AI에 대한 행동 지시 */
  action: string;
  /** 조건부 적용 토픽 — environment에서만 사용 */
  topic?: string;

  // === 승급 구조 (v4,) ===

  /** 내부 고유 ID — 매칭용 */
  id?: string;
  /** 상태: pending → active → archived */
  status?: MemoryStatus;
  /** 추출 횟수 (세션 단위) */
  count?: number;
  /** 최초 추출 시점 (ISO 8601) */
  firstSeenAt?: string;
  /** 최근 추출 시점 (ISO 8601) */
  lastSeenAt?: string;
  /** 승급 시점 (active일 때만, ISO 8601) */
  promotedAt?: string;
}

/** 메모리 ID 생성 */
export function generateMemoryId(): string {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 승급 구조 한도 */
export const PROMOTION_LIMITS = {
  MAX_ACTIVE: 10,
  MAX_PENDING: 40,
  PENDING_EXPIRE_DAYS: 60,
  ARCHIVED_EXPIRE_DAYS: 90,
} as const;

/**
 * 유저 프로필 — 자동 추출 데이터
 */
export interface UserProfile {
  /** 프로필 버전 (마이그레이션용) */
  version: 1;
  /** 마지막 업데이트 (ISO 8601) */
  lastUpdatedAt: string;
  /** 프로필이 기반한 총 대화 수 */
  totalConversations: number;

  // ============================================
  // 자동 추출 필드
  // ============================================

  /** 선호 언어 (예: "ko", "en") — 자동 감지 */
  /** @deprecated 수집 중단, 프롬프트에 미사용 */
  /** @deprecated */
  preferredLanguage?: string;
  /** 응답 스타일 선호도 */
  /** @deprecated 수집 중단, 프롬프트에 미사용 */
  /** @deprecated */
  responseStyle?: ResponseStyle;
  /** 추정 기술 수준 */
  /** @deprecated 수집 중단, 프롬프트에 미사용 */
  /** @deprecated */
  techLevel?: TechLevel;
  /** 에이전트 톤 선호도 */
  /** @deprecated 수집 중단, 프롬프트에 미사용 */
  /** @deprecated */
  agentTone?: AgentTone;
  /** @deprecated memories로 통합됨 — migration compat */
  /** @deprecated */
  focusAreas: FocusArea[];
  /** @deprecated memories로 통합됨 — migration compat */
  /** @deprecated */
  observations: string[];

  // ============================================
  // 자유 형식 메모리 (ChatGPT/Claude 방식)
  // ============================================

  /**
   * 대화에서 학습한 사용자 정보 — 카테고리 기반 메모리 아이템
   * v3: string[] → MemoryItem[] (category + action 포함)
   *
   * @example
   * [
   *   { fact: "EKS 3개 운영", category: "environment", topic: "Kubernetes", action: "EKS 특화 답변" },
   *   { fact: "YAML 선호", category: "preference", action: "코드/설정 예시에 YAML 사용" }
   * ]
   */
  memories: MemoryItem[];

  // ============================================
  // 유저 설정 필드 (UI에서 수동 설정)
  // ============================================

  /** 자동 학습 활성화 여부 (기본: true) */
  autoLearnEnabled: boolean;
  /** 언어 수동 오버라이드 (null이면 auto — 시스템 언어 기반) */
  languageOverride: string | null;
  /** Workspace Context 학습 활성화 여부 (기본: true) */
  workspaceLearningEnabled: boolean;

  /** 자동 승인 도구 규칙 — HITL 없이 자동 실행할 도구:명령 키 목록 (예: "getPods", "kubectl:get") */
  autoApprovalRules: string[];

  // ============================================
  // Workspace Context
  // ============================================

  /** K8s 작업 컨텍스트 — 행동 로깅 기반 수집 (글로벌, 하위 호환) */
  workspaceContext: WorkspaceContext;

  // ============================================
  // 피드백 데이터
  // ============================================

  /** 최근 피드백 기록 (최대 100개) */
  feedbackHistory: FeedbackEntry[];

  // ============================================
  // 안정성 트래킹 (streak 기반 업데이트)
  // ============================================
}

// ============================================
// 🎯 Workspace Context 타입
// ============================================

/**
 * 유저의 K8s 작업 컨텍스트 — 행동 로깅 기반 수집
 *
 * DevOps/SRE가 자주 접근하는 네임스페이스, 리소스 타입,
 * 반복되는 문제 패턴을 저장합니다.
 */
export interface WorkspaceContext {
  /** 자주 접근하는 네임스페이스 (상위 5개, 접근 빈도 기반) */
  frequentNamespaces: { name: string; accessCount: number }[];
  /** 자주 조회하는 리소스 타입 (pods, deployments, services 등) */
  frequentResourceTypes: string[];
  /** 최근 반복된 문제 시나리오 (최대 5개) — 단일 에러뿐 아니라 복합 인과관계 포함 */
  recurringIssues: {
    pattern: string;
    context?: string;
    relatedResources?: string[];
    lastSeen: string;
    count: number;
  }[];
}

/**
 * 기본 WorkspaceContext 값
 */
export const DEFAULT_WORKSPACE_CONTEXT: WorkspaceContext = {
  frequentNamespaces: [],
  frequentResourceTypes: [],
  recurringIssues: [],
};

/**
 * 클러스터별 워크스페이스 컨텍스트
 *
 * 클러스터 ID를 키로 하여 별도 JSON 파일에 저장됩니다.
 * {appDataPath}/ai-assistant/cluster-context/{clusterId-hash}.json
 */
export interface ClusterWorkspaceContext extends WorkspaceContext {
  /** 클러스터 고유 ID */
  clusterId: string;
  /** 클러스터 표시 이름 (선택) */
  clusterName?: string;
  /** 마지막 업데이트 */
  lastUpdatedAt: string;
}

/**
 * 기본 ClusterWorkspaceContext 생성
 */
export function createDefaultClusterContext(clusterId: string, clusterName?: string): ClusterWorkspaceContext {
  return {
    clusterId,
    clusterName,
    frequentNamespaces: [],
    frequentResourceTypes: [],
    recurringIssues: [],
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * WorkspaceContext 제한 상수
 */
export const WORKSPACE_LIMITS = {
  /** 자주 접근하는 네임스페이스 최대 개수 */
  MAX_FREQUENT_NAMESPACES: 5,
  /** 자주 조회하는 리소스 타입 최대 개수 */
  MAX_FREQUENT_RESOURCE_TYPES: 10,
  /** 반복 문제 패턴 최대 개수 */
  MAX_RECURRING_ISSUES: 5,
} as const;

/**
 * LLM 추출 결과 (대화 종료 시 반환되는 구조)
 */
export interface ProfileExtractionResult {
  /** 카테고리 기반 메모리 아이템 — fact + category + action */
  memories?: MemoryItem[];
  /** 기존 candidate 매칭 — id 기반 */
  matchedCandidates?: { newIndex: number; existingId: string }[];
  /** 사용자 명시적 부정 — 해당 memory 삭제 */
  removals?: { existingId: string; reason: string }[];
  /** K8s issue scenarios — workspaceContext.recurringIssues에 저장됨 */
  issueScenarios?: { pattern: string; context?: string; relatedResources?: string[]; matchedExistingIndex?: number }[];

  // === Migration compat (deprecated) ===
  /** @deprecated memories로 통합 */
  focusAreas?: FocusArea[];
  /** @deprecated memories로 통합 */
  observations?: string[];
}

/**
 * 기본 프로필 값
 */
export const DEFAULT_USER_PROFILE: UserProfile = {
  version: 1,
  lastUpdatedAt: new Date().toISOString(),
  totalConversations: 0,
  focusAreas: [],
  observations: [],
  memories: [],
  autoLearnEnabled: true,
  languageOverride: null,
  workspaceLearningEnabled: true,
  autoApprovalRules: [],
  workspaceContext: { ...DEFAULT_WORKSPACE_CONTEXT },
  feedbackHistory: [],
};

/**
 * 프로필 데이터 제한 상수
 */
export const PROFILE_LIMITS = {
  /** @deprecated memories로 통합 */
  MAX_OBSERVATIONS: 20,
  /** 자유 형식 메모리 최대 개수 */
  MAX_MEMORIES: 50,
  /** 피드백 기록 최대 개수 */
  MAX_FEEDBACK_HISTORY: 100,
  /** 추출에 사용할 최근 대화 수 */
  MAX_CONVERSATIONS_FOR_EXTRACTION: 50,
} as const;
