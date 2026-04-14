/**
 * 캐시 메트릭 테스트
 *
 * 내장 통계 수집 구현
 *
 * Acceptance Criteria:
 * - AC-007-1: 캐시 통계 API (getMetrics()) 구현
 * - AC-007-2: 콘솔 로그로 히트/미스 추적 가능
 * - AC-007-3: recordHit() - 히트 기록 정상 동작
 * - AC-007-4: recordMiss() - 미스 기록 정상 동작
 * - AC-007-5: getHitRate() - 히트율 계산 정확성
 *
 * @module cache-metrics.test
 */

import { CacheMetrics, CacheMetricsSnapshot, cacheMetrics, createCacheMetrics } from "../cache-metrics";

describe("캐시 메트릭", () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = createCacheMetrics();
  });

  /**
   * AC-007-1: 캐시 통계 API (getMetrics()) 구현
   */
  describe("AC-007-1: getMetrics() API", () => {
    it("초기 상태에서 모든 값이 0", () => {
      const snapshot = metrics.getMetrics();

      expect(snapshot.hits).toBe(0);
      expect(snapshot.misses).toBe(0);
      expect(snapshot.total).toBe(0);
      expect(snapshot.hitRate).toBe(0);
    });

    it("스냅샷은 불변 객체", () => {
      const snapshot1 = metrics.getMetrics();
      metrics.recordHit();
      const snapshot2 = metrics.getMetrics();

      // 이전 스냅샷은 변경되지 않음
      expect(snapshot1.hits).toBe(0);
      expect(snapshot2.hits).toBe(1);
    });

    it("스냅샷에 timestamp 포함", () => {
      const now = Date.now();
      const snapshot = metrics.getMetrics();

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.timestamp).toBeGreaterThanOrEqual(now - 100);
      expect(snapshot.timestamp).toBeLessThanOrEqual(now + 100);
    });

    it("스냅샷에 uptime 포함", () => {
      const snapshot = metrics.getMetrics();

      expect(snapshot.uptimeMs).toBeDefined();
      expect(snapshot.uptimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  /**
   * AC-007-2: 콘솔 로그로 히트/미스 추적 가능
   */
  describe("AC-007-2: 로그 추적", () => {
    it("히트 로깅 활성화 시 콘솔 출력", () => {
      const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

      const loggingMetrics = createCacheMetrics({ enableLogging: true });
      loggingMetrics.recordHit("test-query");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[CacheMetrics]"),
        expect.stringContaining("HIT"),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });

    it("미스 로깅 활성화 시 콘솔 출력", () => {
      const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

      const loggingMetrics = createCacheMetrics({ enableLogging: true });
      loggingMetrics.recordMiss("test-query");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[CacheMetrics]"),
        expect.stringContaining("MISS"),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });

    it("로깅 비활성화 시 콘솔 출력 없음", () => {
      const consoleSpy = jest.spyOn(console, "debug").mockImplementation();

      const silentMetrics = createCacheMetrics({ enableLogging: false });
      silentMetrics.recordHit();
      silentMetrics.recordMiss();

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("summary() 메서드로 현재 상태 로깅", () => {
      const consoleSpy = jest.spyOn(console, "info").mockImplementation();

      metrics.recordHit();
      metrics.recordHit();
      metrics.recordMiss();
      metrics.logSummary();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[CacheMetrics]"),
        expect.stringContaining("히트율"),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });
  });

  /**
   * AC-007-3: recordHit() - 히트 기록 정상 동작
   */
  describe("AC-007-3: recordHit()", () => {
    it("히트 카운트 증가", () => {
      expect(metrics.getMetrics().hits).toBe(0);

      metrics.recordHit();
      expect(metrics.getMetrics().hits).toBe(1);

      metrics.recordHit();
      expect(metrics.getMetrics().hits).toBe(2);
    });

    it("total도 함께 증가", () => {
      metrics.recordHit();
      metrics.recordHit();

      expect(metrics.getMetrics().total).toBe(2);
    });

    it("query 정보 포함 가능", () => {
      metrics.recordHit("Pod 목록 보여줘");

      // 내부 히스토리 확인
      const history = metrics.getRecentHits(10);
      expect(history).toHaveLength(1);
      expect(history[0].query).toBe("Pod 목록 보여줘");
    });

    it("리소스 타입 정보 포함 가능", () => {
      metrics.recordHit("Pod 상태", "Pod");

      const history = metrics.getRecentHits(10);
      expect(history[0].resourceKind).toBe("Pod");
    });

    it("응답 시간 기록 가능", () => {
      metrics.recordHit("빠른 응답", undefined, 50);

      const history = metrics.getRecentHits(10);
      expect(history[0].responseTimeMs).toBe(50);
    });

    it("연속 100회 히트 기록", () => {
      for (let i = 0; i < 100; i++) {
        metrics.recordHit();
      }

      expect(metrics.getMetrics().hits).toBe(100);
      expect(metrics.getMetrics().total).toBe(100);
    });
  });

  /**
   * AC-007-4: recordMiss() - 미스 기록 정상 동작
   */
  describe("AC-007-4: recordMiss()", () => {
    it("미스 카운트 증가", () => {
      expect(metrics.getMetrics().misses).toBe(0);

      metrics.recordMiss();
      expect(metrics.getMetrics().misses).toBe(1);

      metrics.recordMiss();
      expect(metrics.getMetrics().misses).toBe(2);
    });

    it("total도 함께 증가", () => {
      metrics.recordMiss();
      metrics.recordMiss();

      expect(metrics.getMetrics().total).toBe(2);
    });

    it("query 정보 포함 가능", () => {
      metrics.recordMiss("존재하지 않는 질문");

      const history = metrics.getRecentMisses(10);
      expect(history).toHaveLength(1);
      expect(history[0].query).toBe("존재하지 않는 질문");
    });

    it("미스 이유 기록 가능", () => {
      metrics.recordMiss("만료된 질문", "expired");

      const history = metrics.getRecentMisses(10);
      expect(history[0].reason).toBe("expired");
    });

    it("연속 100회 미스 기록", () => {
      for (let i = 0; i < 100; i++) {
        metrics.recordMiss();
      }

      expect(metrics.getMetrics().misses).toBe(100);
      expect(metrics.getMetrics().total).toBe(100);
    });
  });

  /**
   * AC-007-5: getHitRate() - 히트율 계산 정확성
   */
  describe("AC-007-5: getHitRate()", () => {
    it("total 0일 때 히트율 0", () => {
      expect(metrics.getHitRate()).toBe(0);
    });

    it("100% 히트율", () => {
      metrics.recordHit();
      metrics.recordHit();
      metrics.recordHit();

      expect(metrics.getHitRate()).toBe(1.0);
    });

    it("0% 히트율", () => {
      metrics.recordMiss();
      metrics.recordMiss();
      metrics.recordMiss();

      expect(metrics.getHitRate()).toBe(0);
    });

    it("50% 히트율", () => {
      metrics.recordHit();
      metrics.recordMiss();

      expect(metrics.getHitRate()).toBe(0.5);
    });

    it("60% 히트율", () => {
      // 6 hits, 4 misses = 60%
      for (let i = 0; i < 6; i++) metrics.recordHit();
      for (let i = 0; i < 4; i++) metrics.recordMiss();

      expect(metrics.getHitRate()).toBeCloseTo(0.6, 5);
    });

    it("대량 데이터에서 히트율 정확성", () => {
      // 400 hits, 600 misses = 40%
      for (let i = 0; i < 400; i++) metrics.recordHit();
      for (let i = 0; i < 600; i++) metrics.recordMiss();

      expect(metrics.getHitRate()).toBeCloseTo(0.4, 5);
    });

    it("getMetrics().hitRate와 getHitRate() 일치", () => {
      for (let i = 0; i < 3; i++) metrics.recordHit();
      for (let i = 0; i < 2; i++) metrics.recordMiss();

      expect(metrics.getMetrics().hitRate).toBe(metrics.getHitRate());
    });
  });

  /**
   * 추가 테스트: 리셋 기능
   */
  describe("리셋 기능", () => {
    it("reset()으로 모든 카운터 초기화", () => {
      metrics.recordHit();
      metrics.recordHit();
      metrics.recordMiss();

      metrics.reset();

      expect(metrics.getMetrics().hits).toBe(0);
      expect(metrics.getMetrics().misses).toBe(0);
      expect(metrics.getMetrics().total).toBe(0);
    });

    it("reset() 후 히스토리도 초기화", () => {
      metrics.recordHit("query1");
      metrics.recordMiss("query2");

      metrics.reset();

      expect(metrics.getRecentHits(10)).toHaveLength(0);
      expect(metrics.getRecentMisses(10)).toHaveLength(0);
    });
  });

  /**
   * 추가 테스트: 히스토리 관리
   */
  describe("히스토리 관리", () => {
    it("최근 N개 히트 조회", () => {
      for (let i = 0; i < 5; i++) {
        metrics.recordHit(`query-${i}`);
      }

      const recent = metrics.getRecentHits(3);
      expect(recent).toHaveLength(3);
      // 최신순
      expect(recent[0].query).toBe("query-4");
      expect(recent[2].query).toBe("query-2");
    });

    it("최근 N개 미스 조회", () => {
      for (let i = 0; i < 5; i++) {
        metrics.recordMiss(`query-${i}`);
      }

      const recent = metrics.getRecentMisses(3);
      expect(recent).toHaveLength(3);
      // 최신순
      expect(recent[0].query).toBe("query-4");
    });

    it("히스토리 최대 크기 제한 (100개)", () => {
      for (let i = 0; i < 150; i++) {
        metrics.recordHit(`query-${i}`);
      }

      const history = metrics.getRecentHits(200);
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  /**
   * 추가 테스트: 리소스별 통계
   */
  describe("리소스별 통계", () => {
    it("리소스별 히트/미스 집계", () => {
      metrics.recordHit("Pod 1", "Pod");
      metrics.recordHit("Pod 2", "Pod");
      metrics.recordMiss("Pod 3", "Pod");
      metrics.recordHit("Svc 1", "Service");
      metrics.recordMiss("Svc 2", "Service");

      const byResource = metrics.getMetricsByResource();

      expect(byResource.Pod.hits).toBe(2);
      expect(byResource.Pod.misses).toBe(1);
      expect(byResource.Service.hits).toBe(1);
      expect(byResource.Service.misses).toBe(1);
    });

    it("리소스별 히트율 계산", () => {
      for (let i = 0; i < 8; i++) metrics.recordHit(`Pod ${i}`, "Pod");
      for (let i = 0; i < 2; i++) metrics.recordMiss(`Pod miss ${i}`, "Pod");

      const byResource = metrics.getMetricsByResource();

      expect(byResource.Pod.hitRate).toBe(0.8); // 8/10 = 80%
    });
  });

  /**
   * 싱글톤 인스턴스 테스트
   */
  describe("싱글톤 인스턴스", () => {
    it("cacheMetrics 싱글톤 존재", () => {
      expect(cacheMetrics).toBeDefined();
      expect(cacheMetrics.getMetrics).toBeDefined();
      expect(cacheMetrics.recordHit).toBeDefined();
      expect(cacheMetrics.recordMiss).toBeDefined();
    });
  });

  /**
   * 통합 시나리오
   */
  describe("통합 시나리오", () => {
    it("실제 사용 시나리오 시뮬레이션", () => {
      // 시나리오: 10개 요청 중 6개 캐시 히트

      // 첫 번째 요청 - 미스 (캐시 비어있음)
      metrics.recordMiss("Pod 목록", "Pod");

      // 두 번째 요청 - 히트 (캐싱됨)
      metrics.recordHit("Pod 목록", "Pod", 5);

      // 세 번째 요청 - 미스 (새 질문)
      metrics.recordMiss("Deployment 상태", "Deployment");

      // 네 번째 요청 - 히트
      metrics.recordHit("Deployment 상태", "Deployment", 3);

      // 나머지 요청들
      metrics.recordHit("Pod 목록", "Pod", 2);
      metrics.recordHit("Service 목록", "Service", 4);
      metrics.recordMiss("ConfigMap 조회", "ConfigMap");
      metrics.recordHit("ConfigMap 조회", "ConfigMap", 6);
      metrics.recordMiss("새로운 질문");
      metrics.recordHit("Pod 목록", "Pod", 1);

      const snapshot = metrics.getMetrics();

      expect(snapshot.total).toBe(10);
      expect(snapshot.hits).toBe(6);
      expect(snapshot.misses).toBe(4);
      expect(snapshot.hitRate).toBe(0.6);
    });
  });
});
