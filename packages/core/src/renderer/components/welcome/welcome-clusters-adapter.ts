/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CatalogEntityRegistry에서 클러스터 데이터를 추출하여
 *          React Table에 안전하게 전달할 수 있는 불변 스냅샷 제공
 *
 * @remarks
 * 별도 Store를 만들지 않고 기존 CatalogEntityRegistry의 데이터를 활용.
 * MobX observable을 직접 전달하지 않고 toJS()로 순수 객체 배열로 변환.
 * MobX observer가 tableRows 변경을 자동 감지하여 재렌더링 트리거.
 *
 * 🔄 변경이력: 2025-10-17 - 초기 생성 (Catalog 어댑터 패턴)
 */

import { ipcRenderer } from "electron";
import { computed, makeObservable, observable, runInAction } from "mobx";
import {
  clusterGetLatencyChannel,
  clusterLatencyUpdateChannel,
} from "../../../main/cluster/get-cluster-latency.injectable";
import { clusterGetMetricsChannel } from "../../../main/cluster/get-cluster-metrics.injectable";
import { clusterGetPodStatusChannel } from "../../../main/cluster/get-cluster-pod-status.injectable";
import { sortClustersByConnectionStatus } from "../layout/cluster-ordering";

import type { KubernetesCluster } from "../../../common/catalog-entities/kubernetes-cluster";
import type { ClusterLatencyData } from "../../../main/cluster/get-cluster-latency.injectable";
import type { ClusterMetricsData } from "../../../main/cluster/get-cluster-metrics.injectable";
import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";

export type { ClusterMetricsData };

/**
 * 🎯 목적: Pod Status 데이터 타입 정의
 *
 * @remarks
 * Stacked Bar Chart에 표시할 Pod 상태별 카운트.
 * 각 상태는 Kubernetes Pod Phase에 대응.
 */
export interface PodStatusData {
  running: number;
  succeeded: number;
  pending: number;
  failed: number;
  unknown: number;
}

/**
 * 🎯 목적: DataTable 행 데이터 타입 정의
 *
 * @remarks
 * KubernetesCluster 엔티티에서 테이블 표시에 필요한 필드만 추출.
 * status.phase만 보장되며, nodes/namespaces 필드는 존재하지 않음.
 *
 * 🔄 변경이력:
 * - 2025-11-19 - podStatus 필드 추가 (Storybook Home story 마이그레이션)
 */
export interface ClusterRowData {
  id: string;
  name: string;
  status: string; // LensKubernetesClusterStatus enum 값
  distro?: string;
  /**
   * 클러스터 아이콘 경로 (사용자 설정 아이콘 우선)
   */
  icon?: string;
  kubeVersion?: string;
  latency?: number | null; // API 서버 RTT (ms), null이면 측정 불가
  podStatus?: PodStatusData; // 🎯 Pod Status Stacked Bar Chart용 데이터
  metrics?: ClusterMetricsData; // 🎯 CPU/Memory 메트릭 데이터
}

/**
 * 🎯 목적: CatalogEntityRegistry 어댑터 클래스
 *
 * @remarks
 * MobX computed getter를 활용하여 filteredItems 변경 시 자동 재계산.
 * toJS()로 불변 스냅샷 생성하여 React Table의 불변성 요구사항 충족.
 *
 * 🔄 변경이력:
 * - 2025-11-19 - IPC 기반 Pod Status 캐싱 시스템 추가
 */
export class WelcomeClustersAdapter {
  /**
   * 🎯 목적: Pod Status 캐시 (클러스터 ID → Pod Status)
   *
   * @remarks
   * MobX observable.map으로 자동 반응성 확보.
   * refreshPodStatus() 호출 시 업데이트됨.
   */
  private readonly podStatusCache = observable.map<string, PodStatusData>();

  /**
   * 🎯 목적: 메트릭 캐시 (클러스터 ID → CPU/Memory 메트릭)
   *
   * @remarks
   * MobX observable.map으로 자동 반응성 확보.
   * refreshMetrics() 호출 시 업데이트됨.
   */
  private readonly metricsCache = observable.map<string, ClusterMetricsData>();

