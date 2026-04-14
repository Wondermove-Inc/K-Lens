/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 대화 로그에서 유저 특성을 자동 추출하는 엔진
 *
 * 대화 종료 후 LLM을 호출하여 유저의 선호도, 기술 수준, 톤 등을 추출합니다.
 * 하위 tier 모델 사용을 권장합니다 (비용 절약).
 *
 * @packageDocumentation
 *
 * 🔄 변경이력:
 * - 2026-03-19: 초기 생성
 * - 2026-03-25: v3 추출 프롬프트 — MemoryItem 기반 (category + action + topic)
 */

import type { ThreadMessage } from "../../common/agent-ipc-channels";
import type { MemoryCategory, MemoryItem, ProfileExtractionResult, UserProfile } from "../../common/user-profile-types";
import type { MainLLMModel } from "../llm-model-factory";

// ============================================
// 🎯 추출 프롬프트 (v3 — actionable preferences with categories)
// ============================================

/**
 * 프로필 추출용 시스템 프롬프트 (v3)
 *
 * 대화 히스토리를 분석하여 카테고리별 행동 지시가 포함된 MemoryItem을 JSON으로 반환합니다.
 * 각 memory에 category(분류) + action(행동 지시) + topic(적용 조건)을 포함합니다.
 */
const EXTRACTION_SYSTEM_PROMPT = `You are a user behavior analyst for a Kubernetes management tool. Your job is to extract actionable user preferences from their conversation — not just facts, but HOW those facts should influence future AI responses.

Return a JSON object with these fields:

- memories: array of MemoryItem objects (max 10). Each item has:
  - fact: string — concise, self-contained observation about the user
  - category: one of "preference" | "environment" | "behavior"
  - action: string — specific instruction for the AI to follow based on this fact
  - topic: string (ONLY for "environment" category) — topic area for conditional application

CATEGORY DEFINITIONS:
- "preference": Output format, language, style choices. Applied ALWAYS by default.
  Examples: response format, code style, language preference, communication style
- "environment": Tech stack, infrastructure, tools. Applied only WHEN the topic matches.
  Examples: cloud provider, K8s distribution, CI/CD tooling, monitoring stack
- "behavior": Interaction patterns, tendencies. Applied as REFERENCE only.
  Examples: follow-up habits, question patterns, working style

TOPIC SPECIFICITY (for "environment" category only):
Use mid-level specificity for the topic field. Too broad causes over-application; too narrow causes missed matches.
- Too broad: "tech questions" (matches everything)
- Too narrow: "EKS 1.28 nodegroup scaling" (misses related questions)
- Good: "Kubernetes", "CI/CD", "monitoring", "networking"

GOOD EXAMPLES:
{
  "memories": [
    {
      "fact": "Operates 3 EKS clusters (prod/staging/dev) with ALB Ingress Controller and Karpenter",
      "category": "environment",
      "action": "EKS environment basis. Include ALB annotation (alb.ingress.kubernetes.io/*) for Ingress, Karpenter NodePool for node scaling, IRSA annotation (eks.amazonaws.com/role-arn) for ServiceAccount",
      "topic": "Kubernetes"
    },
    {
      "fact": "Prefers YAML output for configurations",
      "category": "preference",
      "action": "Provide config/code examples in YAML format only. No JSON. Helm values also in YAML"
    },
    {
      "fact": "Repeatedly requests concise answers",
      "category": "preference",
      "action": "Core answer only, 3 paragraphs max. Code without comments. Recommend only 1 option, no comparison tables"
    },
    {
      "fact": "Security-focused: requires hardened YAML output",
      "category": "preference",
      "action": "YAML must include securityContext (runAsNonRoot: true, readOnlyRootFilesystem: true). Include networkPolicy. Specify serviceAccountName, set automountServiceAccountToken: false"
    },
    {
      "fact": "Uses GitHub Actions with self-hosted runners on EKS",
      "category": "environment",
      "action": "CI/CD answers based on GitHub Actions workflows. Self-hosted runners run as EKS Pods. Include actions-runner-controller (ARC) setup",
      "topic": "CI/CD"
    },
    {
      "fact": "Tends to ask follow-up questions about error handling",
      "category": "behavior",
      "action": "Include error handling section: try/catch, exit code checks, rollback methods like kubectl rollout undo"
    }
  ]
}

BAD EXAMPLES (do NOT produce these):
- {"fact": "Asked about pods", ...} → too vague, no actionable insight
- {"fact": "AI explained pod lifecycle", ...} → about AI, not user
- {"fact": "Interested in reliability", ...} → inferred from AI explanation, not user behavior
- {"fact": "User speaks Korean", "category": "preference", "action": "Answer in Korean"} → Do NOT extract language from simple conversations. Only when user explicitly requests it (e.g., "답변은 한국어로 해줘")
- {"fact": "Uses EKS", "action": "Answer about EKS"} → action too generic, must be specific and actionable
- {"fact": "Prefers security", "action": "Include security considerations"} → action too abstract, must include specific field names/values (e.g., "securityContext with runAsNonRoot: true, readOnlyRootFilesystem: true")
- {"fact": "Wants concise answers", "action": "Keep it short"} → action too vague, must specify concrete constraints (e.g., "3 paragraphs max, no code comments, 1 recommendation only")

- matchedCandidates: array of objects if the new extraction matches an existing memory/candidate.
  Each has: newIndex (index in this response's memories array), existingId (the id of the existing item).
  Use this when the user repeats a preference or environment fact that already exists.
- removals: array of objects if the user explicitly denies or contradicts an existing memory.
  Each has: existingId (the id of the existing item), reason (why it should be removed).
  Example: user says "I don't use EKS anymore" → remove the EKS environment memory.
- issueScenarios: array of K8s issue objects (max 3) if a real problem was discussed. Each has:
  - pattern: string — concise description IN ENGLISH
  - context: string (optional) — where/when
  - relatedResources: string[] (optional) — K8s resources involved
  - matchedExistingIndex: number (optional) — 0-based index of existing issue if same issue

CRITICAL RULES:
- Analyze USER messages primarily. Assistant messages are context only — do NOT extract facts from what the AI said or explained.
- Only extract what the USER explicitly stated, asked about with clear intent, or demonstrated through repeated behavior.
- Do NOT infer interests from AI explanations. If AI explained "pod lifecycle", that does NOT mean the user is interested in "reliability".
- A single generic question like "explain" = do NOT extract. But if the user REPEATEDLY shows a pattern (e.g., always asks for detailed explanations, always requests YAML output), extract that as a behavioral preference.
- The "action" field must be a SPECIFIC, ACTIONABLE instruction — not a restatement of the fact.
- Include date in parentheses for time-relevant facts: "Migrating to EKS (2026-03)"
- Return ONLY valid JSON, no markdown or explanation.
- Be conservative for one-time events. But repeated patterns across the conversation ARE worth extracting.
- NEVER extract sensitive information: passwords, API keys, tokens, secrets, connection strings, private keys, certificates, or any credentials. If the user mentions sensitive data, extract only the CONTEXT (e.g., "Uses K8s secrets for DB credentials") but NEVER the actual values.
- NEVER extract from memory management conversations.
- For conversations with only 1-2 simple Q&A turns (e.g., "What is a Pod?" → answer → "Thanks"), do NOT extract language preference. Language preference should only be extracted when the user explicitly requests it (e.g., "Please answer in Korean from now on").
- For "behavior" category: only extract if the pattern was demonstrated at least 2-3 times within the conversation. A single occurrence is not a pattern.
- Single-turn conversations: only extract "preference" or "environment" from explicit user statements (direct requests like "Always include security settings"). Do NOT extract from inferred behavior in a single turn. If the user asks to delete, modify, view, or manage their profile/memories (e.g., "delete my EKS memory", "show my profile", "forget that I use GKE", "clear my preferences"), do NOT extract any new facts from that conversation. These are meta-actions about the memory system itself, not user behavior to remember.`;

