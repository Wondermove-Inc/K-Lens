/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 유저 개인화 프롬프트 생성 (v3)
 *
 * v3: 카테고리 기반 차등 강도 시스템
 *   - Mandatory: feedback (사용자 명시적 요청) → 강제 적용
 *   - Default: preference (출력/스타일) → 기본 적용, 부적절하면 skip
 *   - When [topic]: environment (기술 스택/인프라) → 관련 질문에서만
 *   - For reference: behavior (행동 패턴) → 참고만
 *
 * 프롬프트 구조: <user_context> XML + 마크다운 헤딩 하이브리드
 * 위치: system prompt 맨 끝 (recency bias 최대화)
 * 토큰 상한: ~250
 *
 * @packageDocumentation
 *
 * 🔄 변경이력:
 * - 2026-03-19: 초기 생성
 * - 2026-03-23: — clusterContext 우선 사용
 * - 2026-03-24: v2 — 확정성 기준 4블록
 * - 2026-03-25: v3 — 카테고리 기반 차등 강도 (BenchPreS 논문 기반)
 */

import type {
  ClusterWorkspaceContext,
  FeedbackEntry,
  MemoryItem,
  UserProfile,
  WorkspaceContext,
} from "../../user-profile-types";

// ============================================
// 🎯 상수
// ============================================

/** 최소 접근 횟수 threshold */
const MIN_NAMESPACE_ACCESS_COUNT = 2;
const MIN_RECURRING_ISSUE_COUNT = 2;

/** memories 프롬프트 주입 상한 */
const MAX_MEMORIES_IN_PROMPT = 10;

/** 카테고리 우선순위: preference > environment > behavior */
const CATEGORY_PRIORITY: Record<string, number> = {
  preference: 0,
  environment: 1,
  behavior: 2,
};

/**
 * memories를 중요도 기반으로 정렬
 * 1. 카테고리 우선순위 (preference > environment > behavior)
 * 2. action이 있는 것 우선
 * 3. 원래 순서 유지 (stable sort)
 */
function sortMemoriesByPriority(memories: MemoryItem[]): MemoryItem[] {
  return [...memories].sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.category] ?? 2;
    const pb = CATEGORY_PRIORITY[b.category] ?? 2;
    if (pa !== pb) return pa - pb;
    // action이 있는 것을 우선
    const hasA = a.action ? 0 : 1;
    const hasB = b.action ? 0 : 1;
    return hasA - hasB;
  });
}

/** Feedback decay 기준 (일) */
const FEEDBACK_MUST_DAYS = 30;
const FEEDBACK_SOFT_DAYS = 90;

/** 프롬프트 끝에 배치할 리마인더 */
export const PERSONALIZATION_REMINDER =
  "Remember: Apply Mandatory rules strictly, Default guidelines by default, topic-specific context only when relevant, and reference notes as supplementary information.";

// ============================================
// 🎯 시간 계산 유틸리티
// ============================================

function getDaysDiff(isoDate: string): number {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  return Number.isNaN(diff) ? 999 : diff;
}

