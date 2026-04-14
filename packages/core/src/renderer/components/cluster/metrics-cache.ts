/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 시계열 메트릭 데이터 포인트 타입 (캐시용)
 */
export interface TimeSeriesDataPoint {
  timestamp: number;
  value: number;
}

/**
 * 🔄 목적: 메트릭 캐시 구조 타입
 */
export interface MetricsCache {
  dataPoints: TimeSeriesDataPoint[];
  lastCollectedTime: number;
}

/**
 * 🔥 전역 메모리 캐시 (앱 실행 중 유지)
 *
 * 📝 사용 예시:
 * - globalMetricsCache.get("master-cpu") → Master 노드 CPU 메트릭
 * - globalMetricsCache.get("worker-memory") → Worker 노드 Memory 메트릭
 *
 * 🛡️ 메모리 관리:
 * - 최대 60개 포인트만 유지 (약 1시간)
 * - 앱 종료 시 자동 삭제
 *
 * 🔄 변경이력:
 * - 2025-11-06 - 초기 생성 (ClusterMetrics에서 분리)
 * - 2025-11-06 - Metrics Server 지원을 위한 시계열 축적 로직
 */
export const globalMetricsCache = new Map<string, MetricsCache>();

/**
 * 🗑️ 프로그램 종료 시 전역 캐시 정리
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    globalMetricsCache.clear();
  });
}
