/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { createHash } from "crypto";
import { MonitorCollector } from "./monitor-collector";
import { runMonitorAgent } from "./monitor-llm";
import { filterByPreset } from "./monitor-rules";

import type {
  CustomRuleEvalResult,
  K8sEvent,
  MonitorAlert,
  MonitorClusterConfig,
  MonitorConfig,
  MonitorFinding,
  MonitorRule,
  MonitorStatus,
} from "../../common/monitor-types";

/**
 * 목적: 감시 에이전트 콜백 타입
 */
export interface MonitorAgentCallbacks {
  onAlert(alert: MonitorAlert): void;
  onStatus(status: MonitorStatus): void;
  onCheckComplete(clusterId: string, findingCount: number): void;
  onError(error: string, clusterId?: string): void;
}

/**
 * 목적: 스케줄 항목 (base check 또는 커스텀 룰의 다음 체크 시각)
 */
interface ScheduleEntry {
  type: "base" | "rule";
  clusterId: string;
  ruleDescription?: string;
  nextCheckAt: number;
  intervalMs: number;
}

/**
 * 목적: utility process 내부 감시 에이전트 (ReAct 루프 + 적응형 인터벌)
 */
export class MonitorAgent {
  private timer: NodeJS.Timeout | null = null;
  private collector: MonitorCollector;
  private stopped = true;

  // ── dedup 상태 ──
  private alertedFingerprints: Map<string, number> = new Map();
  private readonly DEDUP_WINDOW_MS = 10 * 60 * 1000;