function getRelativeTimeLabel(isoDate: string): string {
  const diffDays = getDaysDiff(isoDate);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// ============================================
// 🎯 메인 빌드 함수
// ============================================

/**
 * 유저 프로필에서 개인화 프롬프트 생성 (v3)
 *
 * 구조:
 *   <workspace_data>...</workspace_data>   ← 자동 수집, 항상 정확
 *   <user_context>
 *     ### Mandatory: ...                   ← feedback (강제)
 *     ### Default: ...                     ← preference (기본 적용)
 *     ### When discussing [topic]: ...     ← environment (조건부)
 *     ### For reference: ...               ← behavior (참고)
 *   </user_context>
 *
 * 리마인더는 PERSONALIZATION_REMINDER 상수로 별도 반환 → 호출측에서 프롬프트 맨 끝에 배치
 */
export function buildPersonalizationPrompt(
  profile: Readonly<UserProfile>,
  clusterContext?: Readonly<ClusterWorkspaceContext>,
): string {
  if (profile.totalConversations === 0) {
    return "";
  }

  // memories를 중요도 기반으로 정렬 (preference > environment > behavior)
  const sortedMemories = sortMemoriesByPriority(
    (profile.memories ?? []).filter(
      (m): m is MemoryItem => typeof m === "object" && m !== null && m.status === "active",
    ) as MemoryItem[],
  );
  const profileWithSortedMemories: Readonly<UserProfile> = { ...profile, memories: sortedMemories };

  const topBlocks: string[] = [];
  const contextSections: string[] = [];

  // ━━━ <workspace_data>: 자동 수집, 항상 정확 ━━━
  const wsBlock = buildWorkspaceDataBlock(clusterContext ?? profile.workspaceContext);
  if (wsBlock) topBlocks.push(wsBlock);

  // ━━━ Mandatory: feedback (강제 적용) ━━━
  const mandatorySection = buildMandatorySection(profileWithSortedMemories);
  if (mandatorySection) contextSections.push(mandatorySection);

  // ━━━ Default: preference (기본 적용) ━━━
  const defaultSection = buildDefaultSection(profileWithSortedMemories);
  if (defaultSection) contextSections.push(defaultSection);

  // ━━━ When [topic]: environment (조건부) ━━━
  const topicSections = buildTopicSections(profileWithSortedMemories);
  contextSections.push(...topicSections);

  // ━━━ For reference: behavior (참고) ━━━
  const referenceSection = buildReferenceSection(profileWithSortedMemories);
  if (referenceSection) contextSections.push(referenceSection);

  if (topBlocks.length === 0 && contextSections.length === 0) return "";

  const parts: string[] = [];

  // workspace_data 블록 (별도)
  if (topBlocks.length > 0) {
    parts.push(...topBlocks);
  }

  // user_context 블록
  if (contextSections.length > 0) {
    parts.push("<user_context>");
    parts.push(contextSections.join("\n\n"));
    parts.push("</user_context>");
  }

  return parts.join("\n");
}

/**
 * MD 기반 개인화 프롬프트 생성 (v3)
 * MD 파일의 memories를 파싱하여 카테고리별 분류
 */
export function buildPersonalizationPromptFromMd(
  mdContent: string | null,
  profile: Readonly<UserProfile>,
  clusterContext?: Readonly<ClusterWorkspaceContext>,
): string {
  // MD 본문이 있어도 profile.memories에 MemoryItem[]이 있으면 그걸 사용
  // MD는 사용자 표시용, 프롬프트는 구조화된 데이터 기반
  return buildPersonalizationPrompt(profile, clusterContext);
}

// ============================================
// 🎯 섹션 빌더
// ============================================

/**
 * <workspace_data> 블록: 자동 수집된 작업 컨텍스트
 */
function buildWorkspaceDataBlock(wsCtx: WorkspaceContext | ClusterWorkspaceContext | undefined): string {
  if (!wsCtx) return "";

  const lines: string[] = [];

  const significantNamespaces = (wsCtx.frequentNamespaces ?? [])
    .filter((ns) => ns.accessCount >= MIN_NAMESPACE_ACCESS_COUNT)
    .slice(0, 5);

  if (significantNamespaces.length > 0) {
    const nsEntries = significantNamespaces.map((ns) => `${ns.name} (${ns.accessCount}x)`).join(", ");
    lines.push(`Frequently used namespaces: ${nsEntries}`);
  }

  if (wsCtx.frequentResourceTypes && wsCtx.frequentResourceTypes.length > 0) {
    lines.push(`Most accessed resource types: ${wsCtx.frequentResourceTypes.join(", ")}`);
  }

  // Recurring issues (temporal)
  const significantIssues = (wsCtx.recurringIssues ?? [])
    .filter((issue) => issue.count >= MIN_RECURRING_ISSUE_COUNT)
    .slice(0, 3);

  if (significantIssues.length > 0) {
    for (const issue of significantIssues) {
      const ago = getRelativeTimeLabel(issue.lastSeen);
      let desc = `Recent issue: ${issue.pattern} (${issue.count}x, last: ${ago})`;
      if (issue.context) desc += ` [${issue.context}]`;
      lines.push(desc);
    }
  }

  if (lines.length === 0) return "";

  return ["<workspace_data>", ...lines, "</workspace_data>"].join("\n");
}

/**
 * ### Mandatory: feedback 기반 강제 규칙
 * feedbackHistory에서만 생성 (LLM 추출 아님)
 */
function buildMandatorySection(profile: Readonly<UserProfile>): string {
  const ACTIONABLE_CATEGORIES = new Set(["too-verbose", "too-brief"]);

  const categoryDescriptions: Record<string, string> = {
    "too-verbose":
      "Keep answers concise and actionable — 3 paragraphs max, code without comments, recommend only 1 option",
    "too-brief": "Include step-by-step explanations, add comments to code, explain background reasoning",
  };

  const actionableFeedback = profile.feedbackHistory.filter(
    (f: FeedbackEntry) => f.rating === "negative" && f.category && ACTIONABLE_CATEGORIES.has(f.category),
  );

  const recentFeedback: FeedbackEntry[] = [];
  const olderFeedback: FeedbackEntry[] = [];

  for (const f of actionableFeedback) {
    const days = getDaysDiff(f.timestamp);
    if (days <= FEEDBACK_MUST_DAYS) {
      recentFeedback.push(f);
    } else if (days <= FEEDBACK_SOFT_DAYS) {
      olderFeedback.push(f);
    }
  }

  const lines: string[] = [];

  // 최근 피드백 (강제)
  if (recentFeedback.length > 0) {
    const categoryCounts: Record<string, number> = {};
    for (const f of recentFeedback) {
      categoryCounts[f.category!] = (categoryCounts[f.category!] ?? 0) + 1;
    }
    for (const [cat, count] of Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)) {
      lines.push(`- **${categoryDescriptions[cat] ?? cat}** — User explicitly requested (${count}x)`);
    }
  }

  // 오래된 피드백 (약화)
  if (olderFeedback.length > 0) {
    const categoryCounts: Record<string, number> = {};
    for (const f of olderFeedback) {
      categoryCounts[f.category!] = (categoryCounts[f.category!] ?? 0) + 1;
    }
    for (const [cat, count] of Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)) {
      lines.push(`- ${categoryDescriptions[cat] ?? cat} (${count}x, previously reported)`);
    }
  }

  // detail이 있는 최근 피드백
  const withDetails = profile.feedbackHistory
    .filter((f: FeedbackEntry) => f.rating === "negative" && f.detail && getDaysDiff(f.timestamp) <= FEEDBACK_SOFT_DAYS)
    .slice(-3);

  if (withDetails.length > 0) {
    lines.push(...withDetails.map((f: FeedbackEntry) => `- "${f.detail}"`));
  }

  if (lines.length === 0) return "";

  return ["### Mandatory (user explicitly requested):", ...lines].join("\n");
}

