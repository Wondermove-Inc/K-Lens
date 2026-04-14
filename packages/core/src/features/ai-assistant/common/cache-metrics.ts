/**
 * 캐시 메트릭 수집기
 *
 * 내장 통계 수집 구현
 *
 * 캐시 히트/미스를 추적하고 통계를 제공합니다.
 * 콘솔 로그 출력 기능과 리소스별 통계 집계를 지원합니다.
 *
 * Acceptance Criteria:
 * - AC-007-1: 캐시 통계 API (getMetrics()) 구현 ✅
 * - AC-007-2: 콘솔 로그로 히트/미스 추적 가능 ✅
 * - AC-007-3: recordHit() - 히트 기록 정상 동작 ✅
 * - AC-007-4: recordMiss() - 미스 기록 정상 동작 ✅
 * - AC-007-5: getHitRate() - 히트율 계산 정확성 ✅
 *
 * @module cache-metrics
 */

/**
 * 캐시 메트릭 스냅샷 인터페이스
 *
 * 특정 시점의 캐시 통계 스냅샷입니다.
 */
export interface CacheMetricsSnapshot {
  /**
   * 캐시 히트 횟수
   */
  hits: number;

  /**
   * 캐시 미스 횟수
   */
  misses: number;

  /**
   * 총 요청 횟수 (hits + misses)
   */
  total: number;

  /**
   * 캐시 히트율 (0.0 ~ 1.0)
   */
  hitRate: number;

  /**
   * 스냅샷 생성 시각 (Unix timestamp, ms)
   */
  timestamp: number;

  /**
   * 메트릭 수집 시작 후 경과 시간 (ms)
   */
  uptimeMs: number;
}

/**
 * 히트/미스 이력 항목 인터페이스
 */
export interface MetricsHistoryItem {
  /**
   * 쿼리 문자열
   */
  query?: string;

  /**
   * 리소스 종류
   */
  resourceKind?: string;

  /**
   * 응답 시간 (ms, 히트 시에만)
   */
  responseTimeMs?: number;

  /**
   * 미스 이유 (미스 시에만)
   */
  reason?: string;

  /**
   * 기록 시각
   */
  timestamp: number;
}

/**
 * 리소스별 메트릭 인터페이스
 */
export interface ResourceMetrics {
  /**
   * 히트 횟수
   */
  hits: number;

  /**
   * 미스 횟수
   */
  misses: number;

  /**
   * 히트율 (0.0 ~ 1.0)
   */
  hitRate: number;
}

/**
 * 캐시 메트릭 설정 인터페이스
 */
export interface CacheMetricsOptions {
  /**
   * 로깅 활성화 여부
   */
  enableLogging?: boolean;

  /**
   * 히스토리 최대 크기
   */
  maxHistorySize?: number;
}

/**
 * 기본 히스토리 최대 크기
 */
const DEFAULT_MAX_HISTORY_SIZE = 100;

/**
 * 캐시 메트릭 수집기 클래스
 *
 * 캐시 히트/미스를 추적하고 통계를 제공합니다.
 *
 * @example
 * ```typescript
 * const metrics = createCacheMetrics({ enableLogging: true });
 *
 * // 히트 기록
 * metrics.recordHit("Pod 목록", "Pod", 10);
 *
 * // 미스 기록
 * metrics.recordMiss("새 질문");
 *
 * // 통계 조회
 * const snapshot = metrics.getMetrics();
 * console.log(`히트율: ${snapshot.hitRate * 100}%`);
 *
 * // 리소스별 통계
 * const byResource = metrics.getMetricsByResource();
 * console.log(`Pod 히트율: ${byResource.Pod.hitRate * 100}%`);
 * ```
 */
export class CacheMetrics {
  /**
   * 히트 카운트
   */
  private hits = 0;

  /**
   * 미스 카운트
   */
  private misses = 0;

  /**
   * 시작 시각
   */
  private readonly startTime: number;

  /**
   * 로깅 활성화 여부
   */
  private readonly enableLogging: boolean;

  /**
   * 히스토리 최대 크기
   */
  private readonly maxHistorySize: number;

  /**
   * 히트 히스토리
   */
  private hitHistory: MetricsHistoryItem[] = [];

  /**
   * 미스 히스토리
   */
  private missHistory: MetricsHistoryItem[] = [];

  /**
   * 리소스별 카운터
   */
  private resourceStats: Record<string, { hits: number; misses: number }> = {};

  /**
   * CacheMetrics 생성자
   *
   * @param options 메트릭 설정
   */
  constructor(options?: CacheMetricsOptions) {
    this.startTime = Date.now();
    this.enableLogging = options?.enableLogging ?? false;
    this.maxHistorySize = options?.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
  }

  /**
   * 캐시 히트 기록
   *
   * @param query 쿼리 문자열 (선택)
   * @param resourceKind 리소스 종류 (선택)
   * @param responseTimeMs 응답 시간 (선택)
   */
  recordHit(query?: string, resourceKind?: string, responseTimeMs?: number): void {
    this.hits++;

    // 히스토리 추가
    const item: MetricsHistoryItem = {
      query,
      resourceKind,
      responseTimeMs,
      timestamp: Date.now(),
    };
    this.addToHistory(this.hitHistory, item);

    // 리소스별 카운터 업데이트
    if (resourceKind) {
      this.ensureResourceStats(resourceKind);
      this.resourceStats[resourceKind].hits++;
    }

    // 로깅
    if (this.enableLogging) {
      console.debug("[CacheMetrics]", "HIT", { query, resourceKind, responseTimeMs });
    }
  }

