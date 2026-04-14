/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 메트릭 데이터가 없을 때 표시하는 안내 컴포넌트
 *
 * @remarks
 * - default: 일반적인 메트릭 없음 메시지
 * - prometheus-required: Prometheus가 필요한 메트릭(Network/Disk) 안내
 *
 * 🔄 변경이력:
 * - 2026-01-12: prometheus-required variant 추가 (Network/Disk 메트릭 지원)
 * - 2026-01-23: Configure Metrics Source 링크 제거 (레거시 라우트 연결 이슈)
 */

import { Icon } from "@skuberplus/icon";
import React from "react";

export type NoMetricsVariant = "default" | "prometheus-required";

export interface NoMetricsProps {
  variant?: NoMetricsVariant;
}

/**
 * 🎯 목적: Prometheus 필요 메시지를 렌더링하는 내부 컴포넌트
 */
function PrometheusRequiredMessage() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8">
      <Icon material="info" className="text-muted-foreground" />
      <p className="text-sm text-muted-foreground text-center">Prometheus Required</p>
      <p className="text-xs text-muted-foreground text-center max-w-[300px]">
        Network and Disk metrics are only available when using Prometheus as the metrics source.
      </p>
    </div>
  );
}

/**
 * 🎯 목적: 기본 메트릭 없음 메시지를 렌더링하는 내부 컴포넌트
 */
function DefaultNoMetricsMessage() {
  return (
    <div className="flex justify-center items-center gap-1">
      <Icon material="info" />
      <span>Metrics not available at the moment</span>
    </div>
  );
}

/**
 * 🎯 목적: NoMetrics 메인 컴포넌트
 */
export function NoMetrics({ variant = "default" }: NoMetricsProps) {
  if (variant === "prometheus-required") {
    return <PrometheusRequiredMessage />;
  }

  return <DefaultNoMetricsMessage />;
}