  /**
   * 🎯 목적: 로딩 상태 추적 (클러스터 ID → 로딩 중 여부)
   */
  private readonly loadingStatus = observable.map<string, boolean>();

  /**
   * 🎯 목적: 메트릭 로딩 상태 추적
   */
  private readonly metricsLoadingStatus = observable.map<string, boolean>();

  /**
   * Latency 캐시 (클러스터 ID → ms).
   * Push(broadcastMessage)와 Pull(ipcRenderer.invoke) 양쪽에서 업데이트된다.
   */
  private readonly latencyCache = observable.map<string, number | null>();

  /** broadcastMessage 리스너 해제 함수 */
  private latencyListenerDisposer: (() => void) | null = null;

  constructor(private readonly catalogRegistry: CatalogEntityRegistry) {
    makeObservable(this, {
      tableRows: computed,
    });
  }

  /**
   * 🎯 목적: React Table에 전달할 불변 스냅샷 반환
   *
   * @returns CatalogEntityRegistry의 클러스터를 변환한 순수 JavaScript 배열
   *
   * 📝 주의사항:
   * - filteredItems (배열) 사용 (filteredEntities는 Map이므로 사용 불가)
   * - computed getter이므로 의존성 추적 및 캐싱 자동 처리
   * - MobX observer가 자동으로 변경 감지하므로 별도 버전 키 불필요
   * - toJS() 사용 금지: 매번 새 객체 생성하여 무한 재렌더링 발생
   *
   * 🔄 변경이력:
   * - 2025-10-17 - 초기 생성 (snapshotVersion 제거, MobX 자동 추적 활용)
   * - 2025-10-26 - toJS() 제거 (무한 재렌더링 해결)
   */
  get tableRows(): ClusterRowData[] {
    // 🎯 CatalogEntityRegistry.filteredItems (배열) 사용
    const allEntities = this.catalogRegistry.filteredItems;

    // 🔄 클러스터만 필터링
    const clusters = allEntities.filter((entity) => entity.kind === "KubernetesCluster") as KubernetesCluster[];

    // 🎯 2026-01-19: - 사이드바와 동일한 정렬 순서 적용
    // 이름 알파벳순 정렬 (sortClustersByConnectionStatus 함수 사용)
    const sortedClusters = sortClustersByConnectionStatus(clusters);

    // 🔄 KubernetesCluster → ClusterRowData 변환
    // ✅ map()으로 이미 plain object 배열이므로 toJS() 불필요
    const rows = sortedClusters.map((cluster) => ({
      id: cluster.getId(),
      name: cluster.metadata.name,
      status: cluster.status?.phase ?? "unknown", // ✅ Optional chaining으로 안전한 접근
      distro: cluster.metadata.distro,
      icon: cluster.spec?.icon?.src || cluster.spec?.icon?.background,
      kubeVersion: cluster.metadata.kubeVersion,
      latency: this.getLatencyForCluster(cluster),
      // 🎯 Pod Status 데이터
      podStatus: this.getPodStatusForCluster(cluster),
      // 🎯 CPU/Memory 메트릭 데이터
      metrics: this.getMetricsForCluster(cluster),
    }));

    return rows;
  }

  /**
   * 🎯 목적: 클러스터의 메트릭 데이터 반환 (캐시에서 조회)
   *
   * @param cluster - 조회할 Kubernetes 클러스터
   * @returns CPU/Memory 메트릭 데이터 (캐시된 값 또는 undefined)
   */
  private getMetricsForCluster(cluster: KubernetesCluster): ClusterMetricsData | undefined {
    // 🚨 연결되지 않은 클러스터는 메트릭 데이터 없음
    if (cluster.status?.phase !== "connected") {
      return undefined;
    }

    // 🎯 캐시에서 조회
    return this.metricsCache.get(cluster.getId());
  }