  // ── LLM 응답 캐시 ──
  private responseCache: Map<string, { response: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000;
  private readonly MAX_CACHE_SIZE = 50;

  // ── per-cluster 실행 잠금 (동시 checkAndReport 방지) ──
  private runningChecks = new Set<string>();

  // ── 적응형 인터벌 상태 ──
  private currentIntervalMs = 0;
  private consecutiveHealthy = 0;
  private readonly HEALTHY_STREAK = 3;
  private readonly BACKOFF_FACTOR = 1.5;
  private readonly MAX_INTERVAL_FACTOR = 3;

  // ── nextCheckAt 기반 스케줄 ──
  private schedule: ScheduleEntry[] = [];

  constructor(
    private config: MonitorConfig,
    private readonly callbacks: MonitorAgentCallbacks,
  ) {
    this.collector = new MonitorCollector(config.kubectlPath);
  }

  /**
   * 목적: config의 클러스터/룰 정보로 스케줄 초기화
   */
  private buildSchedule(): void {
    const now = Date.now();
    this.schedule = [];
    for (const cluster of this.config.clusters) {
      const baseInterval = cluster.intervalOverrideMs ?? this.currentIntervalMs;
      this.schedule.push({
        type: "base",
        clusterId: cluster.id,
        nextCheckAt: now,
        intervalMs: baseInterval,
      });
      for (const rule of (cluster.customRules ?? []).filter((r) => r.enabled)) {
        this.schedule.push({
          type: "rule",
          clusterId: cluster.id,
          ruleDescription: rule.description,
          nextCheckAt: now,
          intervalMs: rule.intervalMs ?? baseInterval,
        });
      }
    }
  }

  /**
   * 목적: 감시 루프 시작 (setTimeout 체인)
   */
  start(): void {
    console.log(
      "[MonitorAgent] start() called — enabled:",
      this.config.enabled,
      "clusters:",
      this.config.clusters.length,
    );
    if (!this.config.enabled || !this.config.clusters.length) {
      console.log("[MonitorAgent] Skipping start — not enabled or no clusters");
      return;
    }

    this.stopped = false;
    this.currentIntervalMs = this.config.intervalMs;
    this.buildSchedule();
    console.log(
      "[MonitorAgent] Running first iteration, interval:",
      this.currentIntervalMs,
      "ms, schedule entries:",
      this.schedule.length,
    );

    this.runIteration()
      .catch((error) => this.callbacks.onError(String(error)))
      .finally(() => this.scheduleNext());
  }

  /**
   * 목적: 다음 점검 예약 (가장 빠른 nextCheckAt까지 대기)
   */
  private scheduleNext(): void {
    if (this.stopped) return;
    const now = Date.now();
    const nextAt =
      this.schedule.length > 0 ? Math.min(...this.schedule.map((e) => e.nextCheckAt)) : now + this.currentIntervalMs;
    const delay = Math.max(1000, nextAt - now);
    this.timer = setTimeout(() => {
      this.runIteration()
        .catch((error) => this.callbacks.onError(String(error)))
        .finally(() => this.scheduleNext());
    }, delay);
  }

  /**
   * 목적: 감시 루프 중단
   */
  stop(): void {
    this.stopped = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * 목적: 설정 갱신 (기존 스케줄의 nextCheckAt 보존)
   */
  updateConfig(config: MonitorConfig): void {
    // 기존 스케줄의 nextCheckAt 보존용 맵
    const oldScheduleMap = new Map<string, number>();
    for (const entry of this.schedule) {
      const key =
        entry.type === "base" ? `base|${entry.clusterId}` : `rule|${entry.clusterId}|${entry.ruleDescription}`;
      oldScheduleMap.set(key, entry.nextCheckAt);
    }

    this.stop();
    this.config = config;
    this.collector = new MonitorCollector(config.kubectlPath);

    if (!config.enabled || !config.clusters.length) return;

    this.stopped = false;
    this.currentIntervalMs = config.intervalMs;
    this.buildSchedule();

    // 기존 타이밍 복원 (새 룰은 nextCheckAt = now 유지)
    for (const entry of this.schedule) {
      const key =
        entry.type === "base" ? `base|${entry.clusterId}` : `rule|${entry.clusterId}|${entry.ruleDescription}`;
      const oldNextAt = oldScheduleMap.get(key);
      if (oldNextAt !== undefined) {
        entry.nextCheckAt = oldNextAt;
      }
    }

    this.scheduleNext();
  }

  /**
   * 목적: 실행 중 클러스터에 커스텀 규칙 추가 + 스케줄 등록
   */
  addCustomRule(clusterId: string, rule: MonitorRule): void {
    const cluster = this.config.clusters.find((c) => c.id === clusterId);
    if (!cluster) return;

    cluster.customRules = [...(cluster.customRules ?? []), rule];

    if (rule.enabled) {
      const baseInterval = cluster.intervalOverrideMs ?? this.currentIntervalMs;
      this.schedule.push({
        type: "rule",
        clusterId,
        ruleDescription: rule.description,
        nextCheckAt: Date.now(),
        intervalMs: rule.intervalMs ?? baseInterval,
      });
    }
  }

  /**
   * 목적: 단일 클러스터 즉시 점검
   */
  async checkCluster(clusterId: string): Promise<void> {
    const cluster = this.config.clusters.find((item) => item.id === clusterId);

    if (!cluster) {
      this.callbacks.onError(`Unknown cluster id: ${clusterId}`, clusterId);
      return;
    }

    await this.checkAndReport(cluster);
  }

  /**
   * 목적: due 스케줄 엔트리 수집 → 클러스터별 그룹핑 → 점검
   */
  private async runIteration(): Promise<void> {
    const now = Date.now();
    const dueByCluster = new Map<string, { runBaseCheck: boolean; dueRules: MonitorRule[] }>();

    for (const entry of this.schedule) {
      if (now < entry.nextCheckAt) continue;
      if (!dueByCluster.has(entry.clusterId)) {
        dueByCluster.set(entry.clusterId, { runBaseCheck: false, dueRules: [] });
      }
      const group = dueByCluster.get(entry.clusterId)!;
      if (entry.type === "base") {
        group.runBaseCheck = true;
      } else {
        const cluster = this.config.clusters.find((c) => c.id === entry.clusterId);
        const rule = cluster?.customRules?.find((r) => r.description === entry.ruleDescription);
        if (rule) group.dueRules.push(rule);
      }
      entry.nextCheckAt = now + entry.intervalMs;
    }

    for (const [clusterId, options] of dueByCluster) {
      if (this.stopped) return;
      const cluster = this.config.clusters.find((c) => c.id === clusterId);
      if (cluster) await this.checkAndReport(cluster, options);
    }
  }

  /**
   * 목적: 단일 클러스터 점검 및 보고 (에이전트 루프)
   * options가 주어지면 due인 항목만 선택적 실행
   */
  private async checkAndReport(
    cluster: MonitorClusterConfig,
    options?: { runBaseCheck: boolean; dueRules: MonitorRule[] },
  ): Promise<void> {
    // per-cluster 동시 실행 방지
    if (this.runningChecks.has(cluster.id)) {
      console.log("[MonitorAgent] checkAndReport SKIPPED — already running for cluster:", cluster.id);
      return;
    }

    // options가 있지만 due 항목이 없으면 early return
    if (options && !options.runBaseCheck && options.dueRules.length === 0) return;

    this.runningChecks.add(cluster.id);
    console.log(
      "[MonitorAgent] checkAndReport for cluster:",
      cluster.id,
      cluster.name,
      options ? `(baseCheck: ${options.runBaseCheck}, dueRules: ${options.dueRules.length})` : "(full)",
    );
    try {
      const maxAgeMs = Math.max(this.config.intervalMs * 2, 10 * 60 * 1000);
      const collected = await this.collector.collect(cluster, maxAgeMs);
      console.log("[MonitorAgent] Collected events:", collected.length, "from cluster:", cluster.name);

      const presetFiltered = filterByPreset(cluster.presetLevel, collected);
      console.log("[MonitorAgent] After preset filter (", cluster.presetLevel, "):", presetFiltered.length);

      // severity 기준 정렬: critical → warning → info (중요 이벤트 우선)
      const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
      presetFiltered.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

      // 초기 수집 결과를 LLM에 전달하기 위해 요약 (raw 제외, 핵심 필드만)
      const trimmed = presetFiltered.slice(0, 50);
      const initialFindings = JSON.stringify(trimmed.map(({ raw, ...rest }) => rest));

      // dedup: 이전 알림 핑거프린트 목록
      const previousAlerts = this.getRecentAlertFingerprints();

      // 커스텀 룰: options가 있으면 dueRules만, 없으면 전체 활성 룰
      const activeRules = options
        ? options.dueRules.filter((r) => r.enabled)
        : (cluster.customRules ?? []).filter((r) => r.enabled);

      // evalCommand가 있는 룰과 없는 룰 분리
      const rulesWithEval = activeRules.filter((r) => r.evalCommand);
      const rulesWithoutEval = activeRules.filter((r) => !r.evalCommand);

      // evalCommand 결과 수집 (base 11개 수집과 별개)
      const evalResults =
        rulesWithEval.length > 0 ? await this.collector.collectCustomRuleResults(cluster, rulesWithEval) : [];

      // customRules 텍스트: evalCommand 없는 룰만 (기존 방식)
      const customRules = rulesWithoutEval.map((r) => {
        const c = r.condition;
        const condStr = c.field
          ? `${c.resource}.${c.field} ${c.operator} ${c.value}`
          : `${c.resource} ${c.operator} "${c.value}"`;
        return `${r.description} [condition: ${condStr}, severity: ${r.severity}]`;
      });

      // LLM에는 항상 실제 이벤트 전달 (커스텀 룰 평가에 필요)
      // 알림 첨부용 이벤트만 base check due 여부로 분리
      const effectiveFindings = initialFindings;
      const effectiveEvents = options && !options.runBaseCheck ? [] : presetFiltered;

      // 이벤트도 없고 커스텀 룰도 없고 evalResults도 없으면 스킵 (LLM 비용 $0)
      if (effectiveEvents.length === 0 && customRules.length === 0 && evalResults.length === 0) {
        console.log("[MonitorAgent] No events, no custom rules, no eval results — skipping LLM");
        this.reportHealthy(cluster.id);
        this.adjustInterval("later");
        return;
      }

      console.log(
        "[MonitorAgent] Running agent loop — findings:",
        presetFiltered.length,
        "customRules:",
        customRules.length,
        "evalResults:",
        evalResults.length,
      );

      // ── 캐시 체크 ──
      const cacheKey = this.computeCacheKey(effectiveFindings, customRules, evalResults);
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        console.log("[MonitorAgent] Cache HIT — skipping LLM call");

        // dedup: 모든 이벤트가 이미 알림된 상태면 알림 스킵
        const allAlerted =
          effectiveEvents.length > 0 && effectiveEvents.every((e) => previousAlerts.includes(this.fingerprint(e)));
        if (allAlerted) {
          console.log("[MonitorAgent] Cache HIT but all events already alerted — skipping notification");
          this.callbacks.onCheckComplete(cluster.id, 0);
          this.adjustInterval("normal");
          return;
        }

        const cachedParsed = this.safeParse(cached);
        if (!cachedParsed || cachedParsed.severity === "info") {
          this.reportHealthy(cluster.id);
          this.adjustInterval(cachedParsed?.nextCheckAdvice ?? "normal");
          this.callbacks.onCheckComplete(cluster.id, 0);
          return;
        }

        const cachedFindings = this.normalizeFindings(cachedParsed.findings, effectiveEvents);
        const cachedAlert: MonitorAlert = {
          clusterId: cluster.id,
          clusterName: cluster.name,
          severity: cachedParsed.severity === "critical" ? "critical" : "warning",
          summary: cachedParsed.summary ?? `Cluster issue detected on ${cluster.name}`,
          findings: cachedFindings,
          events: effectiveEvents,
          timestamp: Date.now(),
        };

        this.markAlerted(cachedAlert);
        this.callbacks.onAlert(cachedAlert);
        this.callbacks.onStatus({
          clusterId: cluster.id,
          health: cachedAlert.severity === "critical" ? "critical" : "degraded",
          lastChecked: Date.now(),
          findingCount: cachedParsed.findings?.length ?? 0,
        });
        this.callbacks.onCheckComplete(cluster.id, cachedParsed.findings?.length ?? 0);
        this.adjustInterval(cachedParsed.nextCheckAdvice ?? "sooner");
        return;
      }

      // ── 에이전트 루프 실행 ──
      const responseText = await runMonitorAgent({
        config: this.config,
        clusterName: cluster.name,
        kubeconfigPath: cluster.kubeconfigPath,
        initialFindings: effectiveFindings,
        previousAlerts,
        customRules,
        customRuleResults: evalResults.length > 0 ? evalResults : undefined,
      });

      // 빈 응답 감지: LLM이 tool call만 하다 step limit에 도달한 경우
      if (!responseText || responseText.trim().length === 0) {
        const model = this.config.modelId ?? "default";
        console.warn(`[MonitorAgent] Empty LLM response from ${this.config.provider}/${model} — treating as error`);
        this.callbacks.onStatus({
          clusterId: cluster.id,
          health: "unknown",
          lastChecked: Date.now(),
          error: `LLM returned empty response (${this.config.provider}/${model})`,
        });
        this.callbacks.onError(`Empty LLM response from ${this.config.provider}/${model}`, cluster.id);
        this.callbacks.onCheckComplete(cluster.id, 0);
        return;
      }

      const parsed = this.safeParse(responseText);

      // 파싱 실패: 유효한 JSON이 아닌 경우 — 에러로 처리 (healthy 아님)
      if (!parsed) {
        const model = this.config.modelId ?? "default";
        console.warn(
          `[MonitorAgent] Unparseable LLM response from ${this.config.provider}/${model}:`,
          responseText.slice(0, 200),
        );
        this.callbacks.onStatus({
          clusterId: cluster.id,
          health: "unknown",
          lastChecked: Date.now(),
          error: `LLM response not valid JSON (${this.config.provider}/${model})`,
        });
        this.callbacks.onError(`Unparseable LLM response from ${this.config.provider}/${model}`, cluster.id);
        this.callbacks.onCheckComplete(cluster.id, 0);
        return;
      }

      // ── 캐시 저장 (파싱 성공한 응답만) ──
      this.cacheResponse(cacheKey, responseText);

      if (parsed.severity === "info") {
        console.log("[MonitorAgent] Agent returned info — healthy");
        this.reportHealthy(cluster.id);
        this.adjustInterval(parsed.nextCheckAdvice ?? "normal");
        this.callbacks.onCheckComplete(cluster.id, 0);
        return;
      }

      // 알림 생성 + dedup 기록
      const findings = this.normalizeFindings(parsed.findings, effectiveEvents);
      const alert: MonitorAlert = {
        clusterId: cluster.id,
        clusterName: cluster.name,
        severity: parsed.severity === "critical" ? "critical" : "warning",
        summary: parsed.summary ?? `Cluster issue detected on ${cluster.name}`,
        findings,
        events: effectiveEvents,
        timestamp: Date.now(),
      };

      this.markAlerted(alert);
      console.log("[MonitorAgent] Alert generated:", alert.severity, alert.summary);
      this.callbacks.onAlert(alert);
      this.callbacks.onStatus({
        clusterId: cluster.id,
        health: alert.severity === "critical" ? "critical" : "degraded",
        lastChecked: Date.now(),
        findingCount: parsed.findings?.length ?? 0,
      });
      this.callbacks.onCheckComplete(cluster.id, parsed.findings?.length ?? 0);
      this.adjustInterval(parsed.nextCheckAdvice ?? "sooner");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const detail = `[${this.config.provider}/${this.config.modelId ?? "default"}] ${errMsg}`;
      console.log("[MonitorAgent] checkAndReport error:", detail);
      this.callbacks.onStatus({
        clusterId: cluster.id,
        health: "unknown",
        lastChecked: Date.now(),
        error: detail,
      });
      this.callbacks.onError(detail, cluster.id);
    } finally {
      this.runningChecks.delete(cluster.id);
    }
  }

  /**
   * 목적: 정상 상태 보고
   */
  private reportHealthy(clusterId: string): void {
    this.callbacks.onStatus({
      clusterId,
      health: "healthy",
      lastChecked: Date.now(),
      findingCount: 0,
    });
  }

  /**
   * 목적: LLM의 nextCheckAdvice + 연속 건강 횟수 기반 인터벌 조정
   */
  private adjustInterval(advice: string): void {
    const baseMs = this.config.intervalMs;
    const maxMs = baseMs * this.MAX_INTERVAL_FACTOR;

    if (advice === "later") {
      this.consecutiveHealthy++;
      if (this.consecutiveHealthy >= this.HEALTHY_STREAK) {
        const newInterval = Math.min(this.currentIntervalMs * this.BACKOFF_FACTOR, maxMs);
        console.log("[MonitorAgent] Backoff interval:", this.currentIntervalMs, "→", newInterval);
        this.currentIntervalMs = newInterval;
        this.consecutiveHealthy = 0;
      }
    } else if (advice === "sooner") {
      this.consecutiveHealthy = 0;
      const newInterval = Math.max(30_000, baseMs / 2);
      console.log("[MonitorAgent] Shortening interval:", this.currentIntervalMs, "→", newInterval);
      this.currentIntervalMs = newInterval;
    } else {
      this.consecutiveHealthy = 0;
      this.currentIntervalMs = baseMs;
    }

    // base check 스케줄 엔트리의 intervalMs를 adaptive 값으로 갱신
    for (const entry of this.schedule) {
      if (entry.type === "base") {
        entry.intervalMs = this.currentIntervalMs;
      }
    }
  }

  // ── Dedup 헬퍼 ──

  /**
   * 목적: 이벤트 핑거프린트 생성
   */
  private fingerprint(event: K8sEvent): string {
    if (event.uid) return event.uid;
    return `${event.kind}|${event.namespace ?? ""}|${event.name}|${event.reason ?? ""}`;
  }

  /**
   * 목적: 최근 알림 핑거프린트 목록 (만료 정리 포함)
   */
  private getRecentAlertFingerprints(): string[] {
    const now = Date.now();
    const recent: string[] = [];
    for (const [fp, ts] of this.alertedFingerprints) {
      if (now - ts > this.DEDUP_WINDOW_MS) {
        this.alertedFingerprints.delete(fp);
      } else {
        recent.push(fp);
      }
    }
    return recent;
  }

  /**
   * 목적: 알림 이벤트를 dedup 맵에 기록
   */
  private markAlerted(alert: MonitorAlert): void {
    const now = Date.now();
    for (const event of alert.events) {
      this.alertedFingerprints.set(this.fingerprint(event), now);
    }
  }

  /**
   * 목적: LLM 응답에서 JSON 추출 및 파싱
   *
   * 다양한 모델이 JSON을 출력하는 방식이 다름:
   * - Sonnet 4: 순수 JSON만 출력
   * - 4.5/4.1 모델: JSON 앞뒤에 설명 텍스트를 추가하는 경향
   *
   * 시도 순서:
   * 1. 전체 텍스트를 JSON.parse
   * 2. markdown fence 제거 후 JSON.parse
   * 3. 텍스트 내에서 { ... } JSON 객체 추출
   */
  private safeParse(text: string): any {
    // 1차: 전체 텍스트 직접 파싱
    try {
      return JSON.parse(text.trim());
    } catch {
      /* fallthrough */
    }

    // 2차: markdown fence 제거
    try {
      const cleaned = text
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      return JSON.parse(cleaned);
    } catch {
      /* fallthrough */
    }

    // 3차: 텍스트 내에서 최외곽 JSON 객체 추출 (설명 텍스트 포함 대응)
    try {
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonCandidate = text.slice(firstBrace, lastBrace + 1);
        return JSON.parse(jsonCandidate);
      }
    } catch {
      /* fallthrough */
    }

    return null;
  }

