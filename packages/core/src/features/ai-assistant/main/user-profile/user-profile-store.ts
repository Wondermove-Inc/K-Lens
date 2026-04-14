import { BrowserWindow } from "electron";
/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 유저 프로필 JSON 파일 기반 저장소
 *
 * {appDataPath}/ai-assistant/user-profile.json에 프로필 데이터를 저장/로드합니다.
 * ConversationLogger와 동일한 디렉토리 구조를 사용합니다.
 *
 * @packageDocumentation
 *
 * 🔄 변경이력:
 * - 2026-03-19: 초기 생성
 * - 2026-03-19: 동기 fs → fs.promises 비동기 전환, lazy init 패턴 적용
 */

import fs from "fs/promises";
import path from "path";
import {
  type ClusterWorkspaceContext,
  createDefaultClusterContext,
  DEFAULT_USER_PROFILE,
  DEFAULT_WORKSPACE_CONTEXT,
  type FeedbackEntry,
  generateMemoryId,
  type MemoryItem,
  type MemoryStatus,
  PROFILE_LIMITS,
  PROMOTION_LIMITS,
  PROMOTION_THRESHOLD,
  type ProfileExtractionResult,
  type UserProfile,
  WORKSPACE_LIMITS,
} from "../../common/user-profile-types";

// ============================================
// 🎯 UserProfileStore
// ============================================

export interface UserProfileStoreOptions {
  /** 앱 데이터 디렉토리 경로 */
  appDataPath: string;
}

export class UserProfileStore {
  private readonly profileMdPath: string;
  private readonly metaPath: string;
  private readonly clusterContextDir: string;
  private profile: UserProfile;
  private initPromise: Promise<void> | null = null;
  /** 클러스터별 컨텍스트 캐시 */
  private clusterContextCache: Map<string, ClusterWorkspaceContext> = new Map();

  constructor(options: UserProfileStoreOptions) {
    this.profileMdPath = path.join(options.appDataPath, "ai-assistant", "user-profile.md");
    this.metaPath = path.join(options.appDataPath, "ai-assistant", "user-profile.meta.json");
    this.clusterContextDir = path.join(options.appDataPath, "ai-assistant", "cluster-context");
    this.profile = { ...DEFAULT_USER_PROFILE };
  }

