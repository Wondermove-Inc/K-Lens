/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { MetricsSourceType } from "../../../common/cluster-types";

/**
 * 🎯 목적: Prometheus 서비스 정보
 */
export interface PrometheusService {
  kind: string;
  namespace: string;
  service: string;
  port: number;
}

/**
 * 🎯 목적: Prometheus 상세 정보 (경로만 반환, Provider 제거됨)
 *
 * 🔄 변경이력: 2026-01-09 - Provider 제거, prometheusPath만 반환
 */
export interface PrometheusDetails {
  prometheusPath: string;
}

interface Dependencies {
  readonly logger: Logger;
}

export interface ClusterPrometheusHandler {
  getPrometheusDetails(): Promise<PrometheusDetails>;
  setupPrometheus(preferences: unknown): void;
}

/**
 * 🎯 목적: Kubernetes 서비스 프록시 경로 생성
 *
 * @param service - Prometheus 서비스 정보
 * @param useHttps - HTTPS 사용 여부
 * @returns 서비스 프록시 경로
 */
const buildPrometheusPath = (service: PrometheusService, useHttps?: boolean): string =>
  `${service.namespace}/services/${useHttps ? "https:" : ""}${service.service}:${service.port}`;

/**
 * 🎯 목적: 단순화된 Prometheus 핸들러 생성
 *
 * 📝 로직:
 * 1. metricsSource가 "metrics-server"면 더미 서비스 반환
 * 2. metricsSource가 "prometheus"면 사용자 지정 엔드포인트 사용
 *
 * ⚠️ 주의사항:
 * - Auto-detect 로직 완전 제거
 * - Provider 완전 제거 - unified-query.ts 직접 사용
 * - prometheusPath만 반환
 *
 * 🔄 변경이력: 2026-01-09 - Provider 의존성 완전 제거
 */
export const createClusterPrometheusHandler = (deps: Dependencies, cluster: Cluster): ClusterPrometheusHandler => {
  const { logger } = deps;

  /**
   * 🎯 목적: Prometheus 서비스 정보 조회
   */
  const getPrometheusService = (): PrometheusService => {
    const preferences = cluster.preferences;
    const metricsSource: MetricsSourceType = preferences.metricsSource ?? "metrics-server";

    logger.info(`[PROMETHEUS-HANDLER] metricsSource: ${metricsSource}`);

    // Case 1: Metrics Server 모드
    if (metricsSource === "metrics-server") {
      // Metrics Server는 별도의 서비스 경로가 필요 없음 (K8s API 직접 사용)
      // 하지만 인터페이스 호환을 위해 더미 서비스 반환
      return {
        kind: "metrics-server",
        namespace: "kube-system",
        service: "metrics-server",
        port: 443,
      };
    }

    // Case 2: Prometheus 모드
    const prometheusConfig = preferences.prometheus;

    if (!prometheusConfig?.namespace || !prometheusConfig?.service || !prometheusConfig?.port) {
      logger.error(`[PROMETHEUS-HANDLER] Prometheus endpoint not configured`);
      throw new Error(
        "Prometheus endpoint not configured. Please set namespace, service, and port in cluster settings.",
      );
    }

    logger.info(
      `[PROMETHEUS-HANDLER] Using Prometheus endpoint: ${prometheusConfig.namespace}/${prometheusConfig.service}:${prometheusConfig.port}`,
    );

    return {
      kind: "prometheus",
      namespace: prometheusConfig.namespace,
      service: prometheusConfig.service,
      port: prometheusConfig.port,
    };
  };

  /**
   * 🎯 목적: Prometheus 상세 정보 조회 (경로만 반환)
   *
   * 📝 주의사항:
   * - Provider 제거됨 - get-cluster-metrics에서 unified-query 직접 사용
   */
  const getPrometheusDetails = async (): Promise<PrometheusDetails> => {
    const service = getPrometheusService();
    const prometheusPath = buildPrometheusPath(service, cluster.preferences.prometheus?.https);

    logger.info(`[PROMETHEUS-HANDLER] Service: ${service.kind}, Path: ${prometheusPath}`);

    return { prometheusPath };
  };

  /**
   * 🎯 목적: Prometheus 설정 변경 시 호출되는 콜백
   *
   * 📝 주의사항:
   * - 단순화된 버전에서는 특별한 설정 로직 없음
   * - 설정 변경은 MobX observable로 자동 반영됨
   *
   * @param preferences - 변경된 Prometheus 설정
   */
  const setupPrometheus = (preferences: unknown): void => {
    logger.info(`[PROMETHEUS-HANDLER] Prometheus preferences updated`, preferences);
  };

  return {
    getPrometheusDetails,
    setupPrometheus,
  };
};