  /**
   * 🎯 목적: 클러스터의 Pod Status 데이터 반환 (캐시에서 조회)
   *
   * @param cluster - 조회할 Kubernetes 클러스터
   * @returns Pod 상태별 카운트 데이터 (캐시된 값 또는 undefined)
   *
   * 📝 주의사항:
   * - 캐시에 없으면 undefined 반환 (Empty 상태 표시)
   * - refreshPodStatus() 호출로 캐시 업데이트 필요
   * - Connected 상태일 때만 유효한 데이터
   *
   * 🔄 변경이력:
   * - 2025-11-19 - 초기 생성 (샘플 데이터 반환)
   * - 2025-11-19 - 캐시 기반으로 변경 (IPC 연동)
   */
  private getPodStatusForCluster(cluster: KubernetesCluster): PodStatusData | undefined {
    // 🚨 연결되지 않은 클러스터는 Pod 데이터 없음
    if (cluster.status?.phase !== "connected") {
      return undefined;
    }

    // 🎯 캐시에서 조회
    return this.podStatusCache.get(cluster.getId());
  }

  /**
   * 연결된 클러스터의 latency 캐시 값을 반환한다.
   */
  private getLatencyForCluster(cluster: KubernetesCluster): number | null | undefined {
    if (cluster.status?.phase !== "connected") {
      return undefined;
    }
    return this.latencyCache.get(cluster.getId()) ?? undefined;
  }

  /**
   * Pull: Welcome 진입 시 단일 클러스터 latency를 IPC로 조회한다.
   */
  async refreshLatency(clusterId: string): Promise<void> {
    try {
      const latencyMs: number | null = await ipcRenderer.invoke(clusterGetLatencyChannel, clusterId);
      runInAction(() => {
        this.latencyCache.set(clusterId, latencyMs);
      });
    } catch {
      runInAction(() => {
        this.latencyCache.set(clusterId, null);
      });
    }
  }

  /**
   * Push: broadcastMessage 리스너를 등록하여 30초마다 자동 갱신 값을 수신한다.
   */
  startListeningForLatency(): void {
    if (this.latencyListenerDisposer) return;

    const handler = (_event: Electron.IpcRendererEvent, data: ClusterLatencyData) => {
      runInAction(() => {
        this.latencyCache.set(data.clusterId, data.latencyMs);
      });
    };

    ipcRenderer.on(clusterLatencyUpdateChannel, handler);
    this.latencyListenerDisposer = () => {
      ipcRenderer.removeListener(clusterLatencyUpdateChannel, handler);
    };
  }

  /**
   * Push 리스너를 해제한다. 컴포넌트 언마운트 시 호출.
   */
  stopListeningForLatency(): void {
    this.latencyListenerDisposer?.();
    this.latencyListenerDisposer = null;
  }

  /**
   * 🎯 목적: 특정 클러스터의 Pod Status 갱신
   *
   * @param clusterId - 갱신할 클러스터 ID
   *
   * 📝 주의사항:
   * - IPC를 통해 Main Process에서 실제 Pod 데이터 조회
   * - 연결되지 않은 클러스터는 자동으로 null 반환
   * - 에러 발생 시 캐시에서 제거
   *
   * 🔄 변경이력:
   * - 2025-11-19 - 초기 생성 (IPC 기반 Pod Status 조회)
   */
  async refreshPodStatus(clusterId: string): Promise<void> {
    // 🔄 로딩 상태 시작
    runInAction(() => {
      this.loadingStatus.set(clusterId, true);
    });

    try {
      // 🎯 Main Process에 Pod Status 조회 요청
      const podStatus = await ipcRenderer.invoke(clusterGetPodStatusChannel, clusterId);

      // 🔄 캐시 업데이트
      runInAction(() => {
        if (podStatus) {
          this.podStatusCache.set(clusterId, podStatus);
        } else {
          // 연결 끊김 또는 에러 시 캐시에서 제거
          this.podStatusCache.delete(clusterId);
        }
        this.loadingStatus.set(clusterId, false);
      });
    } catch (error) {
      console.error(`[WelcomeClustersAdapter] Failed to refresh pod status for ${clusterId}:`, error);

      // 🚨 에러 시 캐시에서 제거 및 로딩 종료
      runInAction(() => {
        this.podStatusCache.delete(clusterId);
        this.loadingStatus.set(clusterId, false);
      });
    }
  }