/**
 * ### Default: preference 카테고리 (항상 적용, 부적절하면 skip)
 */
function buildDefaultSection(profile: Readonly<UserProfile>): string {
  const preferences = (profile.memories ?? [])
    .filter((m: MemoryItem) => typeof m === "object" && m.category === "preference")
    .slice(0, MAX_MEMORIES_IN_PROMPT);

  if (preferences.length === 0) return "";

  const lines = preferences.map((m: MemoryItem) => (m.action ? `- **${m.action}**` : `- **${m.fact}**`));

  return ["### Default (apply unless inappropriate):", ...lines].join("\n");
}

/**
 * ### When discussing [topic]: environment 카테고리 (조건부)
 * topic별로 그룹핑하여 별도 섹션 생성
 */
function buildTopicSections(profile: Readonly<UserProfile>): string[] {
  const environments = (profile.memories ?? [])
    .filter((m: MemoryItem) => typeof m === "object" && m.category === "environment")
    .slice(0, MAX_MEMORIES_IN_PROMPT);

  if (environments.length === 0) return [];

  // topic별 그룹핑
  const groups = new Map<string, MemoryItem[]>();
  for (const m of environments) {
    const topic = m.topic ?? "General";
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic)!.push(m);
  }

  const sections: string[] = [];
  for (const [topic, items] of groups) {
    const lines = items.map((m: MemoryItem) => (m.action ? `- ${m.action}` : `- ${m.fact}`));
    sections.push([`### When discussing ${topic}:`, ...lines].join("\n"));
  }

  return sections;
}

/**
 * ### For reference: behavior 카테고리 (참고만)
 */
function buildReferenceSection(profile: Readonly<UserProfile>): string {
  const behaviors = (profile.memories ?? [])
    .filter((m: MemoryItem) => typeof m === "object" && m.category === "behavior")
    .slice(0, MAX_MEMORIES_IN_PROMPT);

  if (behaviors.length === 0) return "";

  const lines = behaviors.map((m: MemoryItem) => (m.action ? `- ${m.action}` : `- ${m.fact}`));

  return ["### For reference:", ...lines].join("\n");
}
