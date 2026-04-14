/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { PodMetrics } from "@skuberplus/kube-object";
import { cpuUnitsToNumber, unitsToBytes } from "@skuberplus/utilities";
import countBy from "lodash/countBy";
import { observable } from "mobx";
import { getMetricsSource } from "../../../common/cluster/get-metrics-source";
import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { JsonApi } from "@skuberplus/json-api";
import type { PodApi, PodMetricsApi } from "@skuberplus/kube-api";
import type { KubeObject, NamespaceScopedMetadata, Pod } from "@skuberplus/kube-object";

import type { Cluster } from "../../../common/cluster/cluster";
import type { KubeObjectStoreDependencies, KubeObjectStoreOptions } from "../../../common/k8s-api/kube-object.store";

export interface PodStoreDependencies extends KubeObjectStoreDependencies {
  readonly podMetricsApi: PodMetricsApi;
  readonly apiBase?: JsonApi;
  /** 🔧 수정: hostedCluster를 통해 preferences 접근 (올바른 metricsSource 경로) */
  readonly hostedCluster?: Cluster;
}

export class PodStore extends KubeObjectStore<Pod, PodApi> {
  constructor(
    protected readonly dependencies: PodStoreDependencies,
    api: PodApi,
    opts?: KubeObjectStoreOptions,
  ) {
    super(dependencies, api, opts);
  }

  readonly kubeMetrics = observable.array<PodMetrics>([]);

  /**
   * namespace가 지정된 경우: 해당 ns 메트릭만 교체, 나머지 유지
   * namespace가 없는 경우: 전체 교체 (기존 동작 그대로)
   */
  private mergeKubeMetrics(newMetrics: PodMetrics[], namespace?: string): void {
    if (!namespace) {
      this.kubeMetrics.replace(newMetrics);
      return;
    }
    const otherNsMetrics = this.kubeMetrics.filter((m) => m.getNs() !== namespace);
    this.kubeMetrics.replace([...otherNsMetrics, ...newMetrics]);
  }

  /**
   * 🎯 목적: Pod 메트릭 데이터 로드
   *
   * 📝 주의사항:
   * - metricsSource 설정에 따라 Metrics Server 또는 Prometheus 사용
   * - 각 소스는 독립적으로 동작 (fallback 없음)
   *
   * 🔄 변경이력:
   * - 2026-01-09 - metricsSource 기반으로 단순화, fallback 제거
   * - 2026-01-26 - 반환값 추가로 Race Condition 해결 (MobX observable 업데이트 타이밍 문제 우회)
   *
   * @returns 로드된 PodMetrics 배열 (직접 사용 가능)
   */
  async loadKubeMetrics(namespace?: string): Promise<PodMetrics[]> {
    // 🎯 사용자가 선택한 메트릭 소스 확인 (기본값: metrics-server)
    // 🔧 수정: hostedCluster?.preferences와 getMetricsSource() 사용 (올바른 경로)
    const metricsSource = getMetricsSource(this.dependencies.hostedCluster?.preferences);

    if (metricsSource === "prometheus") {
      // 🎯 Prometheus 선택 시: Prometheus만 사용
      try {
        const metrics = await this.loadMetricsFromPrometheus(namespace);
        return metrics;
      } catch (error) {
        console.warn("❌ [POD-STORE] Prometheus failed", error);
        return [];
      }
    } else {
      // 🎯 Metrics Server 선택 시: Metrics Server만 사용
      try {
        const metrics = await this.dependencies.podMetricsApi.list({ namespace });
        this.mergeKubeMetrics(metrics ?? [], namespace);
        return metrics ?? [];
      } catch (error) {
        console.warn("⚠️ [POD-STORE] Metrics Server failed", error);
        return [];
      }
    }
  }

  /**
   * 🎯 목적: Prometheus에서 Pod 메트릭 일괄 로드 (개선된 방식)
   *
   * 📝 주의사항:
   * - 개별 Pod 단위 API 호출 대신 네임스페이스 단위로 일괄 쿼리
   * - regex 패턴으로 여러 Pod을 한 번에 조회하여 성능 개선
   *
   * 🔄 변경이력:
   * - 2026-01-12 - 10개 Pod 제한 제거, 일괄 쿼리 방식으로 변경
   * - 2026-01-26 - 반환값 추가로 Race Condition 해결
   *
   * @returns 로드된 PodMetrics 배열
   */
  private async loadMetricsFromPrometheus(namespace?: string): Promise<PodMetrics[]> {
    if (!this.dependencies.apiBase) {
      throw new Error("API base not available for Prometheus fallback");
    }

    // 현재 로드된 Pod들에 대해 메트릭 요청
    const pods = namespace ? this.items.filter((pod) => pod.getNs() === namespace) : this.items;

    if (pods.length === 0) {
      return [];
    }

    // 🔧 개선: 네임스페이스별로 그룹핑하여 일괄 쿼리
    const namespaceGroups = new Map<string, typeof pods>();
    for (const pod of pods) {
      const ns = pod.getNs();
      if (!namespaceGroups.has(ns)) {
        namespaceGroups.set(ns, []);
      }
      namespaceGroups.get(ns)!.push(pod);
    }

    const podMetrics: PodMetrics[] = [];

    // 네임스페이스별로 일괄 쿼리 실행
    for (const [ns, nsPods] of namespaceGroups) {
      try {
        // 🔧 개선: 모든 Pod을 regex 패턴으로 한 번에 쿼리 (최대 100개)
        const podNames = nsPods.slice(0, 100).map((p) => p.getName());
        const podSelector = podNames.join("|");

        const opts = {
          category: "pods",
          pods: podSelector,
          namespace: ns,
          selector: "pod",
        };

        const metricsData = (await this.dependencies.apiBase.post("/metrics", {
          data: {
            cpuUsage: opts,
            memoryUsage: opts,
          },
          query: {
            kubernetes_namespace: ns,
          },
        })) as any;

        // 응답에서 각 Pod별 메트릭 추출
        const cpuResults = metricsData.cpuUsage?.data?.result || [];
        const memoryResults = metricsData.memoryUsage?.data?.result || [];

        // Pod 이름별로 메트릭 매핑
        const cpuByPod = new Map<string, any>();
        const memoryByPod = new Map<string, any>();

        for (const result of cpuResults) {
          const podName = result.metric?.pod;
          if (podName) {
            cpuByPod.set(podName, result);
          }
        }

        for (const result of memoryResults) {
          const podName = result.metric?.pod;
          if (podName) {
            memoryByPod.set(podName, result);
          }
        }

        // 각 Pod에 대해 메트릭 생성
        for (const pod of nsPods) {
          const podName = pod.getName();
          const cpuResult = cpuByPod.get(podName);
          const memoryResult = memoryByPod.get(podName);

          if (cpuResult || memoryResult) {
            const mockPodMetric = this.createMockPodMetricFromResults(pod, cpuResult, memoryResult);
            podMetrics.push(mockPodMetric);
          }
        }
      } catch (error) {
        console.warn(`🔄 [POD-STORE] Failed to get Prometheus metrics for namespace ${ns}:`, error);
      }
    }

    this.mergeKubeMetrics(podMetrics, namespace);
    return podMetrics;
  }

