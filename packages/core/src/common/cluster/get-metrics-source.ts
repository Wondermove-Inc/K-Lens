/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { ClusterPreferences, MetricsSourceType } from "../cluster-types";

/**
 * 🎯 목적: 메트릭 소스 타입을 반환하는 유틸리티 함수
 *
 * 📝 주의사항:
 * - 새로운 metricsSource 필드를 우선 사용
 * - 구식 prometheusProvider.type 필드는 폴백으로만 사용 (마이그레이션 전 데이터)
 * - 기본값: "metrics-server" (Kubernetes 기본 메트릭 서버)
 *
 * 🔄 변경이력: 2026-01-12 - 초기 생성 (구식 필드 사용 버그 수정)
 *
 * @param preferences - 클러스터 설정
 * @returns 메트릭 소스 타입 ("prometheus" 또는 "metrics-server")
 */
export function getMetricsSource(preferences?: ClusterPreferences): MetricsSourceType {
  if (!preferences) {
    return "metrics-server";
  }

  // 새로운 필드 우선
  if (preferences.metricsSource) {
    return preferences.metricsSource;
  }

  // 구식 필드 폴백 (마이그레이션 전 데이터)
  const oldType = preferences.prometheusProvider?.type;

  if (oldType === "auto-detect-metrics-server") {
    return "metrics-server";
  }

  // 다른 모든 oldType 값은 Prometheus로 간주
  // (auto-detect-prometheus, helm, helm14, lens, operator, stacklight, skuberplus 등)
  if (oldType) {
    return "prometheus";
  }

  // 기본값: metrics-server
  return "metrics-server";
}