  // ── LLM 캐시 헬퍼 ──

  /**
   * 목적: 초기 수집 결과 + 커스텀 룰로 캐시 키 생성
   *
   * timestamp, raw 등 매 사이클 변하는 필드를 제외하고
   * 안정적인 필드(kind, name, namespace, reason, message, severity)만으로 키 생성
   */
  private computeCacheKey(findings: string, rules: string[], evalResults?: CustomRuleEvalResult[]): string {
    let stableFindings: string;

    try {
      const events = JSON.parse(findings) as Array<Record<string, unknown>>;
      const stable = events.map((e) => `${e.kind}|${e.namespace ?? ""}|${e.name}|${e.reason ?? ""}|${e.severity}`);
      stable.sort();
      stableFindings = stable.join("\n");
    } catch {
      stableFindings = findings;
    }

    let content = stableFindings + "||" + rules.join(",");
    if (evalResults && evalResults.length > 0) {
      const evalKey = evalResults.map((r) => `${r.ruleId}|${r.output.slice(0, 200)}`).join(";");
      content += "||" + evalKey;
    }
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * 목적: 캐시에서 LLM 응답 조회 (TTL 만료 시 삭제)
   */
  private getCachedResponse(key: string): string | null {
    const entry = this.responseCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.CACHE_TTL_MS) {
      this.responseCache.delete(key);
      return null;
    }
    return entry.response;
  }

