/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { cpuUnitsToNumber, unitsToBytes } from "@skuberplus/utilities/dist";
import autoBind from "auto-bind";
import { sum } from "lodash";
import { computed, makeObservable, observable } from "mobx";
import { getMetricsSource } from "../../../common/cluster/get-metrics-source";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { JsonApi } from "@skuberplus/json-api";
import type { NodeApi, NodeMetricsApi } from "@skuberplus/kube-api";
import type { Node, NodeMetrics } from "@skuberplus/kube-object";

import type { Cluster } from "../../../common/cluster/cluster";
import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";

export interface NodeStoreDependencies extends KubeObjectStoreDependencies {
  readonly nodeMetricsApi: NodeMetricsApi;
  readonly apiBase?: JsonApi;
  /** 🔧 수정: hostedCluster를 통해 preferences 접근 (올바른 metricsSource 경로) */
  readonly hostedCluster?: Cluster;
}

export class NodeStore extends KubeObjectStore<Node, NodeApi> {
  constructor(
    protected readonly dependencies: NodeStoreDependencies,
    api: NodeApi,
    opts?: KubeObjectStoreOptions,
  ) {
    super(dependencies, api, opts);

    makeObservable(this);
    autoBind(this);
  }

  readonly kubeMetrics = observable.array<NodeMetrics>([]);

  /**
   * 🎯 목적: Node 메트릭 데이터 로드
   *
   * 📝 주의사항:
   * - metricsSource 설정에 따라 Metrics Server 또는 Prometheus 사용
   * - 각 소스는 독립적으로 동작 (fallback 없음)
   *
   * 🔄 변경이력:
   * - 2026-01-09 - metricsSource 기반으로 단순화, fallback 제거
   * - 2026-01-26 - 반환값 추가로 Race Condition 해결 (MobX observable 업데이트 타이밍 문제 우회)
   *
   * @returns 로드된 NodeMetrics 배열 (직접 사용 가능)
   */
  async loadKubeMetrics(): Promise<NodeMetrics[]> {
    // 🎯 사용자가 선택한 메트릭 소스 확인 (기본값: metrics-server)
    // 🔧 수정: hostedCluster?.preferences와 getMetricsSource() 사용 (올바른 경로)
    const metricsSource = getMetricsSource(this.dependencies.hostedCluster?.preferences);

    if (metricsSource === "prometheus") {
      // 🎯 Prometheus 선택 시: Prometheus만 사용
      try {
        const metrics = await this.loadMetricsFromPrometheus();
        return metrics;
      } catch (error) {
        console.warn("❌ [NODE-STORE] Prometheus failed", error);
        this.kubeMetrics.replace([]);
        return [];
      }
    } else {
      // 🎯 Metrics Server 선택 시: Metrics Server만 사용
      try {
        const metrics = await this.dependencies.nodeMetricsApi.list();
        this.kubeMetrics.replace(metrics ?? []);
        return metrics ?? [];
      } catch (error) {
        console.warn("⚠️ [NODE-STORE] Metrics Server failed", error);
        this.kubeMetrics.replace([]);
        return [];
      }
    }
  }

  /**
   * 🎯 목적: Prometheus에서 노드 메트릭 일괄 로드 (개선된 방식)
   *
   * 📝 주의사항:
   * - unified-query.ts의 "nodes" 카테고리 쿼리 사용
   * - 모든 노드를 한 번의 API 호출로 조회하여 성능 개선
   *
   * 🔄 변경이력:
   * - 2026-01-12 - 10개 Node 제한 제거, 일괄 쿼리 방식으로 변경
   * - 2026-01-26 - 반환값 추가로 Race Condition 해결
   *
   * @returns 로드된 NodeMetrics 배열
   */
  private async loadMetricsFromPrometheus(): Promise<NodeMetrics[]> {
    if (!this.dependencies.apiBase) {
      throw new Error("API base not available for Prometheus fallback");
    }

    const nodes = this.items;

    if (nodes.length === 0) {
      this.kubeMetrics.replace([]);
      return [];
    }

    try {
      // 🔧 개선: 모든 노드를 한 번에 쿼리 (노드별 필터 없이 전체 조회)
      const opts = {
        category: "nodes",
        // nodes 파라미터 생략하여 전체 노드 조회
      };

      const metricsData = (await this.dependencies.apiBase.post("/metrics", {
        data: {
          cpuUsage: opts,
          memoryUsage: opts,
        },
      })) as any;

      // 🎯 응답에서 각 Node별 메트릭 추출
      const cpuResults = metricsData.cpuUsage?.data?.result || [];
      const memoryResults = metricsData.memoryUsage?.data?.result || [];

      // Node 이름별로 메트릭 매핑
      const cpuByNode = new Map<string, any>();
      const memoryByNode = new Map<string, any>();

      for (const result of cpuResults) {
        const nodeName = result.metric?.node || result.metric?.instance || result.metric?.kubernetes_node;
        if (nodeName) {
          cpuByNode.set(nodeName, result);
        }
      }

      for (const result of memoryResults) {
        const nodeName = result.metric?.node || result.metric?.instance || result.metric?.kubernetes_node;
        if (nodeName) {
          memoryByNode.set(nodeName, result);
        }
      }

      // 각 Node에 대해 메트릭 생성
      const nodeMetrics: NodeMetrics[] = [];

      for (const node of nodes) {
        const nodeName = node.getName();
        const cpuResult = cpuByNode.get(nodeName);
        const memoryResult = memoryByNode.get(nodeName);

        if (cpuResult || memoryResult) {
          const mockNodeMetric = this.createMockNodeMetricFromResults(node, cpuResult, memoryResult);
          nodeMetrics.push(mockNodeMetric);
        }
      }

      this.kubeMetrics.replace(nodeMetrics);
      return nodeMetrics;
    } catch (error) {
      console.warn("🔄 [NODE-STORE] Failed to get Prometheus metrics:", error);
      this.kubeMetrics.replace([]);
      return [];
    }
  }