  /**
   * 🎯 Lazy 초기화 — 첫 접근 시 자동 호출
   * 여러 번 호출해도 한 번만 실행됩니다.
   */
  private ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.loadFromFile();
    }

    return this.initPromise;
  }

  /**
   * 🎯 파일에서 프로필 로드 (비동기)
   */
  private async loadFromFile(): Promise<void> {
    try {
      const dir = path.dirname(this.profileMdPath);
      await fs.mkdir(dir, { recursive: true });

      // 🎯 마이그레이션: 기존 user-profile.json이 있으면 MD + meta로 변환
      const legacyPath = this.profileMdPath.replace("user-profile.md", "user-profile.json");
      try {
        const legacyContent = await fs.readFile(legacyPath, "utf-8");
        const legacyProfile = JSON.parse(legacyContent) as UserProfile;
        if (legacyProfile.version === 1) {
          this.profile = legacyProfile;
          // 새 형식으로 저장 후 레거시 삭제
          await this.saveAll();
          await fs.unlink(legacyPath).catch(() => {});
          console.info("[UserProfileStore] 레거시 JSON → MD + meta.json 마이그레이션 완료");
          return;
        }
      } catch {
        // 레거시 파일 없으면 무시
      }

      // meta.json 로드 (내부 데이터: streak, count, timestamp 등)
      try {
        const metaContent = await fs.readFile(this.metaPath, "utf-8");
        const loaded = JSON.parse(metaContent) as UserProfile;
        if (loaded.version === 1) {
          this.profile = loaded;
        }
      } catch (error: any) {
        if (error?.code !== "ENOENT") {
          console.warn("[UserProfileStore] meta.json 로드 실패:", error);
        }
      }

      // MD 파일에서 사용자 편집 내용 반영 (AI/사용자가 MD를 직접 수정한 경우)
      try {
        const mdContent = await fs.readFile(this.profileMdPath, "utf-8");
        this.applyMdOverrides(mdContent);
      } catch (error: any) {
        if (error?.code !== "ENOENT") {
          console.warn("[UserProfileStore] MD 로드 실패:", error);
        }
      }

      // 🎯 기존 MemoryItem 마이그레이션: id/status/count 없는 항목에 기본값 부여
      let needsSave = false;
      for (const mem of this.profile.memories ?? []) {
        if (typeof mem !== "string") {
          if (!mem.id) {
            mem.id = generateMemoryId();
            needsSave = true;
          }
          if (!mem.status) {
            mem.status = "active";
            needsSave = true;
          }
          if (mem.count == null) {
            mem.count = PROMOTION_THRESHOLD[mem.category] ?? 2;
            needsSave = true;
          }
          if (!mem.firstSeenAt) {
            mem.firstSeenAt = this.profile.lastUpdatedAt;
            needsSave = true;
          }
          if (!mem.lastSeenAt) {
            mem.lastSeenAt = this.profile.lastUpdatedAt;
            needsSave = true;
          }
        }
      }
      if (needsSave) {
        console.info("[UserProfileStore] 기존 memories 마이그레이션 완료 (id/status/count 추가)");
        await this.saveAll();
      }
    } catch (error: any) {
      console.warn("[UserProfileStore] 프로필 로드 실패, 기본값 사용:", error);
    }
  }

  /**
   * 🎯 MD 파일 내용에서 사용자 편집을 감지하여 프로필에 반영
   * MD가 source of truth인 필드: observations, focusAreas
   */
  private applyMdOverrides(mdContent: string): void {
    // Memories 파싱 (source of truth) — v3: MemoryItem[] 형식
    const memMatch = mdContent.match(/## Memories\n([\s\S]*?)(?=\n## |$)/);
    if (memMatch) {
      const memLines = memMatch[1]
        .split("\n")
        .map((line) => line.replace(/^- /, "").trim())
        .filter((line) => line.length > 0);
      if (memLines.length > 0) {
        // v3 형식: [category] fact → action 또는 [category:topic] fact → action
        const parsed = memLines.map((line) => this.parseMemoryLine(line));
        this.profile.memories = parsed;
      }
    }

    // Legacy: Focus Areas → memories migration (v3: MemoryItem[])
    if (!this.profile.memories || this.profile.memories.length === 0) {
      const focusMatch = mdContent.match(/## Focus Areas\n([\s\S]*?)(?=\n## |$)/);
      if (focusMatch) {
        const areas = focusMatch[1]
          .split("\n")
          .map((line) => line.replace(/^- /, "").trim())
          .filter((line) => line.length > 0);
        if (areas.length > 0) {
          this.profile.memories = areas.map((a) => ({ fact: a, category: "behavior" as const, action: "" }));
        }
      }
    }
  }

  /**
   * 🎯 현재 프로필 반환
   *
   * 동기 반환 — 초기화 전에도 기본값을 반환합니다.
   * 정확한 데이터가 필요하면 getProfileAsync()를 사용하세요.
   */
  getProfile(): Readonly<UserProfile> {
    return this.profile;
  }

  /**
   * 🎯 초기화 완료 후 프로필 반환 (비동기)
   */
  async getProfileAsync(): Promise<Readonly<UserProfile>> {
    await this.ensureInitialized();

    return this.profile;
  }

  /**
   * 🎯 LLM 추출 결과를 기존 프로필에 병합
   *
   * 병합 전략:
   * - 새 값이 있으면 덮어쓰기 (최신 우선)
   * - observations는 기존 + 신규 합산 (상한 적용)
   * - totalConversations 증가
   */
  async mergeExtractionResult(result: ProfileExtractionResult, startedAt?: number): Promise<void> {
    await this.ensureInitialized();

    // 🎯 race condition 방지: 리셋 이전에 시작된 추출이면 무시
    if (startedAt && startedAt < this.resetEpoch) {
      console.log("[UserProfileStore] 리셋 이후 추출 결과 무시 (stale extraction)");
      return;
    }

    // v4: 승급 구조 기반 병합
    this.mergeWithPromotion(result);

    // Migration compat: focusAreas/observations → memories
    if (result.focusAreas && result.focusAreas.length > 0) {
      this.profile.focusAreas = result.focusAreas;
    }
    if (result.observations && result.observations.length > 0) {
      const newObs = result.observations.filter(
        (obs) => !this.profile.observations.some((existing) => this.isObservationSimilar(existing, obs)),
      );
      if (newObs.length > 0) {
        const merged = [...this.profile.observations, ...newObs];
        this.profile.observations = merged.slice(-PROFILE_LIMITS.MAX_OBSERVATIONS);
      }
    }

    this.profile.totalConversations += 1;
    this.profile.lastUpdatedAt = new Date().toISOString();

    this.scheduleSave();
  }

  /**
   * 🎯 피드백 기록 추가
   */
  async addFeedback(entry: FeedbackEntry): Promise<void> {
    await this.ensureInitialized();

    this.profile.feedbackHistory.push(entry);

    // 상한 적용
    if (this.profile.feedbackHistory.length > PROFILE_LIMITS.MAX_FEEDBACK_HISTORY) {
      this.profile.feedbackHistory = this.profile.feedbackHistory.slice(-PROFILE_LIMITS.MAX_FEEDBACK_HISTORY);
    }

    this.profile.lastUpdatedAt = new Date().toISOString();
    this.scheduleSave();
  }

  /**
   * 🎯 자동 학습 활성화/비활성화
   */
  async setAutoLearnEnabled(enabled: boolean): Promise<void> {
    await this.ensureInitialized();

    this.profile.autoLearnEnabled = enabled;
    this.profile.lastUpdatedAt = new Date().toISOString();

    await this.save();
  }

  /**
   * 🎯 언어 수동 오버라이드 설정
   * @param language null이면 auto (시스템 언어 기반)
   */
  async setLanguageOverride(language: string | null): Promise<void> {
    await this.ensureInitialized();

    this.profile.languageOverride = language;
    this.profile.lastUpdatedAt = new Date().toISOString();

    await this.save();
  }

  /**
   * 🎯 자동 학습이 활성화되어 있는지 확인
   */
  async isAutoLearnEnabled(): Promise<boolean> {
    await this.ensureInitialized();

    return this.profile.autoLearnEnabled ?? true;
  }

  /**
   * 🎯 Workspace Context 학습 활성화/비활성화
   */
  async setWorkspaceLearningEnabled(enabled: boolean): Promise<void> {
    await this.ensureInitialized();

    this.profile.workspaceLearningEnabled = enabled;
    this.profile.lastUpdatedAt = new Date().toISOString();

    await this.save();
  }

  /**
   * 🎯 Workspace Context 학습이 활성화되어 있는지 확인
   */
  async isWorkspaceLearningEnabled(): Promise<boolean> {
    await this.ensureInitialized();

    return this.profile.workspaceLearningEnabled ?? true;
  }

  /**
   * 🎯 자동 승인 도구 규칙 설정
   */
  async setAutoApprovalRules(rules: string[]): Promise<void> {
    await this.ensureInitialized();

    this.profile.autoApprovalRules = rules;
    this.profile.lastUpdatedAt = new Date().toISOString();

    await this.save();
  }

  /**
   * 🎯 자동 승인 도구 규칙 조회
   */
  async getAutoApprovalRules(): Promise<string[]> {
    await this.ensureInitialized();

    return this.profile.autoApprovalRules ?? [];
  }

  /**
   * 🎯 네임스페이스 접근 기록
   *
   * kubectl 실행 시 파싱된 네임스페이스를 기록합니다.
   * 접근 빈도 기반으로 상위 N개만 유지합니다.
   */
  async recordNamespaceAccess(namespace: string, clusterId?: string): Promise<void> {
    await this.ensureInitialized();

    if (!(this.profile.workspaceLearningEnabled ?? true)) {
      return;
    }

    // 클러스터 ID가 있으면 클러스터별 컨텍스트에 저장
    if (clusterId) {
      const clusterCtx = await this.getClusterContext(clusterId);
      const existing = clusterCtx.frequentNamespaces.find((ns) => ns.name === namespace);

      if (existing) {
        existing.accessCount += 1;
      } else {
        clusterCtx.frequentNamespaces.push({ name: namespace, accessCount: 1 });
      }

      clusterCtx.frequentNamespaces.sort((a, b) => b.accessCount - a.accessCount);
      clusterCtx.frequentNamespaces = clusterCtx.frequentNamespaces.slice(0, WORKSPACE_LIMITS.MAX_FREQUENT_NAMESPACES);
      clusterCtx.lastUpdatedAt = new Date().toISOString();

      await this.saveClusterContext(clusterId, clusterCtx);

      return;
    }

    // Fallback: 글로벌 (하위 호환)
    const ctx = this.profile.workspaceContext ?? { ...DEFAULT_WORKSPACE_CONTEXT };
    const existing = ctx.frequentNamespaces.find((ns) => ns.name === namespace);

    if (existing) {
      existing.accessCount += 1;
    } else {
      ctx.frequentNamespaces.push({ name: namespace, accessCount: 1 });
    }

    ctx.frequentNamespaces.sort((a, b) => b.accessCount - a.accessCount);
    ctx.frequentNamespaces = ctx.frequentNamespaces.slice(0, WORKSPACE_LIMITS.MAX_FREQUENT_NAMESPACES);

    this.profile.workspaceContext = ctx;
    this.profile.lastUpdatedAt = new Date().toISOString();

    await this.save();
  }

  /**
   * 🎯 리소스 타입 접근 기록
   *
   * kubectl 실행 시 파싱된 리소스 타입을 기록합니다.
   */
  async recordResourceTypeAccess(resourceType: string, clusterId?: string): Promise<void> {
    await this.ensureInitialized();

    if (!(this.profile.workspaceLearningEnabled ?? true)) {
      return;
    }

    const normalized = resourceType.toLowerCase();

    // 클러스터별 저장
    if (clusterId) {
      const clusterCtx = await this.getClusterContext(clusterId);

      if (!clusterCtx.frequentResourceTypes.includes(normalized)) {
        clusterCtx.frequentResourceTypes.push(normalized);
      }

      if (clusterCtx.frequentResourceTypes.length > WORKSPACE_LIMITS.MAX_FREQUENT_RESOURCE_TYPES) {
        clusterCtx.frequentResourceTypes = clusterCtx.frequentResourceTypes.slice(
          -WORKSPACE_LIMITS.MAX_FREQUENT_RESOURCE_TYPES,
        );
      }

      clusterCtx.lastUpdatedAt = new Date().toISOString();
      await this.saveClusterContext(clusterId, clusterCtx);

      return;
    }

    // Fallback: 글로벌
    const ctx = this.profile.workspaceContext ?? { ...DEFAULT_WORKSPACE_CONTEXT };

    if (!ctx.frequentResourceTypes.includes(normalized)) {
      ctx.frequentResourceTypes.push(normalized);
    }

    if (ctx.frequentResourceTypes.length > WORKSPACE_LIMITS.MAX_FREQUENT_RESOURCE_TYPES) {
      ctx.frequentResourceTypes = ctx.frequentResourceTypes.slice(-WORKSPACE_LIMITS.MAX_FREQUENT_RESOURCE_TYPES);
    }

    this.profile.workspaceContext = ctx;
    this.profile.lastUpdatedAt = new Date().toISOString();

    await this.save();
  }

  /**
   * 🎯 반복 문제 패턴 기록
   *
   * ProfileExtractor에서 추출된 에러 패턴을 축적합니다.
   */
  async recordRecurringIssue(
    pattern: string,
    context?: string,
    relatedResources?: string[],
    clusterId?: string,
  ): Promise<void> {
    await this.ensureInitialized();

    if (!(this.profile.workspaceLearningEnabled ?? true)) {
      return;
    }

    const now = new Date().toISOString();

    // 클러스터별 저장
    if (clusterId) {
      const clusterCtx = await this.getClusterContext(clusterId);
      const existing = clusterCtx.recurringIssues.find((issue) => issue.pattern === pattern);

      if (existing) {
        existing.count += 1;
        existing.lastSeen = now;
        if (context) existing.context = context;
        if (relatedResources) existing.relatedResources = relatedResources;
      } else {
        clusterCtx.recurringIssues.push({ pattern, context, relatedResources, lastSeen: now, count: 1 });
      }

      clusterCtx.recurringIssues.sort((a, b) => b.count - a.count);
      clusterCtx.recurringIssues = clusterCtx.recurringIssues.slice(0, WORKSPACE_LIMITS.MAX_RECURRING_ISSUES);
      clusterCtx.lastUpdatedAt = new Date().toISOString();

      await this.saveClusterContext(clusterId, clusterCtx);

      return;
    }

    // Fallback: 글로벌
    const ctx = this.profile.workspaceContext ?? { ...DEFAULT_WORKSPACE_CONTEXT };
    const existing = ctx.recurringIssues.find((issue) => issue.pattern === pattern);

    if (existing) {
      existing.count += 1;
      existing.lastSeen = now;
      if (context) existing.context = context;
      if (relatedResources) existing.relatedResources = relatedResources;
    } else {
      ctx.recurringIssues.push({ pattern, context, relatedResources, lastSeen: now, count: 1 });
    }

    ctx.recurringIssues.sort((a, b) => b.count - a.count);
    ctx.recurringIssues = ctx.recurringIssues.slice(0, WORKSPACE_LIMITS.MAX_RECURRING_ISSUES);

    this.profile.workspaceContext = ctx;
    this.profile.lastUpdatedAt = new Date().toISOString();

    await this.save();
  }

  /**
   * 🎯 프로필 초기화 (리셋)
   */
  async reset(): Promise<void> {
    await this.ensureInitialized();

    // 🎯 race condition 방지: 예약된 debounce 저장 취소 + epoch 기록
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.resetEpoch = Date.now();

    this.profile = {
      ...DEFAULT_USER_PROFILE,
      lastUpdatedAt: new Date().toISOString(),
    };

    await this.save();

    // 모든 클러스터 컨텍스트도 함께 초기화
    try {
      const files = await fs.readdir(this.clusterContextDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          await fs.unlink(path.join(this.clusterContextDir, file));
        }
      }
      this.clusterContextCache.clear();
    } catch {
      // 디렉토리 없으면 무시
    }
  }

  /**
   * observations 유사도 비교 — 앞 20자 기준 포함 관계 체크
   */
  private isObservationSimilar(existing: string, candidate: string): boolean {
    const normalize = (s: string) => s.toLowerCase().trim();
    const a = normalize(existing);
    const b = normalize(candidate);
    return a === b || (a.length >= 30 && b.length >= 30 && a.slice(0, 30) === b.slice(0, 30));
  }

  /**
   * v3: MemoryItem 유사도 비교 — fact 기준
   */
  private isMemoryItemSimilar(existing: MemoryItem, candidate: MemoryItem): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/\s*\(\d{4}-\d{2}(-\d{2})?\)\s*$/, "");
    const a = normalize(typeof existing === "string" ? existing : existing.fact);
    const b = normalize(typeof candidate === "string" ? candidate : candidate.fact);
    return a === b || (a.length >= 25 && b.length >= 25 && a.slice(0, 25) === b.slice(0, 25));
  }

  /**
   * v4: 승급 구조 기반 병합
   */
  private mergeWithPromotion(result: ProfileExtractionResult): void {
    const now = new Date().toISOString();
    const existing = this.profile.memories ?? [];

    // 마이그레이션: 기존 MemoryItem에 승급 필드 없으면 추가
    for (const mem of existing) {
      if (!mem.id) mem.id = generateMemoryId();
      if (!mem.status) mem.status = "active";
      if (!mem.count) mem.count = PROMOTION_THRESHOLD[mem.category] ?? 1;
      if (!mem.firstSeenAt) mem.firstSeenAt = this.profile.lastUpdatedAt || now;
      if (!mem.lastSeenAt) mem.lastSeenAt = this.profile.lastUpdatedAt || now;
      if (mem.status === "active" && !mem.promotedAt) mem.promotedAt = this.profile.lastUpdatedAt || now;
    }

    // 1. removals 처리 — 사용자 명시적 부정
    if (result.removals && result.removals.length > 0) {
      for (const removal of result.removals) {
        const idx = existing.findIndex((m) => m.id === removal.existingId);
        if (idx !== -1) {
          existing.splice(idx, 1);
          console.log(`[UserProfileStore] Memory removed: ${removal.existingId} (${removal.reason})`);
        }
      }
    }

    // 2. matchedCandidates 처리 — 기존 candidate count 증가
    const matchedNewIndices = new Set<number>();
    if (result.matchedCandidates && result.matchedCandidates.length > 0) {
      for (const match of result.matchedCandidates) {
        matchedNewIndices.add(match.newIndex);
        const target = existing.find((m) => m.id === match.existingId);
        if (target) {
          target.count = (target.count ?? 0) + 1;
          target.lastSeenAt = now;
          // action 업데이트 (최신 추출이 더 구체적일 수 있음)
          const newMem = result.memories?.[match.newIndex];
          if (newMem?.action) target.action = newMem.action;

          // 승급 체크
          const threshold = PROMOTION_THRESHOLD[target.category] ?? 2;
          if (target.status === "pending" && (target.count ?? 0) >= threshold) {
            target.status = "active";
            target.promotedAt = now;
            console.log(`[UserProfileStore] Memory promoted: ${target.id} (${target.fact})`);
            this.enforceActiveLimit(existing, now);
          } else if (target.status === "archived") {
            // archived → active 즉시 복귀
            target.status = "active";
            target.promotedAt = now;
            console.log(`[UserProfileStore] Memory reactivated: ${target.id} (${target.fact})`);
            this.enforceActiveLimit(existing, now);
          }
        }
      }
    }

    // 3. 새로운 memories 추가 (matched 아닌 것들)
    if (result.memories && result.memories.length > 0) {
      for (let i = 0; i < result.memories.length; i++) {
        if (matchedNewIndices.has(i)) continue;
        const mem = result.memories[i];
        // fact 기반 중복 체크 (LLM이 matchedCandidates를 안 줬을 경우 fallback)
        const isDuplicate = existing.some((e) => this.isMemoryItemSimilar(e, mem));
        if (isDuplicate) continue;

        const threshold = PROMOTION_THRESHOLD[mem.category] ?? 2;
        const initialStatus: MemoryStatus = threshold <= 1 ? "active" : "pending";
        const newItem: MemoryItem = {
          ...mem,
          id: generateMemoryId(),
          status: initialStatus,
          count: 1,
          firstSeenAt: now,
          lastSeenAt: now,
          ...(initialStatus === "active" ? { promotedAt: now } : {}),
        };
        existing.push(newItem);
        if (initialStatus === "active") {
          this.enforceActiveLimit(existing, now);
        }
      }
    }

    // 4. 만료 정리
    this.expireStaleMemories(existing);

    // 5. pending eviction
    this.enforcePendingLimit(existing);

    this.profile.memories = existing;
  }

  /**
   * active 10개 초과 시 가장 오래된 active를 archived로
   */
  private enforceActiveLimit(memories: MemoryItem[], now: string): void {
    const activeItems = memories.filter((m) => m.status === "active");
    if (activeItems.length <= PROMOTION_LIMITS.MAX_ACTIVE) return;

    // lastSeenAt 오래된 순 정렬
    activeItems.sort((a, b) => (a.lastSeenAt ?? "").localeCompare(b.lastSeenAt ?? ""));
    const toArchive = activeItems.slice(0, activeItems.length - PROMOTION_LIMITS.MAX_ACTIVE);
    for (const item of toArchive) {
      item.status = "archived";
      console.log(`[UserProfileStore] Memory archived: ${item.id} (${item.fact})`);
    }
  }

  /**
   * pending 40개 초과 시 count 낮고 오래된 것 삭제
   */
  private enforcePendingLimit(memories: MemoryItem[]): void {
    const pendingItems = memories.filter((m) => m.status === "pending");
    if (pendingItems.length <= PROMOTION_LIMITS.MAX_PENDING) return;

    // count 오름차순, 동률이면 lastSeenAt 오래된 순
    pendingItems.sort((a, b) => {
      const countDiff = (a.count ?? 0) - (b.count ?? 0);
      if (countDiff !== 0) return countDiff;
      return (a.lastSeenAt ?? "").localeCompare(b.lastSeenAt ?? "");
    });
    const toDrop = pendingItems.slice(0, pendingItems.length - PROMOTION_LIMITS.MAX_PENDING);
    const dropIds = new Set(toDrop.map((m) => m.id));
    // 원본 배열에서 제거
    for (let i = memories.length - 1; i >= 0; i--) {
      if (dropIds.has(memories[i].id)) {
        memories.splice(i, 1);
      }
    }
  }

  /**
   * 만료 정리: pending 60일, archived 90일
   */
  private expireStaleMemories(memories: MemoryItem[]): void {
    const now = Date.now();
    const msPerDay = 86400000;
    for (let i = memories.length - 1; i >= 0; i--) {
      const mem = memories[i];
      if (!mem.lastSeenAt) continue;
      const daysSince = Math.floor((now - new Date(mem.lastSeenAt).getTime()) / msPerDay);

      if (mem.status === "pending" && daysSince > PROMOTION_LIMITS.PENDING_EXPIRE_DAYS) {
        console.log(`[UserProfileStore] Memory expired (pending): ${mem.id}`);
        memories.splice(i, 1);
      } else if (mem.status === "archived" && daysSince > PROMOTION_LIMITS.ARCHIVED_EXPIRE_DAYS) {
        console.log(`[UserProfileStore] Memory expired (archived): ${mem.id}`);
        memories.splice(i, 1);
      }
    }
  }

  /**
   * v3: MD 한 줄을 MemoryItem으로 파싱
   * 형식: [category] fact → action  또는  [category:topic] fact → action
   * fallback: plain text → {fact, category: "behavior", action: ""}
   */
  private parseMemoryLine(line: string): MemoryItem {
    // [category:topic] fact → action
    const matchWithTopic = line.match(/^\[([a-z]+):([^\]]+)\]\s*(.+?)(?:\s*→\s*(.+))?$/);
    if (matchWithTopic) {
      return {
        fact: matchWithTopic[3].trim(),
        category: (matchWithTopic[1] as MemoryItem["category"]) || "behavior",
        topic: matchWithTopic[2].trim(),
        action: matchWithTopic[4]?.trim() ?? "",
      };
    }
    // [category] fact → action
    const matchSimple = line.match(/^\[([a-z]+)\]\s*(.+?)(?:\s*→\s*(.+))?$/);
    if (matchSimple) {
      return {
        fact: matchSimple[2].trim(),
        category: (matchSimple[1] as MemoryItem["category"]) || "behavior",
        action: matchSimple[3]?.trim() ?? "",
      };
    }
    // plain text fallback
    return { fact: line, category: "behavior", action: "" };
  }

  // ============================================
  // 🎯 debounce 저장 (race condition 방지)
  // ============================================

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** 마지막 reset() 호출 시점 — 이전에 시작된 추출 결과 무시용 */
  private resetEpoch = 0;

  /**
   * 300ms debounce로 저장 예약 — 짧은 간격의 중복 쓰기 방지
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 300);
  }

  /**
   * 🎯 파일에 저장 — MD (사용자 열람용) + meta.json (내부 데이터)
   */
  private async save(): Promise<void> {
    await this.saveAll();
  }

  private async saveAll(): Promise<void> {
    try {
      const dir = path.dirname(this.profileMdPath);
      await fs.mkdir(dir, { recursive: true });

      // 1. meta.json — 전체 프로필 데이터 (streak, count, timestamp 등)
      await fs.writeFile(this.metaPath, JSON.stringify(this.profile, null, 2), "utf-8");

      // 2. user-profile.md — 사용자 열람/AI 편집용
      const md = this.generateProfileMd();
      await fs.writeFile(this.profileMdPath, md, "utf-8");

      // 3. Renderer에 변경 알림 (실시간 UI 갱신)
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send("ai-assistant:profile-updated");
        }
      }
    } catch (error) {
      console.error("[UserProfileStore] 프로필 저장 실패:", error);
    }
  }

  /**
   * 🎯 프로필 데이터를 사람이 읽기 쉬운 MD로 변환
   */
  private generateProfileMd(): string {
    const p = this.profile;
    const lines: string[] = [];

    lines.push("# User Profile");
    lines.push("");
    lines.push(`> Automatically learned from ${p.totalConversations} conversations. Last updated: ${p.lastUpdatedAt}`);
    lines.push("");

    // Preferences

    // Memories (v3: 카테고리 기반 MemoryItem[])
    const memories = (p.memories ?? []).filter((m) => typeof m !== "string" && m.status === "active");
    if (memories.length > 0) {
      lines.push("## Memories");
      lines.push("");
      for (const mem of memories) {
        if (typeof mem === "string") {
          // Legacy string fallback
          lines.push(`- ${mem}`);
        } else {
          const topicTag = mem.topic ? `${mem.category}:${mem.topic}` : mem.category;
          const actionPart = mem.action ? ` → ${mem.action}` : "";
          lines.push(`- [${topicTag}] ${mem.fact}${actionPart}`);
        }
      }
      lines.push("");
    }

    // Legacy: Focus Areas (deprecated, migration 중에만 표시)
    if (p.focusAreas.length > 0 && memories.length === 0) {
      lines.push("## Focus Areas");
      for (const area of p.focusAreas) {
        lines.push(`- ${area}`);
      }
      lines.push("");
    }

    // Legacy: Observations (deprecated, migration 중에만 표시)
    if (p.observations.length > 0 && memories.length === 0) {
      lines.push("## Observations");
      for (const obs of p.observations) {
        lines.push(`- ${obs}`);
      }
      lines.push("");
    }

    // Feedback Summary
    const posCount = p.feedbackHistory.filter((f) => f.rating === "positive").length;
    const negCount = p.feedbackHistory.filter((f) => f.rating === "negative").length;
    if (posCount > 0 || negCount > 0) {
      lines.push("## Feedback");
      lines.push(`- 👍 Positive: ${posCount}`);
      lines.push(`- 👎 Negative: ${negCount}`);

      // 최근 부정 피드백 상세
      const recentNeg = p.feedbackHistory.filter((f) => f.rating === "negative" && f.category).slice(-5);
      if (recentNeg.length > 0) {
        lines.push("- Recent complaints:");
        for (const f of recentNeg) {
          const detail = f.detail ? ` — ${f.detail}` : "";
          lines.push(`  - ${f.category}${detail}`);
        }
      }
      lines.push("");
    }

    // Workspace Context (글로벌)
    const ws = p.workspaceContext;
    if (ws) {
      const hasNs = ws.frequentNamespaces && ws.frequentNamespaces.length > 0;
      const hasRes = ws.frequentResourceTypes && ws.frequentResourceTypes.length > 0;
      const hasIssues = ws.recurringIssues && ws.recurringIssues.length > 0;

      if (hasNs || hasRes || hasIssues) {
        lines.push("## Workspace Context");

        if (hasNs) {
          lines.push("### Frequent Namespaces");
          for (const ns of ws.frequentNamespaces) {
            lines.push(`- ${ns.name} (${ns.accessCount} accesses)`);
          }
        }

        if (hasRes) {
          lines.push("### Resource Types");
          lines.push(`- ${ws.frequentResourceTypes.join(", ")}`);
        }

        if (hasIssues) {
          lines.push("### Recurring Issues");
          for (const issue of ws.recurringIssues) {
            let line = `- ${issue.pattern} (${issue.count}x, last: ${issue.lastSeen})`;
            if (issue.context) line += ` [${issue.context}]`;
            lines.push(line);
          }
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * 🎯 MD 파일 내용을 직접 반환 (IPC용 — Renderer에서 표시)
   */
  async getProfileMd(): Promise<string> {
    await this.ensureInitialized();
    try {
      return await fs.readFile(this.profileMdPath, "utf-8");
    } catch {
      return "# User Profile\n\nNo personalization data yet. Start chatting to build your profile.";
    }
  }

  /**
   * 🎯 MD 파일 직접 업데이트 (AI 채팅에서 편집 시)
   */
  async updateProfileMd(newMdContent: string): Promise<void> {
    await this.ensureInitialized();
    const dir = path.dirname(this.profileMdPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.profileMdPath, newMdContent, "utf-8");
    // MD 변경 사항을 내부 프로필에도 반영
    this.applyMdOverrides(newMdContent);
    // meta.json도 업데이트
    await fs.writeFile(this.metaPath, JSON.stringify(this.profile, null, 2), "utf-8");

    // Renderer에 변경 알림 (실시간 UI 갱신)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send("ai-assistant:profile-updated");
      }
    }
  }

  // ============================================
  // 🎯 클러스터별 워크스페이스 컨텍스트
  // ============================================

  /**
   * 클러스터 ID를 안전한 파일명으로 변환
   */
  private clusterIdToFilename(clusterId: string): string {
    // crypto.createHash는 Electron Main에서 사용 가능
    const { createHash } = require("crypto") as typeof import("crypto");

    return createHash("sha256").update(clusterId).digest("hex").slice(0, 16) + ".json";
  }

  /**
   * 클러스터별 컨텍스트 로드
   */
  async getClusterContext(clusterId: string): Promise<ClusterWorkspaceContext> {
    // 캐시 확인
    const cached = this.clusterContextCache.get(clusterId);

    if (cached) {
      return cached;
    }

    const filePath = path.join(this.clusterContextDir, this.clusterIdToFilename(clusterId));

    try {
      const content = await fs.readFile(filePath, "utf-8");
      const loaded = JSON.parse(content) as ClusterWorkspaceContext;

      this.clusterContextCache.set(clusterId, loaded);

      return loaded;
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        console.warn("[UserProfileStore] 클러스터 컨텍스트 로드 실패:", clusterId, error);
      }

      // 새 클러스터 — 기본 컨텍스트 생성
      const defaultCtx = createDefaultClusterContext(clusterId);

      this.clusterContextCache.set(clusterId, defaultCtx);

      return defaultCtx;
    }
  }

  /**
   * 클러스터별 컨텍스트 저장
   */
  private async saveClusterContext(clusterId: string, ctx: ClusterWorkspaceContext): Promise<void> {
    try {
      await fs.mkdir(this.clusterContextDir, { recursive: true });

      const filePath = path.join(this.clusterContextDir, this.clusterIdToFilename(clusterId));

      await fs.writeFile(filePath, JSON.stringify(ctx, null, 2), "utf-8");
      this.clusterContextCache.set(clusterId, ctx);
    } catch (error) {
      console.error("[UserProfileStore] 클러스터 컨텍스트 저장 실패:", clusterId, error);
    }
  }

  /**
   * 특정 클러스터의 워크스페이스 컨텍스트만 리셋
   */
  async resetClusterContext(clusterId: string): Promise<void> {
    const filePath = path.join(this.clusterContextDir, this.clusterIdToFilename(clusterId));

    try {
      await fs.unlink(filePath);
    } catch {
      // 파일 없으면 무시
    }

    this.clusterContextCache.delete(clusterId);
  }
}