  /**
   * 목적: LLM 응답을 캐시에 저장 (LRU: 최대 크기 초과 시 가장 오래된 것 삭제)
   */
  private cacheResponse(key: string, response: string): void {
    if (this.responseCache.size >= this.MAX_CACHE_SIZE) {
      const oldest = this.responseCache.keys().next().value;
      if (oldest) this.responseCache.delete(oldest);
    }
    this.responseCache.set(key, { response, timestamp: Date.now() });
  }

  /**
   * 목적: LLM findings 결과 정규화
   */
  private normalizeFindings(raw: unknown, events: K8sEvent[]): MonitorFinding[] {
    const now = Date.now();

    if (!Array.isArray(raw) || raw.length === 0) {
      const severity = events.some((event) => event.severity === "critical") ? "critical" : "warning";
      return [
        {
          id: `${now}-0`,
          severity,
          category: "availability",
          title: "Kubernetes issues detected",
          description: events
            .slice(0, 3)
            .map((event) => event.message)
            .join("; "),
          suggestedCommands: ["kubectl get events -A --sort-by=.lastTimestamp", "kubectl get pods -A"],
        },
      ];
    }

    return raw.map((item: Record<string, unknown>, index: number) => ({
      id: `${now}-${index}`,
      severity:
        item?.severity === "critical" || item?.severity === "info"
          ? (item.severity as MonitorFinding["severity"])
          : "warning",
      category: (item?.category as string) ?? "availability",
      title: (item?.title as string) ?? "Detected issue",
      description: (item?.description as string) ?? "No description",
      suggestedCommands: Array.isArray(item?.suggestedCommands) ? (item.suggestedCommands as string[]) : [],
    }));
  }
}
