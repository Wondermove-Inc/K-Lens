/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { ClusterPrometheusPreferences, MetricsSourceType } from "../cluster-types";

/**
 * 🎯 목적: 기존 prometheusProvider.type을 새로운 metricsSource 형식으로 마이그레이션
 *
 * 📝 마이그레이션 매핑:
 * - undefined, "auto-detect-smart", "auto-detect-metrics-server" → "metrics-server"
 * - "auto-detect-prometheus", "helm", "helm14", "lens", "operator", "stacklight", "skuberplus" → "prometheus"
 *
 * ⚠️ 주의사항:
 * - 이미 metricsSource가 설정된 경우 마이그레이션 건너뜀
 * - 마이그레이션 후 prometheusProvider는 제거됨
 * - 기존 prometheus 엔드포인트 설정은 유지됨
 *
 * @param preferences - 기존 설정 (prometheusProvider.type 포함 가능)
 * @returns 새로운 형식의 설정
 *
 * 🔄 변경이력: 2026-01-09 - 초기 생성
 */
export function migratePrometheusPreferences(preferences: ClusterPrometheusPreferences): ClusterPrometheusPreferences {
  // 이미 마이그레이션된 경우 그대로 반환
  if (preferences.metricsSource !== undefined) {
    // prometheusProvider가 남아있으면 제거
    if (preferences.prometheusProvider !== undefined) {
      const { prometheusProvider: _, ...rest } = preferences;

      return rest;
    }

    return preferences;
  }

  const oldType = preferences.prometheusProvider?.type;
  const metricsSource = mapProviderTypeToMetricsSource(oldType);

  // prometheusProvider 제거하고 새 형식으로 반환
  const { prometheusProvider: _, ...restPreferences } = preferences;

  return {
    ...restPreferences,
    metricsSource,
  };
}

/**
 * 🎯 목적: 기존 prometheusProvider.type을 MetricsSourceType으로 변환
 *
 * @param oldType - 기존 prometheusProvider.type 값
 * @returns 새로운 MetricsSourceType
 */
function mapProviderTypeToMetricsSource(oldType: string | undefined): MetricsSourceType {
  // Metrics Server로 매핑되는 케이스
  const metricsServerTypes = new Set([undefined, "auto-detect-smart", "auto-detect-metrics-server"]);

  if (metricsServerTypes.has(oldType)) {
    return "metrics-server";
  }

  // Prometheus로 매핑되는 케이스
  // "auto-detect-prometheus", "helm", "helm14", "lens", "operator", "stacklight", "skuberplus"
  return "prometheus";
}

/**
 * 🎯 목적: 설정이 마이그레이션이 필요한지 확인
 *
 * @param preferences - 확인할 설정
 * @returns 마이그레이션 필요 여부
 */
export function needsMigration(preferences: ClusterPrometheusPreferences): boolean {
  return preferences.metricsSource === undefined && preferences.prometheusProvider !== undefined;
}
