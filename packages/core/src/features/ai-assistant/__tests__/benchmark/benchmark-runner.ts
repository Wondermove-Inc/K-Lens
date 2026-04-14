/**
 * 벤치마크 러너
 *
 * E2E 테스트 및 성능 검증
 *
 * 성능 벤치마크를 실행하고 결과를 수집합니다.
 *
 * @module benchmark-runner
 */

/**
 * 벤치마크 구성 인터페이스
 */
export interface BenchmarkConfig {
  /**
   * 벤치마크 이름
   */
  name: string;

  /**
   * 반복 횟수
   */
  iterations: number;

  /**
   * 워밍업 횟수
   */
  warmupIterations?: number;

  /**
   * 시간 제한 (ms)
   */
  timeoutMs?: number;
}

/**
 * 벤치마크 결과 인터페이스
 */
export interface BenchmarkResult {
  /**
   * 벤치마크 이름
   */
  name: string;

  /**
   * 반복 횟수
   */
  iterations: number;

  /**
   * 총 실행 시간 (ms)
   */
  totalTimeMs: number;

  /**
   * 평균 실행 시간 (ms)
   */
  avgTimeMs: number;

  /**
   * 최소 실행 시간 (ms)
   */
  minTimeMs: number;

  /**
   * 최대 실행 시간 (ms)
   */
  maxTimeMs: number;

  /**
   * P50 (중앙값) 실행 시간 (ms)
   */
  p50TimeMs: number;

  /**
   * P90 실행 시간 (ms)
   */
  p90TimeMs: number;

  /**
   * P99 실행 시간 (ms)
   */
  p99TimeMs: number;

  /**
   * 초당 작업 수 (ops/sec)
   */
  opsPerSecond: number;

  /**
   * 개별 실행 시간들
   */
  times: number[];

  /**
   * 성공 여부
   */
  success: boolean;

  /**
   * 에러 메시지 (실패 시)
   */
  error?: string;
}

/**
 * 벤치마크 러너 클래스
 *
 * 성능 측정을 위한 벤치마크를 실행합니다.
 *
 * @example
 * ```typescript
 * const runner = new BenchmarkRunner();
 *
 * const result = runner.run({
 *   name: "캐시 히트",
 *   iterations: 1000,
 *   warmupIterations: 100,
 * }, () => {
 *   cache.get("key");
 * });
 *
 * console.log(`P90: ${result.p90TimeMs}ms`);
 * ```
 */
export class BenchmarkRunner {
  /**
   * 벤치마크 실행
   *
   * @param config 벤치마크 구성
   * @param fn 측정할 함수
   * @returns 벤치마크 결과
   */
  run(config: BenchmarkConfig, fn: () => void): BenchmarkResult {
    const { name, iterations, warmupIterations = 10, timeoutMs = 60000 } = config;

    try {
      // 워밍업
      for (let i = 0; i < warmupIterations; i++) {
        fn();
      }

      // 측정
      const times: number[] = [];
      const startTotal = performance.now();

      for (let i = 0; i < iterations; i++) {
        // 타임아웃 체크
        if (performance.now() - startTotal > timeoutMs) {
          throw new Error(`Benchmark timeout after ${i} iterations`);
        }

        const start = performance.now();
        fn();
        times.push(performance.now() - start);
      }

      const totalTimeMs = performance.now() - startTotal;

      return this.calculateStats(name, iterations, times, totalTimeMs);
    } catch (error) {
      return {
        name,
        iterations,
        totalTimeMs: 0,
        avgTimeMs: 0,
        minTimeMs: 0,
        maxTimeMs: 0,
        p50TimeMs: 0,
        p90TimeMs: 0,
        p99TimeMs: 0,
        opsPerSecond: 0,
        times: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 비동기 벤치마크 실행
   *
   * @param config 벤치마크 구성
   * @param fn 측정할 비동기 함수
   * @returns 벤치마크 결과
   */
  async runAsync(config: BenchmarkConfig, fn: () => Promise<void>): Promise<BenchmarkResult> {
    const { name, iterations, warmupIterations = 10, timeoutMs = 60000 } = config;

    try {
      // 워밍업
      for (let i = 0; i < warmupIterations; i++) {
        await fn();
      }

      // 측정
      const times: number[] = [];
      const startTotal = performance.now();

      for (let i = 0; i < iterations; i++) {
        // 타임아웃 체크
        if (performance.now() - startTotal > timeoutMs) {
          throw new Error(`Benchmark timeout after ${i} iterations`);
        }

        const start = performance.now();
        await fn();
        times.push(performance.now() - start);
      }

      const totalTimeMs = performance.now() - startTotal;

      return this.calculateStats(name, iterations, times, totalTimeMs);
    } catch (error) {
      return {
        name,
        iterations,
        totalTimeMs: 0,
        avgTimeMs: 0,
        minTimeMs: 0,
        maxTimeMs: 0,
        p50TimeMs: 0,
        p90TimeMs: 0,
        p99TimeMs: 0,
        opsPerSecond: 0,
        times: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 통계 계산
   *
   * @param name 벤치마크 이름
   * @param iterations 반복 횟수
   * @param times 개별 실행 시간들
   * @param totalTimeMs 총 실행 시간
   * @returns 벤치마크 결과
   * @private
   */
  private calculateStats(name: string, iterations: number, times: number[], totalTimeMs: number): BenchmarkResult {
    const sorted = [...times].sort((a, b) => a - b);

    const sum = times.reduce((a, b) => a + b, 0);
    const avgTimeMs = sum / times.length;
    const minTimeMs = sorted[0] || 0;
    const maxTimeMs = sorted[sorted.length - 1] || 0;
    const p50TimeMs = this.percentile(sorted, 0.5);
    const p90TimeMs = this.percentile(sorted, 0.9);
    const p99TimeMs = this.percentile(sorted, 0.99);
    const opsPerSecond = (iterations / totalTimeMs) * 1000;

    return {
      name,
      iterations,
      totalTimeMs,
      avgTimeMs,
      minTimeMs,
      maxTimeMs,
      p50TimeMs,
      p90TimeMs,
      p99TimeMs,
      opsPerSecond,
      times,
      success: true,
    };
  }

  /**
   * 백분위수 계산
   *
   * @param sorted 정렬된 배열
   * @param p 백분위 (0.0 ~ 1.0)
   * @returns 백분위수 값
   * @private
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.floor(sorted.length * p);
    return sorted[Math.min(index, sorted.length - 1)];
  }
}

/**
 * 싱글톤 벤치마크 러너 인스턴스
 */
export const benchmarkRunner = new BenchmarkRunner();
