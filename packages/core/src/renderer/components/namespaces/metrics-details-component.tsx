/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Namespace 메트릭 디테일 컴포넌트
 *
 * @remarks
 * - ResourceMetrics를 사용하여 CPU/Memory/Network/Disk 탭 제공
 * - Pod 차트 컴포넌트 재사용
 * - Network/Disk는 Prometheus 전용 (Metrics Server에서는 "Prometheus Required" 메시지 표시)
 *
 * 🔄 변경이력:
 * - 2026-01-13: Network/Disk 탭 지원을 위해 metricsSource 전달 추가
 */

import { type IAsyncComputed, withInjectables } from "@ogre-tools/injectable-react";
import React from "react";
import { getMetricsSource } from "../../../common/cluster/get-metrics-source";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { ResourceMetrics } from "../resource-metrics";
import { PodCharts, podMetricTabs } from "../workloads-pods/pod-charts";
import namespaceMetricsInjectable from "./metrics.injectable";

import type { Namespace } from "@skuberplus/kube-object";

import type { Cluster } from "../../../common/cluster/cluster";
import type { MetricsSourceType } from "../../../common/cluster-types";
import type { PodMetricInNamespaceData } from "../../../common/k8s-api/endpoints/metrics.api/request-pod-metrics-in-namespace.injectable";
import type { KubeObjectDetailsProps } from "../kube-object-details";

interface Dependencies {
  metrics: IAsyncComputed<PodMetricInNamespaceData>;
  metricsSource: MetricsSourceType;
}

const NonInjectedNamespaceMetricsDetailsComponent = ({
  object,
  metrics,
  metricsSource,
}: KubeObjectDetailsProps<Namespace> & Dependencies) => (
  <ResourceMetrics tabs={podMetricTabs} object={object} metrics={metrics} metricsSource={metricsSource}>
    <PodCharts />
  </ResourceMetrics>
);

export const NamespaceMetricsDetailsComponent = withInjectables<Dependencies, KubeObjectDetailsProps<Namespace>>(
  NonInjectedNamespaceMetricsDetailsComponent,
  {
    getProps: (di, props) => {
      const hostedCluster = di.inject(hostedClusterInjectable) as Cluster | undefined;
      const metricsSource = getMetricsSource(hostedCluster?.preferences);

      return {
        metrics: di.inject(namespaceMetricsInjectable, props.object),
        metricsSource,
        ...props,
      };
    },
  },
);
