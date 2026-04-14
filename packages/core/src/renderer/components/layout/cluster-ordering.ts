/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  type KubernetesCluster,
  LensKubernetesClusterStatus,
} from "../../../common/catalog-entities/kubernetes-cluster";

/**
 * 🎯 목적: 클러스터 연결 이력 기반 사이드바 정렬에 사용할 lastSeen 타임스탬프 추출
 * ⚠️ 중요: cold start 시에만 전체 정렬에 사용하며, 런타임에는 최초 연결 여부 판별 용도로만 사용한다
 */
export const getLastSeenTimestamp = (cluster: KubernetesCluster): number => {
  const lastSeen = cluster.metadata?.lastSeen;

  if (typeof lastSeen === "number") {
    return lastSeen;
  }

  if (typeof lastSeen === "string" && lastSeen.trim().length > 0) {
    const parsed = Date.parse(lastSeen);

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

/**
 * 🎯 목적: 해당 클러스터가 최소 1회 이상 연결에 성공했는지 여부 계산
 */
export const clusterHasConnectionHistory = (cluster: KubernetesCluster): boolean => getLastSeenTimestamp(cluster) > 0;

export const clusterHasActiveConnection = (cluster: KubernetesCluster) =>
  cluster.status?.phase === LensKubernetesClusterStatus.CONNECTED;

/**
 * 🎯 목적: 클러스터 목록을 이름 기준 알파벳 순서로 정렬
 * 🔄 변경이력: 2026-01-16 - 연결 상태 기반 정렬 제거 (클릭 시 순서 변경 문제 해결)
 *    - 이전: 연결 상태 → lastSeen → 이름 순 정렬 (클릭 시 순서 변경됨)
 *    - 이후: 이름 알파벳순만 사용 (순서 항상 고정)
 */
export const sortClustersByConnectionStatus = <T extends KubernetesCluster>(clusters: readonly T[]): T[] =>
  [...clusters].sort((a, b) => a.getName().localeCompare(b.getName()));

export const getClusterOrderingIds = (clusters: readonly KubernetesCluster[]): string[] =>
  sortClustersByConnectionStatus(clusters).map((cluster) => cluster.getId());

/**
 * 🎯 목적: "미접속 → 최초 접속" 상태가 된 클러스터를 기존 정렬 순서를 존중하며 연결 그룹으로 승격
 * 🔄 변경이력: 2025-10-22 최초 작성 - 런타임 재정렬 금지 정책 준수
 */
export const promoteClusterToConnectionGroup = (
  clusters: readonly KubernetesCluster[],
  order: readonly string[],
  promotedClusterId: string,
): string[] => {
  const clusterMap = new Map(clusters.map((cluster) => [cluster.getId(), cluster] as const));
  const promotedCluster = clusterMap.get(promotedClusterId);

  if (!promotedCluster || !clusterHasConnectionHistory(promotedCluster)) {
    return [...order];
  }

  const nextOrder = order.filter((id) => id !== promotedClusterId);
  let lastConnectedIndex = -1;

  nextOrder.forEach((id, index) => {
    const cluster = clusterMap.get(id);

    if (cluster && clusterHasConnectionHistory(cluster)) {
      lastConnectedIndex = index;
    }
  });

  const insertionIndex = lastConnectedIndex + 1;
  nextOrder.splice(insertionIndex, 0, promotedClusterId);

  return nextOrder;
};
