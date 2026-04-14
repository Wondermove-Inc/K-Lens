/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./resource-metrics.scss";

import { Spinner } from "@skuberplus/spinner";
import { ToggleGroup, ToggleGroupItem } from "@skuberplus/storybook-shadcn/src/components/ui/toggle-group";
import { cssNames } from "@skuberplus/utilities";
import { isComputed } from "mobx";
import { observer } from "mobx-react-lite";
import { now } from "mobx-utils";
import React, { createContext, useState } from "react";

import type { KubeObject } from "@skuberplus/kube-object";

import type { IAsyncComputed } from "@ogre-tools/injectable-react";

import type { MetricsSourceType } from "../../../common/cluster-types";
import type { MetricData } from "../../../common/k8s-api/endpoints/metrics.api";
import type { MetricsTab } from "../chart/options";

export type AtLeastOneMetricTab = [MetricsTab, ...MetricsTab[]];

export interface ResourceMetricsProps<Keys extends string> {
  tabs: AtLeastOneMetricTab;
  object: KubeObject;
  className?: string;
  metrics: IAsyncComputed<Partial<Record<Keys, MetricData>> | null | undefined> | Partial<Record<Keys, MetricData>>;
  children: React.ReactChild | React.ReactChild[];
  /**
   * 🎯 목적: 현재 메트릭 소스 타입
   * 📝 주의사항: Chart 컴포넌트에서 Prometheus 전용 탭(Network/Disk) 분기에 사용
   */
  metricsSource?: MetricsSourceType;
}

function isAsyncComputedMetrics<Keys extends string>(
  metrics: IAsyncComputed<Partial<Record<Keys, MetricData>> | null | undefined> | Partial<Record<Keys, MetricData>>,
): metrics is IAsyncComputed<Partial<Record<Keys, MetricData>> | null | undefined> {
  return isComputed((metrics as IAsyncComputed<unknown>).value);
}

export interface ResourceMetricsValue {
  object: KubeObject;
  tab: MetricsTab;
  metrics: Partial<Record<string, MetricData>> | null | undefined;
  /**
   * 🎯 목적: 현재 메트릭 소스 타입 (Context를 통해 Chart 컴포넌트에 전달)
   */
  metricsSource: MetricsSourceType;
}

export const ResourceMetricsContext = createContext<ResourceMetricsValue | null>(null);

export const ResourceMetrics = observer(
  <Keys extends string>({
    object,
    tabs,
    children,
    className,
    metrics,
    metricsSource = "metrics-server",
  }: ResourceMetricsProps<Keys>) => {
    // 🎯 Metrics Server 선택 시 Network/Disk 탭 숨김 (Prometheus 전용 메트릭)
    // 🔄 변경이력: 2026-01-26 - Metrics Server에서 지원하지 않는 탭 자동 필터링
    const filteredTabs =
      metricsSource === "metrics-server" ? tabs.filter((t) => t !== "Network" && t !== "Disk") : tabs;

    // 🛡️ 필터링 후 탭이 없으면 첫 번째 탭 사용 (방어 처리)
    const availableTabs = filteredTabs.length > 0 ? filteredTabs : tabs;
    const [tab, setTab] = useState<MetricsTab>(availableTabs[0]);

    // 🎯 15초마다 강제 갱신 트리거 - observer가 now() 변경을 감지하여 리렌더링
    // 📝 주의: Metrics Server는 15초 간격으로 데이터 수집, 60초 → 15초로 변경하여 부드러운 차트 업데이트
    // 🔄 변경이력: 2026-01-26 - 메트릭 서버 간격에 맞춰 60초 → 15초 변경
    now(15 * 1000);
    const metricsValue = isAsyncComputedMetrics(metrics) ? metrics.value.get() : metrics;

    return (
      <div className={cssNames("ResourceMetrics flex column", className)}>
        <div className="switchers">
          <ToggleGroup
            type="single"
            value={tab}
            onValueChange={(value) => value && setTab(value as MetricsTab)}
            variant="outline"
            className="w-fit mx-auto"
          >
            {availableTabs.map((tabItem, index) => (
              <ToggleGroupItem key={index} value={tabItem} className="px-3">
                {tabItem}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <ResourceMetricsContext.Provider
          value={{
            object,
            tab,
            metrics: metricsValue,
            metricsSource,
          }}
        >
          <div className="graph">{children}</div>
        </ResourceMetricsContext.Provider>
        <div className="loader">
          <Spinner />
        </div>
      </div>
    );
  },
);