// ============================================
// 유효한 카테고리 목록
// ============================================

const VALID_CATEGORIES: readonly MemoryCategory[] = ["preference", "environment", "behavior"];

// ============================================
// 🎯 ProfileExtractor
// ============================================

export interface ProfileExtractorOptions {
  /** 추출에 사용할 최대 메시지 수 */
  maxMessages?: number;
}

export class ProfileExtractor {
  private readonly maxMessages: number;

  constructor(options?: ProfileExtractorOptions) {
    this.maxMessages = options?.maxMessages ?? 30;
  }

  /**
   * 🎯 대화 메시지에서 유저 프로필 추출
   *
   * @param messages - 대화 히스토리
   * @param model - LLM 모델 (하위 tier 권장)
   * @param existingProfile - 기존 프로필 (컨텍스트 제공용)
   * @returns 추출된 프로필 결과 (부분적일 수 있음)
   */
  async extract(
    messages: ThreadMessage[],
    model: MainLLMModel,
    existingProfile?: Readonly<UserProfile>,
  ): Promise<ProfileExtractionResult | null> {
    // 유저 메시지가 최소 2개 이상이어야 추출 의미가 있음
    const userMessages = messages.filter((m) => m.role === "user");

    if (userMessages.length < 1) {
      return null;
    }

    // 최근 메시지만 사용 (토큰 절약)
    const recentMessages = messages.slice(-this.maxMessages);

    // 🎯 메모리 관리 대화 필터링: profile 도구 호출이 포함된 턴 제외
    const profileToolNames = ["read_user_profile", "edit_user_profile", "read_config", "edit_config", "reset_config"];
    const filteredMessages = this.filterProfileManagementTurns(recentMessages, profileToolNames);

    // user 메시지는 전체, assistant 메시지는 요약만 (user intent 중심)
    const conversationSummary = filteredMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => {
        if (m.role === "user") {
          return `[USER]: ${this.truncateContent(m.content, 500)}`;
        }
        // assistant 메시지는 짧게 — AI 출력에서 사용자 관심사를 추론하지 않도록
        return `[ASSISTANT]: ${this.truncateContent(m.content, 150)}`;
      })
      .join("\n");