  /**
   * 🎯 목적: 특정 클러스터의 메트릭 갱신
   *
   * @param clusterId - 갱신할 클러스터 ID
   *
   * 📝 주의사항:
   * - IPC를 통해 Main Process에서 실제 메트릭 데이터 조회
   * - 연결되지 않은 클러스터는 자동으로 null 반환
   * - 에러 발생 시 캐시에서 제거
   *
   * 🔄 변경이력:
   * - 2025-11-30 - 초기 생성 (IPC 기반 메트릭 조회)
   */
  async refreshMetrics(clusterId: string): Promise<void> {
    // 🔄 로딩 상태 시작
    runInAction(() => {
      this.metricsLoadingStatus.set(clusterId, true);
    });

    try {
      // 🎯 Main Process에 메트릭 조회 요청
      const metrics = await ipcRenderer.invoke(clusterGetMetricsChannel, clusterId);

      // 🔄 캐시 업데이트
      runInAction(() => {
        if (metrics) {
          this.metricsCache.set(clusterId, metrics);
        } else {
          // 연결 끊김 또는 에러 시 캐시에서 제거
          this.metricsCache.delete(clusterId);
        }
        this.metricsLoadingStatus.set(clusterId, false);
      });
    } catch (error) {
      console.error(`[WelcomeClustersAdapter] Failed to refresh metrics for ${clusterId}:`, error);

      // 🚨 에러 시 캐시에서 제거 및 로딩 종료
      runInAction(() => {
        this.metricsCache.delete(clusterId);
        this.metricsLoadingStatus.set(clusterId, false);
      });
    }
  }

  /**
   * 🎯 목적: 연결된 모든 클러스터의 Pod Status 및 메트릭 갱신
   *
   * @param parallelLimit - 병렬 조회 제한 (기본값: 5)
   *
   * 📝 주의사항:
   * - 연결된 클러스터만 조회
   * - 병렬 제한으로 네트워크 부하 관리
   * - 점진적 렌더링: 100ms 간격으로 순차 조회
   * - Pod Status와 메트릭을 함께 조회
   *
   * 🔄 변경이력:
   * - 2025-11-19 - 초기 생성 (병렬 제한 및 점진적 렌더링)
   * - 2025-11-30 - 메트릭 조회 추가
   */
  async refreshAllConnectedClusters(parallelLimit = 5): Promise<void> {
    // 🔍 연결된 클러스터만 필터링
    const connectedClusters = this.catalogRegistry.filteredItems
      .filter((entity) => entity.kind === "KubernetesCluster")
      .filter((cluster) => (cluster as KubernetesCluster).status?.phase === "connected");

    // 🎯 병렬 제한 적용
    for (let i = 0; i < connectedClusters.length; i += parallelLimit) {
      const batch = connectedClusters.slice(i, i + parallelLimit);

      // 배치 단위로 병렬 조회 (Pod Status + 메트릭)
      await Promise.all(
        batch.map(async (cluster, index) => {
          // 점진적 렌더링: 10ms 간격 (성능 개선 - 100ms → 10ms)
          await new Promise((resolve) => setTimeout(resolve, index * 10));
          const clusterId = cluster.getId();

          // Pod Status, 메트릭, Latency를 병렬로 조회
          await Promise.all([
            this.refreshPodStatus(clusterId),
            this.refreshMetrics(clusterId),
            this.refreshLatency(clusterId),
          ]);
        }),
      );
    }
  }

  /**
   * 🎯 목적: 클러스터의 로딩 상태 확인
   *
   * @param clusterId - 확인할 클러스터 ID
   * @returns 로딩 중 여부
   */
  isLoading(clusterId: string): boolean {
    return this.loadingStatus.get(clusterId) ?? false;
  }

  /**
   * 🎯 목적: Pod Status 캐시 존재 여부 확인
   *
   * @param clusterId - 확인할 클러스터 ID
   * @returns Pod Status가 캐시에 있는지 여부
   *
   * 📝 주의사항:
   * - MobX Reaction에서 중복 조회 방지용으로 사용
   */
  hasPodStatus(clusterId: string): boolean {
    return this.podStatusCache.has(clusterId);
  }
}
