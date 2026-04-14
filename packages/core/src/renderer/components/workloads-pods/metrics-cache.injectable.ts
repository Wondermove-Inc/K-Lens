/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";

import type { Pod } from "@skuberplus/kube-object";

export interface MetricDataPoint {
  timestamp: number;
  cpu: number;
  memory: number;
}

export interface PodMetricsCache {
  podId: string;
  dataPoints: MetricDataPoint[];
  maxPoints: number;
  lastUpdate: number;
}

/**
 * 🎯 목적: Pod 상세 화면에서 시간별 메트릭 데이터를 메모리에 캐시하여 그래프 표시
 *
 * 📝 주요 기능:
 * - 각 Pod별로 메트릭 데이터 포인트들을 시간순으로 저장
 * - 최대 저장 개수 제한 (메모리 관리)
 * - 프로그램 종료 시 자동으로 데이터 삭제 (메모리 기반)
 *
 * 🔄 변경이력: 2025-09-26 - 초기 생성 (Pod 실시간 메트릭 캐시 시스템)
 */
class PodMetricsCacheService {
  private cache = new Map<string, PodMetricsCache>();
  private readonly DEFAULT_MAX_POINTS = 100; // 🎯 최근 100개 데이터 포인트만 유지
  private readonly CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 🔄 5분마다 정리

  constructor() {
    // 🧹 주기적으로 오래된 캐시 정리
    setInterval(() => {
      this.cleanupOldCaches();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  /**
   * 🔥 핵심: Pod의 새로운 메트릭 데이터 포인트 추가
   */
  addMetricDataPoint(pod: Pod, cpu: number, memory: number): void {
    const podId = pod.getId();
    const timestamp = Date.now();

    let podCache = this.cache.get(podId);

    if (!podCache) {
      // 🆕 새 Pod의 캐시 생성
      podCache = {
        podId,
        dataPoints: [],
        maxPoints: this.DEFAULT_MAX_POINTS,
        lastUpdate: timestamp,
      };
      this.cache.set(podId, podCache);
    }

    // 🔄 새 데이터 포인트 추가
    podCache.dataPoints.push({
      timestamp,
      cpu,
      memory,
    });

    // 🛡️ 최대 개수 초과 시 오래된 데이터 제거
    if (podCache.dataPoints.length > podCache.maxPoints) {
      podCache.dataPoints.shift();
    }

    podCache.lastUpdate = timestamp;
  }

  /**
   * 🔍 특정 Pod의 모든 메트릭 데이터 포인트 조회
   */
  getMetricDataPoints(pod: Pod): MetricDataPoint[] {
    const podCache = this.cache.get(pod.getId());
    return podCache ? [...podCache.dataPoints] : [];
  }

  /**
   * 🔍 최근 메트릭 값 조회 (수집 실패 시 보간용)
   */
  getLastValues(pod: Pod): { cpu: number; memory: number } | null {
    const dataPoints = this.getMetricDataPoints(pod);
    if (dataPoints.length === 0) {
      return null;
    }

    const lastPoint = dataPoints[dataPoints.length - 1];
    return { cpu: lastPoint.cpu, memory: lastPoint.memory };
  }

  /**
   * 📈 차트용 CPU 데이터 포맷으로 변환
   */
  getCpuChartData(pod: Pod): Array<[number, string]> {
    const dataPoints = this.getMetricDataPoints(pod);
    return dataPoints.map((point) => [
      Math.floor(point.timestamp / 1000), // 초 단위로 변환
      point.cpu.toString(),
    ]);
  }

  /**
   * 📈 차트용 Memory 데이터 포맷으로 변환
   */
  getMemoryChartData(pod: Pod): Array<[number, string]> {
    const dataPoints = this.getMetricDataPoints(pod);
    return dataPoints.map((point) => [
      Math.floor(point.timestamp / 1000), // 초 단위로 변환
      point.memory.toString(),
    ]);
  }

  /**
   * 🧹 특정 Pod의 캐시 삭제
   */
  clearPodCache(pod: Pod): void {
    const podId = pod.getId();
    if (this.cache.has(podId)) {
      this.cache.delete(podId);
    }
  }

  /**
   * 🗑️ 모든 캐시 삭제
   */
  clearAllCaches(): void {
    this.cache.clear();
  }

  /**
   * 🧹 오래된 캐시 자동 정리 (5분 이상 업데이트 없는 캐시)
   */
  private cleanupOldCaches(): void {
    const now = Date.now();
    const expiredCaches: string[] = [];

    this.cache.forEach((podCache, podId) => {
      const timeSinceLastUpdate = now - podCache.lastUpdate;
      if (timeSinceLastUpdate > this.CACHE_CLEANUP_INTERVAL) {
        expiredCaches.push(podId);
      }
    });

    expiredCaches.forEach((podId) => {
      this.cache.delete(podId);
    });

    if (expiredCaches.length > 0) {
    }
  }

  /**
   * 📊 현재 캐시 상태 정보
   */
  getCacheStats(): { totalPods: number; totalDataPoints: number } {
    let totalDataPoints = 0;
    this.cache.forEach((podCache) => {
      totalDataPoints += podCache.dataPoints.length;
    });

    return {
      totalPods: this.cache.size,
      totalDataPoints,
    };
  }
}

const podMetricsCacheInjectable = getInjectable({
  id: "pod-metrics-cache",
  instantiate: () => new PodMetricsCacheService(),
});

export default podMetricsCacheInjectable;