    // 기존 프로필 컨텍스트 (있으면) — v3 MemoryItem 형식
    const existingContext = this.buildExistingContext(existingProfile);

    // 🎯 기존 recurringIssues 목록 — LLM 기반 퍼지 매칭용
    const existingIssues = existingProfile?.workspaceContext?.recurringIssues;
    const issuesContext =
      existingIssues && existingIssues.length > 0
        ? `\n\nExisting recurring issues (use matchedExistingIndex if the new issue is the same):
${existingIssues.map((issue, i) => `[${i}] "${issue.pattern}" (count: ${issue.count})`).join("\n")}`
        : "";

    const userPrompt = `Conversation history:
${conversationSummary}
${existingContext}${issuesContext}

Extract user characteristics as JSON:`;

    try {
      const response = await model.invoke([
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);

      const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

      return this.parseExtractionResponse(content);
    } catch (error) {
      console.error("[ProfileExtractor] 추출 실패:", error);

      return null;
    }
  }

  /**
   * 🎯 기존 프로필 컨텍스트 구성 (v3 MemoryItem 호환)
   *
   * 기존 memories를 카테고리 + action 포함 형태로 표시하여
   * LLM이 중복 추출하지 않고, 업데이트 시 카테고리를 보존할 수 있게 합니다.
   */
  private buildExistingContext(existingProfile?: Readonly<UserProfile>): string {
    if (!existingProfile || existingProfile.totalConversations === 0) {
      return "";
    }

    const memories = existingProfile.memories ?? [];
    if (memories.length === 0) {
      return "";
    }

    const memoryLines = memories
      .map((m: MemoryItem | string, i: number) => {
        if (typeof m === "string") {
          return `[id:legacy-${i}] (behavior) ${m}`;
        }
        const idTag = m.id ? `id:${m.id}` : `idx:${i}`;
        const statusTag = m.status ?? "active";
        const topicSuffix = m.topic ? ` [topic: ${m.topic}]` : "";
        const countInfo = m.count ? ` (count:${m.count})` : "";
        return `[${idTag}] (${statusTag}, ${m.category}) ${m.fact} → ${m.action}${topicSuffix}${countInfo}`;
      })
      .join("\n");

    return `\n\nExisting memories and candidates (from ${existingProfile.totalConversations} previous conversations):
${memoryLines}

Rules for existing memories:
- Do NOT duplicate existing memories. Only add genuinely NEW facts.
- If the new extraction matches an existing item, return it in matchedCandidates with the existingId (the id: value shown above).
- If user explicitly denied or contradicted an existing item, return it in removals with the existingId and reason.
- If a new fact updates an existing one, include it in matchedCandidates so its count increases.
- If nothing new was learned, return an empty memories array.
- Preserve the category classification of existing memories when updating them.`;
  }