  /**
   * 🎯 목적: Prometheus 결과를 PodMetrics로 변환 (일괄 쿼리용)
   *
   * 📝 주의사항:
   * - Prometheus CPU: 코어 단위 (예: 0.5 = 0.5 cores)
   * - Prometheus Memory: 바이트 단위 (예: 1073741824 = 1GB)
   * - Kubernetes Metrics API 형식: CPU는 millicores ("500m"), Memory는 Ki ("1048576Ki")
   *
   * 🔄 변경이력: 2026-01-12 - 단위 변환 수정 (코어→millicores, 바이트→Ki)
   */
  private createMockPodMetricFromResults(pod: Pod, cpuResult: any, memoryResult: any): PodMetrics {
    const cpuValue = this.extractMetricValueFromResult(cpuResult);
    const memoryValue = this.extractMetricValueFromResult(memoryResult);

    // 🔧 단위 변환: Prometheus → Kubernetes Metrics API 형식
    // CPU: 코어 → millicores (× 1000)
    // Memory: 바이트 → Ki (÷ 1024)
    const cpuMillicores = Math.round(parseFloat(cpuValue) * 1000);
    const memoryKi = Math.round(parseFloat(memoryValue) / 1024);

    const containers = pod.getContainers().map((container) => ({
      name: container.name,
      usage: {
        cpu: cpuMillicores + "m",
        memory: memoryKi + "Ki",
      },
    }));

    return new PodMetrics({
      kind: "PodMetrics",
      apiVersion: "metrics.k8s.io/v1beta1",
      metadata: {
        name: pod.getName(),
        namespace: pod.getNs(),
        creationTimestamp: new Date().toISOString(),
        selfLink: `/api/v1/namespaces/${pod.getNs()}/pods/${pod.getName()}`,
        uid: pod.getId(),
        resourceVersion: "1",
      },
      timestamp: new Date().toISOString(),
      window: "1m",
      containers,
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

  getPodsByOwner(workload: KubeObject<NamespaceScopedMetadata, unknown, unknown>): Pod[] {
    return this.items.filter((pod) => pod.getOwnerRefs().find((owner) => owner.uid === workload.getId()));
  }

  getPodsByOwnerId(workloadId: string): Pod[] {
    return this.items.filter((pod) => {
      return pod.getOwnerRefs().find((owner) => owner.uid === workloadId);
    });
  }

  getPodsByNode(node: string) {
    if (!this.isLoaded) return [];

    return this.items.filter((pod) => pod.spec.nodeName === node);
  }

  getStatuses(pods: Pod[]) {
    return countBy(
      pods
        .map((pod) => pod.getStatus())
        .sort()
        .reverse(),
    );
  }

  /**
   * 🎯 목적: Pod의 CPU/Memory 메트릭 계산
   *
   * @param pod - 대상 Pod 객체
   * @param metricsSource - 선택적 메트릭 배열 (제공 시 observable 대신 사용)
   *
   * 🔄 변경이력:
   * - 2026-01-26 - metricsSource 매개변수 추가로 Race Condition 해결
   *   MobX observable 업데이트 타이밍 문제 우회를 위해 직접 메트릭 배열 전달 가능
   */
  getPodKubeMetrics(pod: Pod, metricsSource?: PodMetrics[]) {
    const containers = pod.getContainers();
    const empty = { cpu: 0, memory: 0 };
    // 🎯 metricsSource가 제공되면 사용, 아니면 observable 사용
    const metricsArray = metricsSource ?? this.kubeMetrics;
    const metrics = metricsArray?.find((metric) => {
      return [metric.getName() === pod.getName(), metric.getNs() === pod.getNs()].every((v) => v);
    });

    if (!metrics || !metrics.containers || !containers) return { cpu: NaN, memory: NaN };

    return containers.reduce((total, container) => {
      let cpu = "0";
      let memory = "0";

      const metric = metrics.containers?.find((item) => item.name == container.name);

      if (metric && metric.usage) {
        cpu = metric.usage.cpu || "0";
        memory = metric.usage.memory || "0";
      }

      return {
        cpu: total.cpu + (cpuUnitsToNumber(cpu) ?? 0),
        memory: total.memory + unitsToBytes(memory),
      };
    }, empty);
  }
}
