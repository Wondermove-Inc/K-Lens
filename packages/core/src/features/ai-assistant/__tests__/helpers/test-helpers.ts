/**
 * E2E 테스트 공통 헬퍼 유틸리티
 *
 * @module test-helpers
 */

/**
 * 토큰 비용 계산 결과
 */
export interface TokenCostResult {
  originalTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savingsPercentage: number;
}

/**
 * 성능 측정 결과
 */
export interface PerformanceResult {
  cacheHitTimes: number[];
  cacheMissTimes: number[];
  p90HitTime: number;
  p90MissTime: number;
  avgHitTime: number;
  avgMissTime: number;
}

/**
 * 진단 정확도 결과
 */
export interface DiagnosisAccuracyResult {
  totalTests: number;
  correctDetections: number;
  falseNegatives: number;
  falsePositives: number;
  accuracy: number;
}

/**
 * 토큰 비용 절감 계산
 *
 * @param originalResponse - 원본 응답 문자열
 * @param optimizedResponse - 최적화된 응답 문자열
 * @returns 토큰 비용 계산 결과
 */
export function calculateTokenSavings(originalResponse: string, optimizedResponse: string): TokenCostResult {
  // 단순화된 토큰 추정 (4자당 1토큰)
  const originalTokens = Math.ceil(originalResponse.length / 4);
  const optimizedTokens = Math.ceil(optimizedResponse.length / 4);
  const savedTokens = originalTokens - optimizedTokens;
  const savingsPercentage = (savedTokens / originalTokens) * 100;

  return {
    originalTokens,
    optimizedTokens,
    savedTokens,
    savingsPercentage,
  };
}

/**
 * P90 값 계산
 *
 * @param values - 측정값 배열
 * @returns P90 값 (90번째 백분위수)
 */
export function calculateP90(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.9);
  return sorted[Math.min(index, sorted.length - 1)];
}