  /**
   * 🎯 LLM 응답 파싱
   */
  private parseExtractionResponse(content: string): ProfileExtractionResult | null {
    try {
      // JSON 블록 추출 (마크다운 코드블록 포함 처리)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);

      if (!jsonMatch) {
        console.warn("[ProfileExtractor] JSON 파싱 실패 — 응답:", content.slice(0, 200));

        return null;
      }

      const parsed = JSON.parse(jsonMatch[1].trim());

      // 유효성 검증
      return this.validateResult(parsed);
    } catch (error) {
      console.warn("[ProfileExtractor] 응답 파싱 실패:", error);

      return null;
    }
  }

  /**
   * 🎯 추출 결과 유효성 검증 (v3 — MemoryItem 지원)
   */
  private validateResult(raw: Record<string, unknown>): ProfileExtractionResult {
    const result: ProfileExtractionResult = {};

    // v3: MemoryItem[] 파싱 (string 하위 호환 포함)
    if (Array.isArray(raw.memories)) {
      result.memories = raw.memories
        .map((m: unknown) => this.validateMemoryItem(m))
        .filter((m): m is MemoryItem => m !== null)
        .slice(0, 10);
    }

    // Migration compat: focusAreas -> memories 변환
    if ((!result.memories || result.memories.length === 0) && Array.isArray(raw.focusAreas)) {
      const validAreas = ["security", "cost", "performance", "reliability", "scalability"];
      const areas = raw.focusAreas.filter((a: unknown) => typeof a === "string" && validAreas.includes(a)) as string[];
      if (areas.length > 0) {
        result.memories = areas.map((a: string) => ({
          fact: `Priority area: ${a}`,
          category: "behavior" as MemoryCategory,
          action: `Prioritize ${a} considerations in recommendations`,
        }));
      }
    }

    // v4: matchedCandidates 파싱
    if (Array.isArray(raw.matchedCandidates)) {
      result.matchedCandidates = raw.matchedCandidates
        .filter((mc: unknown) => typeof mc === "object" && mc !== null && typeof (mc as any).existingId === "string")
        .map((mc: any) => ({
          newIndex: typeof mc.newIndex === "number" ? mc.newIndex : 0,
          existingId: String(mc.existingId),
        }));
    }

    // v4: removals 파싱
    if (Array.isArray(raw.removals)) {
      result.removals = raw.removals
        .filter((r: unknown) => typeof r === "object" && r !== null && typeof (r as any).existingId === "string")
        .map((r: any) => ({
          existingId: String(r.existingId),
          reason: typeof r.reason === "string" ? r.reason : "user denied",
        }));
    }

    // K8s issue scenario extraction (complex root-cause chains)
    if (Array.isArray(raw.issueScenarios)) {
      result.issueScenarios = raw.issueScenarios
        .filter((s: unknown) => typeof s === "object" && s !== null && typeof (s as any).pattern === "string")
        .slice(0, 3)
        .map((s: any) => ({
          pattern: String(s.pattern),
          context: typeof s.context === "string" ? s.context : undefined,
          relatedResources: Array.isArray(s.relatedResources)
            ? s.relatedResources.filter((r: unknown) => typeof r === "string").slice(0, 5)
            : undefined,
          matchedExistingIndex: typeof s.matchedExistingIndex === "number" ? s.matchedExistingIndex : undefined,
        }));
    }
    // Backward compat: also accept flat errorPatterns strings
    if (!result.issueScenarios && Array.isArray(raw.errorPatterns)) {
      result.issueScenarios = raw.errorPatterns
        .filter((p: unknown) => typeof p === "string")
        .slice(0, 3)
        .map((p: any) => ({ pattern: String(p) }));
    }

    return result;
  }

