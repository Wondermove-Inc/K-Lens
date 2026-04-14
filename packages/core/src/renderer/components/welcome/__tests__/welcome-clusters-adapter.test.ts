/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: WelcomeClustersAdapter의 스냅샷 추출 및 변환 검증
 *
 * 🔄 변경이력: 2025-10-17 - 초기 생성
 */

import { WelcomeClustersAdapter } from "../welcome-clusters-adapter";

import type { KubernetesCluster } from "../../../../common/catalog-entities/kubernetes-cluster";
import type { CatalogEntityRegistry } from "../../../api/catalog/entity/registry";

describe("WelcomeClustersAdapter", () => {
  let mockRegistry: Pick<CatalogEntityRegistry, "filteredItems">;
  let adapter: WelcomeClustersAdapter;
  let mockFilteredItems: Partial<KubernetesCluster>[];

  beforeEach(() => {
    mockFilteredItems = [];

    // 🎭 Mock CatalogEntityRegistry with getter
    mockRegistry = {
      get filteredItems() {
        return mockFilteredItems as KubernetesCluster[];
      },
    };

    adapter = new WelcomeClustersAdapter(mockRegistry as CatalogEntityRegistry);
  });

  // 🎯 목적: filteredItems (배열)에서 클러스터만 필터링하는지 확인
  it("should extract cluster entities from filteredItems array", () => {
    const mockClusters: Partial<KubernetesCluster>[] = [
      {
        kind: "KubernetesCluster",
        getId: () => "cluster-1",
        getName: () => "production-cluster",
        metadata: {
          uid: "cluster-1-uid",
          name: "production-cluster",
          distro: "k3s",
          kubeVersion: "v1.28.0",
          labels: {},
        },
        status: {
          phase: "connected",
        },
      },
      {
        kind: "KubernetesCluster",
        getId: () => "cluster-2",
        getName: () => "staging-cluster",
        metadata: {
          uid: "cluster-2-uid",
          name: "staging-cluster",
          kubeVersion: "v1.27.0",
          labels: {},
        },
        status: {
          phase: "disconnected",
        },
      },
    ];

    mockFilteredItems = mockClusters;

    const rows = adapter.tableRows;

    // ✅ 클러스터 개수 확인
    expect(rows).toHaveLength(2);

    // ✅ 첫 번째 클러스터 변환 확인
    expect(rows[0]).toEqual({
      id: "cluster-1",
      name: "production-cluster",
      status: "connected",
      distro: "k3s",
      kubeVersion: "v1.28.0",
    });

    // ✅ 두 번째 클러스터 변환 확인
    expect(rows[1]).toEqual({
      id: "cluster-2",
      name: "staging-cluster",
      status: "disconnected",
      distro: undefined,
      kubeVersion: "v1.27.0",
    });
  });

  // 🎯 목적: toJS() 변환이 순수 JavaScript 객체를 반환하는지 확인
  it("should return plain JavaScript objects", () => {
    mockFilteredItems = [
      {
        kind: "KubernetesCluster",
        getId: () => "test-1",
        metadata: { uid: "test-1-uid", name: "test-cluster", labels: {} },
        status: { phase: "connected" },
      },
    ];

    const rows = adapter.tableRows;

    // ✅ 순수 배열이어야 함
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0]).toEqual({
      id: "test-1",
      name: "test-cluster",
      status: "connected",
      distro: undefined,
      kubeVersion: undefined,
    });
  });

  // 🎯 목적: 빈 배열을 올바르게 처리하는지 확인
  it("should return empty array when no clusters exist", () => {
    mockFilteredItems = [];
    const rows = adapter.tableRows;

    expect(rows).toHaveLength(0);
    expect(Array.isArray(rows)).toBe(true);
  });

  // 🎯 목적: status가 undefined일 때 "unknown"으로 처리하는지 확인
  it("should handle undefined status safely", () => {
    mockFilteredItems = [
      {
        kind: "KubernetesCluster",
        getId: () => "test-2",
        metadata: { uid: "test-2-uid", name: "no-status-cluster", labels: {} },
        status: undefined, // ⚠️ status가 undefined인 경우
      },
    ];

    const rows = adapter.tableRows;

    expect(rows[0]).toEqual({
      id: "test-2",
      name: "no-status-cluster",
      status: "unknown", // ✅ "unknown"으로 변환되어야 함
      distro: undefined,
      kubeVersion: undefined,
    });
  });

  // 🎯 목적: 클러스터가 아닌 엔티티는 필터링되는지 확인
  it("should filter out non-cluster entities", () => {
    mockFilteredItems = [
      {
        kind: "KubernetesCluster",
        getId: () => "cluster-1",
        metadata: { uid: "cluster-1-uid", name: "my-cluster", labels: {} },
        status: { phase: "connected" },
      },
      {
        kind: "SomeOtherEntity", // ⚠️ 클러스터가 아닌 엔티티
        getId: () => "other-1",
        metadata: { uid: "other-1-uid", name: "other-entity", labels: {} },
        status: { phase: "active" },
      },
    ];

    const rows = adapter.tableRows;

    // ✅ 클러스터만 포함되어야 함
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("cluster-1");
  });
});
