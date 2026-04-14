/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";

import type { KubeObject } from "@skuberplus/kube-object";

/**
 * 🎯 목적: 시계열 메트릭 데이터 포인트 타입
 */
export interface MetricDataPoint {
  timestamp: number;
  cpu: number;
  memory: number;
}

/**
 * 🔄 목적: 리소스별 메트릭 캐시 구조
 */
export interface ResourceMetricsCache {
  resourceId: string;
  dataPoints: MetricDataPoint[];
  maxPoints: number;
  lastUpdate: number;
}

/**
 * 🎯 목적: 모든 Kubernetes 리소스의 메트릭 데이터를 캐시하는 공통 서비스
 *
 * 📝 주요 기능:
 * - KubeObject: Node, Deployment, StatefulSet 등 모든 리소스 타입 지원
 * - 하위 객체: Container 등 문자열 ID로 식별되는 객체 지원
 * - 각 리소스별로 메트릭 데이터 포인트들을 시간순으로 저장
 * - 최대 저장 개수 제한 (메모리 관리)
 * - 5분 이상 업데이트 없는 캐시 자동 정리
 *
 * 🔄 변경이력:
 * - 2025-11-06: 초기 생성 (모든 리소스 타입 지원 공통 캐시)
 * - 2025-11-07: Container 등 하위 객체 지원 (string ID 오버로드 추가)
 */
class GenericMetricsCacheService {
  private cache = new Map<string, ResourceMetricsCache>();
  private readonly DEFAULT_MAX_POINTS = 100; // 🎯 최근 100개 데이터 포인트만 유지
  private readonly CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 🔄 5분마다 정리
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor() {
    // 🧹 주기적으로 오래된 캐시 정리
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupOldCaches();
    }, this.CACHE_CLEANUP_INTERVAL);

    // 🗑️ 프로그램 종료 시 정리 작업 수행
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.cleanup();
      });
    }
  }

  /**
   * 🔥 핵심: 리소스의 새로운 메트릭 데이터 포인트 추가 (15초 버킷팅 적용)
   *
   * @remarks
   * - 15초 단위로 timestamp를 반올림하여 그래프가 끊어지지 않도록 함
   * - 같은 15초 버킷에 여러 데이터가 들어오면 평균값으로 병합
   * - 클러스터 오버뷰의 upsertMinuteBucketAverage와 동일한 패턴
   *
   * @param resource - KubeObject 또는 문자열 ID (Container 등 하위 객체용)
   * @param cpu - CPU 사용량
   * @param memory - Memory 사용량
   *
   * 🔄 변경이력: 2026-01-26 - 15초 버킷팅 적용 (그래프 끊김 문제 해결)
   */
  addMetricDataPoint(resource: KubeObject | string, cpu: number, memory: number): void {
    const resourceId = typeof resource === "string" ? resource : resource.getId();
    const now = Date.now();
    // 🎯 15초 단위로 반올림 (15000ms = 15초)
    const bucketTimestamp = Math.round(now / 15000) * 15000;

    let resourceCache = this.cache.get(resourceId);

    if (!resourceCache) {
      // 🆕 새 리소스의 캐시 생성
      resourceCache = {
        resourceId,
        dataPoints: [],
        maxPoints: this.DEFAULT_MAX_POINTS,
        lastUpdate: now,
      };
      this.cache.set(resourceId, resourceCache);
    }

    // 🔍 같은 15초 버킷에 이미 데이터가 있는지 확인
    const existingIndex = resourceCache.dataPoints.findIndex(
      (point) => Math.round(point.timestamp / 15000) * 15000 === bucketTimestamp,
    );

    if (existingIndex !== -1) {
      // 🔄 기존 버킷의 데이터와 평균값으로 병합
      const existingPoint = resourceCache.dataPoints[existingIndex];
      resourceCache.dataPoints[existingIndex] = {
        timestamp: bucketTimestamp,
        cpu: (existingPoint.cpu + cpu) / 2,
        memory: (existingPoint.memory + memory) / 2,
      };
    } else {
      // 🆕 새 데이터 포인트 추가
      resourceCache.dataPoints.push({
        timestamp: bucketTimestamp,
        cpu,
        memory,
      });

      // 🛡️ 최대 개수 초과 시 오래된 데이터 제거
      if (resourceCache.dataPoints.length > resourceCache.maxPoints) {
        resourceCache.dataPoints.shift();
      }
    }

    resourceCache.lastUpdate = now;
  }

  /**
   * 🔍 특정 리소스의 모든 메트릭 데이터 포인트 조회
   */
  getMetricDataPoints(resource: KubeObject | string): MetricDataPoint[] {
    const resourceId = typeof resource === "string" ? resource : resource.getId();
    const resourceCache = this.cache.get(resourceId);
    return resourceCache ? [...resourceCache.dataPoints] : [];
  }

  /**
   * 🔍 최근 메트릭 값 조회 (수집 실패 시 보간용)
   */
  getLastValues(resource: KubeObject | string): { cpu: number; memory: number } | null {
    const dataPoints = this.getMetricDataPoints(resource);
    if (dataPoints.length === 0) {
      return null;
    }

    const lastPoint = dataPoints[dataPoints.length - 1];
    return { cpu: lastPoint.cpu, memory: lastPoint.memory };
  }

  /**
   * 📈 차트용 CPU 데이터 포맷으로 변환 (Prometheus 형식)
   */
  getCpuChartData(resource: KubeObject | string): Array<[number, string]> {
    const dataPoints = this.getMetricDataPoints(resource);
    return dataPoints.map((point) => [
      Math.floor(point.timestamp / 1000), // 초 단위로 변환
      point.cpu.toString(),
    ]);
  }

  /**
   * 📈 차트용 Memory 데이터 포맷으로 변환 (Prometheus 형식)
   */
  getMemoryChartData(resource: KubeObject | string): Array<[number, string]> {
    const dataPoints = this.getMetricDataPoints(resource);
    return dataPoints.map((point) => [
      Math.floor(point.timestamp / 1000), // 초 단위로 변환
      point.memory.toString(),
    ]);
  }

  /**
   * 🧹 특정 리소스의 캐시 삭제
   */
  clearResourceCache(resource: KubeObject | string): void {
    const resourceId = typeof resource === "string" ? resource : resource.getId();

    if (this.cache.has(resourceId)) {
      this.cache.delete(resourceId);
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

    this.cache.forEach((resourceCache, resourceId) => {
      const timeSinceLastUpdate = now - resourceCache.lastUpdate;
      if (timeSinceLastUpdate > this.CACHE_CLEANUP_INTERVAL) {
        expiredCaches.push(resourceId);
      }
    });

    expiredCaches.forEach((resourceId) => {
      this.cache.delete(resourceId);
    });

    if (expiredCaches.length > 0) {
    }
  }

  /**
   * 🗑️ 정리 작업 (프로그램 종료 시 호출)
   */
  private cleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    this.clearAllCaches();
  }

  /**
   * 📊 현재 캐시 상태 정보
   */
  getCacheStats(): { totalResources: number; totalDataPoints: number } {
    let totalDataPoints = 0;
    this.cache.forEach((resourceCache) => {
      totalDataPoints += resourceCache.dataPoints.length;
    });

    return {
      totalResources: this.cache.size,
      totalDataPoints,
    };
  }
}

const genericMetricsCacheInjectable = getInjectable({
  id: "generic-metrics-cache",
  instantiate: () => new GenericMetricsCacheService(),
});

export default genericMetricsCacheInjectable;