  /**
   * 🎯 단일 MemoryItem 유효성 검증
   *
   * MemoryItem 객체 또는 string(하위 호환)을 받아 유효한 MemoryItem을 반환합니다.
   * - string → {fact, category: "behavior", action: ""} 로 변환 (하위 호환)
   * - 잘못된 category → "behavior"로 fallback
   * - topic은 environment에서만 유지, 나머지 카테고리에서는 제거
   */
  private validateMemoryItem(raw: unknown): MemoryItem | null {
    // 하위 호환: string → MemoryItem 변환
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length === 0) return null;
      return {
        fact: trimmed,
        category: "behavior",
        action: "",
      };
    }

    if (typeof raw !== "object" || raw === null) return null;

    const item = raw as Record<string, unknown>;

    // fact는 필수
    if (typeof item.fact !== "string" || item.fact.trim().length === 0) return null;

    // category 검증 — 유효하지 않으면 behavior로 fallback
    const category: MemoryCategory =
      typeof item.category === "string" && VALID_CATEGORIES.includes(item.category as MemoryCategory)
        ? (item.category as MemoryCategory)
        : "behavior";

    // action — 없으면 빈 문자열
    const action = typeof item.action === "string" ? item.action.trim() : "";

    // topic — environment에서만 유지
    const topic =
      category === "environment" && typeof item.topic === "string" && item.topic.trim().length > 0
        ? item.topic.trim()
        : undefined;

    return {
      fact: item.fact.trim(),
      category,
      action,
      ...(topic ? { topic } : {}),
    };
  }

  /**
   * 🎯 메모리 관리 대화 턴 필터링
   *
   * profile/config 도구 호출이 포함된 assistant 턴과,
   * 해당 턴 직전의 user 메시지를 제외합니다.
   * "프로필 보여줘" → [tool: read_user_profile] → 응답 — 이 전체가 제외됨.
   */
  private filterProfileManagementTurns(messages: ThreadMessage[], toolNames: string[]): ThreadMessage[] {
    // assistant 메시지 중 profile 도구 호출이 포함된 인덱스 찾기
    const excludeIndices = new Set<number>();

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === "assistant" && m.content) {
        // tool_call 패턴 감지: 도구 이름이 content에 포함되어 있는지
        const hasProfileTool = toolNames.some((name) => m.content.includes(name));
        if (hasProfileTool) {
          excludeIndices.add(i); // assistant 턴 제외
          // 직전 user 메시지도 제외 (메모리 관리 요청이므로)
          if (i > 0 && messages[i - 1].role === "user") {
            excludeIndices.add(i - 1);
          }
        }
      }
    }

    if (excludeIndices.size === 0) return messages;

    return messages.filter((_, idx) => !excludeIndices.has(idx));
  }

  /**
   * 🎯 컨텐츠 길이 제한
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    return `${content.slice(0, maxLength)}...`;
  }
}