  /**
   * 🎯 목적: Prometheus 결과를 NodeMetrics로 변환 (일괄 쿼리용)
   *
   * 📝 주의사항:
   * - Prometheus CPU: 코어 단위 (예: 0.5 = 0.5 cores)
   * - Prometheus Memory: 바이트 단위 (예: 1073741824 = 1GB)
   * - Kubernetes Metrics API 형식: CPU는 millicores ("500m"), Memory는 Ki ("1048576Ki")
   *
   * 🔄 변경이력: 2026-01-12 - 단위 변환 수정 (코어→millicores, 바이트→Ki)
   */
  private createMockNodeMetricFromResults(node: Node, cpuResult: any, memoryResult: any): NodeMetrics {
    const { NodeMetrics: NodeMetricsClass } = require("@skuberplus/kube-object");
    const cpuValue = this.extractMetricValueFromResult(cpuResult);
    const memoryValue = this.extractMetricValueFromResult(memoryResult);

    // 🔧 단위 변환: Prometheus → Kubernetes Metrics API 형식
    // CPU: 코어 → millicores (× 1000)
    // Memory: 바이트 → Ki (÷ 1024)
    const cpuMillicores = Math.round(parseFloat(cpuValue) * 1000);
    const memoryKi = Math.round(parseFloat(memoryValue) / 1024);

    return new NodeMetricsClass({
      kind: "NodeMetrics",
      apiVersion: "metrics.k8s.io/v1beta1",
      metadata: {
        name: node.getName(),
        creationTimestamp: new Date().toISOString(),
        selfLink: `/api/v1/nodes/${node.getName()}`,
        uid: node.getId(),
        resourceVersion: "1",
      },
      timestamp: new Date().toISOString(),
      window: "1m",
      usage: {
        cpu: cpuMillicores + "m",
        memory: memoryKi + "Ki",
      },
    });
  }

  /**
   * 🎯 목적: Prometheus 결과에서 메트릭 값 추출
   */
  private extractMetricValueFromResult(result: any): string {
    try {
      if (result?.values?.length > 0) {
        const latestValue = result.values[result.values.length - 1];
        return latestValue[1] || "0";
      }
      if (result?.value?.length > 1) {
        return result.value[1] || "0";
      }
      return "0";
    } catch (error) {
      return "0";
    }
  }

  @computed get masterNodes() {
    return this.items.filter((node) => node.isMasterNode());
  }

  @computed get workerNodes() {
    return this.items.filter((node) => !node.isMasterNode());
  }

  getWarningsCount(): number {
    return sum(this.items.map((node) => node.getWarningConditions().length));
  }

  /**
   * 🎯 목적: Node의 CPU/Memory 메트릭 계산
   *
   * @param node - 대상 Node 객체
   * @param metricsSource - 선택적 메트릭 배열 (제공 시 observable 대신 사용)
   *
   * 🔄 변경이력:
   * - 2026-01-26 - metricsSource 매개변수 추가로 Race Condition 해결
   *   MobX observable 업데이트 타이밍 문제 우회를 위해 직접 메트릭 배열 전달 가능
   */
  getNodeKubeMetrics(node: Node, metricsSource?: NodeMetrics[]) {
    // 🎯 metricsSource가 제공되면 사용, 아니면 observable 사용
    const metricsArray = metricsSource ?? this.kubeMetrics;
    const metrics = metricsArray.find((metric) => {
      return [metric.getName() === node.getName()].every((v) => v);
    });

    if (!metrics) return { cpu: NaN, memory: NaN };

    if (metrics && metrics.usage) {
      return {
        cpu: Number(cpuUnitsToNumber(metrics.usage.cpu)) || 0,
        memory: Number(unitsToBytes(metrics.usage.memory)) || 0,
      };
    }

    return {
      cpu: 0,
      memory: 0,
    };
  }
}