  /**
   * 캐시 미스 기록
   *
   * @param query 쿼리 문자열 (선택)
   * @param reasonOrResourceKind 미스 이유 또는 리소스 종류 (선택)
   */
  recordMiss(query?: string, reasonOrResourceKind?: string): void {
    this.misses++;

    // 리소스 종류 또는 이유 판별
    let resourceKind: string | undefined;
    let reason: string | undefined;

    if (reasonOrResourceKind) {
      // 알려진 리소스 타입인지 확인
      const knownResources = [
        "Pod",
        "Deployment",
        "Service",
        "ConfigMap",
        "Secret",
        "Node",
        "Namespace",
        "Event",
        "ReplicaSet",
        "StatefulSet",
        "DaemonSet",
      ];
      if (knownResources.includes(reasonOrResourceKind)) {
        resourceKind = reasonOrResourceKind;
      } else {
        reason = reasonOrResourceKind;
      }
    }

    // 리소스 종류가 없으면 쿼리에서 추출 시도
    if (!resourceKind) {
      resourceKind = this.extractResourceKind(query);
    }

    // 히스토리 추가
    const item: MetricsHistoryItem = {
      query,
      resourceKind,
      reason,
      timestamp: Date.now(),
    };
    this.addToHistory(this.missHistory, item);

    // 리소스별 카운터 업데이트
    if (resourceKind) {
      this.ensureResourceStats(resourceKind);
      this.resourceStats[resourceKind].misses++;
    }

    // 로깅
    if (this.enableLogging) {
      console.debug("[CacheMetrics]", "MISS", { query, resourceKind, reason });
    }
  }

  /**
   * 캐시 히트율 조회
   *
   * @returns 히트율 (0.0 ~ 1.0)
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  /**
   * 캐시 메트릭 스냅샷 조회
   *
   * @returns 현재 메트릭 스냅샷
   */
  getMetrics(): CacheMetricsSnapshot {
    const now = Date.now();
    const total = this.hits + this.misses;

    return {
      hits: this.hits,
      misses: this.misses,
      total,
      hitRate: this.getHitRate(),
      timestamp: now,
      uptimeMs: now - this.startTime,
    };
  }

  /**
   * 최근 히트 히스토리 조회
   *
   * @param count 조회할 개수
   * @returns 최근 히트 목록 (최신순)
   */
  getRecentHits(count: number): MetricsHistoryItem[] {
    return this.hitHistory.slice(-count).reverse();
  }

  /**
   * 최근 미스 히스토리 조회
   *
   * @param count 조회할 개수
   * @returns 최근 미스 목록 (최신순)
   */
  getRecentMisses(count: number): MetricsHistoryItem[] {
    return this.missHistory.slice(-count).reverse();
  }

  /**
   * 리소스별 메트릭 조회
   *
   * @returns 리소스별 히트/미스 통계
   */
  getMetricsByResource(): Record<string, ResourceMetrics> {
    const result: Record<string, ResourceMetrics> = {};

    for (const [resource, stats] of Object.entries(this.resourceStats)) {
      const total = stats.hits + stats.misses;
      result[resource] = {
        hits: stats.hits,
        misses: stats.misses,
        hitRate: total > 0 ? stats.hits / total : 0,
      };
    }

    return result;
  }

  /**
   * 현재 상태 로그 출력
   */
  logSummary(): void {
    const snapshot = this.getMetrics();
    console.info("[CacheMetrics]", `히트율: ${(snapshot.hitRate * 100).toFixed(1)}%`, {
      hits: snapshot.hits,
      misses: snapshot.misses,
      total: snapshot.total,
      uptimeMs: snapshot.uptimeMs,
    });
  }

  /**
   * 메트릭 초기화
   */
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.hitHistory = [];
    this.missHistory = [];
    this.resourceStats = {};
  }

  /**
   * 히스토리에 항목 추가 (최대 크기 유지)
   *
   * @param history 히스토리 배열
   * @param item 추가할 항목
   * @private
   */
  private addToHistory(history: MetricsHistoryItem[], item: MetricsHistoryItem): void {
    history.push(item);

    // 최대 크기 초과 시 오래된 항목 제거
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * 리소스별 카운터 초기화 보장
   *
   * @param resourceKind 리소스 종류
   * @private
   */
  private ensureResourceStats(resourceKind: string): void {
    if (!this.resourceStats[resourceKind]) {
      this.resourceStats[resourceKind] = { hits: 0, misses: 0 };
    }
  }

  /**
   * 쿼리에서 리소스 종류 추출 시도
   *
   * @param query 쿼리 문자열
   * @returns 리소스 종류 또는 undefined
   * @private
   */
  private extractResourceKind(query?: string): string | undefined {
    if (!query) return undefined;

    const resourcePatterns = [
      "Pod",
      "Deployment",
      "Service",
      "ConfigMap",
      "Secret",
      "Node",
      "Namespace",
      "Event",
      "ReplicaSet",
      "StatefulSet",
      "DaemonSet",
    ];

    for (const resource of resourcePatterns) {
      if (query.toLowerCase().includes(resource.toLowerCase())) {
        return resource;
      }
    }

    return undefined;
  }
}

/**
 * CacheMetrics 팩토리 함수
 *
 * @param options 메트릭 설정
 * @returns 새 CacheMetrics 인스턴스
 */
export function createCacheMetrics(options?: CacheMetricsOptions): CacheMetrics {
  return new CacheMetrics(options);
}

/**
 * 싱글톤 캐시 메트릭 인스턴스
 *
 * 앱 전체에서 공유하는 캐시 메트릭입니다.
 *
 * @example
 * ```typescript
 * import { cacheMetrics } from "./cache-metrics";
 *
 * cacheMetrics.recordHit("Pod 목록");
 * console.log(`히트율: ${cacheMetrics.getHitRate() * 100}%`);
 * ```
 */
export const cacheMetrics = new CacheMetrics();
