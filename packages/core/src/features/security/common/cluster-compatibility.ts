/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Kubernetes 클러스터 환경 감지
 *
 * OpenShift SCC, EKS/GKE/AKS provider 전용 시스템 NS를 감지하여
 * daive-tier-classifier가 더 정확하게 unsafe_ksv를 분류할 수 있도록 지원.
 *
 * 실제 kubectl 호출은 Main Process(fix-snapshot-handler 등)에서 수행하고,
 * 결과를 ClusterEnvironment로 변환하여 classifyFindings()에 전달.
 *
 * @packageDocumentation
 */

// ============================================
// ClusterEnvironment 타입
// ============================================

export type ClusterProvider = "kubeadm" | "eks" | "gke" | "aks" | "openshift" | "k3s" | "unknown";

export interface ClusterEnvironment {
  /** 클러스터 프로바이더 판별 결과 */
  provider: ClusterProvider;
  /**
   * OpenShift SCC(SecurityContextConstraints) 사용 여부.
   * true이면 KSV securityContext 패치가 SCC와 충돌 가능 → unsafe_ksv 강제.
   */
  hasOpenShiftSCC: boolean;
  /**
   * 자동 수집된 시스템 네임스페이스 Set.
   * 이 NS에 속한 finding은 ALWAYS_TIER3_NAMESPACES와 동일하게 unsafe_ksv로 분류.
   */
  systemNamespaces: Set<string>;
}

// ============================================
// KSV securityContext 관련 checkId (OpenShift SCC 충돌 대상)
// ============================================

/**
 * OpenShift SCC 환경에서 패치 시 충돌 가능한 KSV checkId 목록.
 * hasOpenShiftSCC = true 이면 이 checkId들은 unsafe_ksv로 강제 분류.
 */
export const OPENSHIFT_SCC_CONFLICT_CHECK_IDS = new Set<string>([
  "KSV-0001", // runAsNonRoot (pod-level)
  "KSV-0012", // runAsUser
  "KSV-0014", // runAsGroup
  "KSV-0017", // privileged: false
  "KSV-0020", // runAsNonRoot
  "KSV-0021", // runAsNonRoot UID > 0
  "KSV-0022", // runAsNonRoot (container-level)
  "KSV-0032", // allowPrivilegeEscalation
  "KSV-0036", // capabilities.drop: ALL
  "KSV-0045", // hostPath volumes
  "KSV-0048", // capabilities.drop: [ALL]
]);

// ============================================
// detectClusterEnvironment
// ============================================

/**
 * kubectl api-resources / node labels / namespace 목록으로 클러스터 환경 감지.
 *
 * 호출 예시 (Main Process):
 * ```ts
 * const apiResources = (await kubectl(clusterId, "api-resources", ["--output=name"])).stdout;
 * const nodeJson = JSON.parse((await kubectl(clusterId, "get", ["nodes", "-o", "json"])).stdout);
 * const nodeLabels = nodeJson.items[0]?.metadata?.labels ?? {};
 * const nsList = JSON.parse((await kubectl(clusterId, "get", ["namespaces", "-o", "json"])).stdout)
 *   .items.map((n: { metadata: { name: string } }) => n.metadata.name);
 * const env = detectClusterEnvironment(apiResources, nodeLabels, nsList);
 * ```
 *
 * @param apiResources - `kubectl api-resources --output=name` 결과 문자열
 * @param nodeLabels   - 대표 노드 1개의 metadata.labels 맵
 * @param namespaceList - 클러스터 전체 namespace 이름 목록
 */
export function detectClusterEnvironment(
  apiResources: string,
  nodeLabels: Record<string, string>,
  namespaceList: string[],
): ClusterEnvironment {
  // 1. OpenShift SCC 감지
  const hasOpenShiftSCC = apiResources.includes("securitycontextconstraints");

  // 2. Provider 판별 (node label 기반)
  let provider: ClusterProvider = "unknown";
  if (hasOpenShiftSCC) {
    provider = "openshift";
  } else if (
    nodeLabels["eks.amazonaws.com/nodegroup"] !== undefined ||
    nodeLabels["alpha.eksctl.io/cluster-name"] !== undefined
  ) {
    provider = "eks";
  } else if (nodeLabels["cloud.google.com/gke-nodepool"] !== undefined) {
    provider = "gke";
  } else if (nodeLabels["kubernetes.azure.com/cluster"] !== undefined) {
    provider = "aks";
  } else if (nodeLabels["node.kubernetes.io/instance-type"]?.startsWith("k3s")) {
    provider = "k3s";
  } else if (apiResources.includes("kubeadm.k8s.io")) {
    provider = "kubeadm";
  }

  // 3. 기본 시스템 NS (모든 K8s 공통)
  const systemNamespaces = new Set<string>(["kube-system", "kube-public", "kube-node-lease"]);

  // 4. 클러스터 NS 목록에서 패턴 기반 시스템 NS 자동 수집
  for (const ns of namespaceList) {
    if (
      ns.startsWith("openshift-") || // OpenShift 운영 NS
      ns.startsWith("aws-") || // EKS 시스템 NS (aws-load-balancer-controller 등)
      ns.startsWith("gke-") || // GKE 시스템 NS
      ns.startsWith("azure-") || // AKS 시스템 NS
      ns.startsWith("calico-") || // Calico CNI
      ns.startsWith("tigera-") || // Calico Enterprise / Tigera
      ns.startsWith("istio-") || // Istio service mesh
      ns === "longhorn-system" // Longhorn 스토리지
    ) {
      systemNamespaces.add(ns);
    }
  }

  return { provider, hasOpenShiftSCC, systemNamespaces };
}

// ============================================
// 빈 환경 (env 미전달 시 fallback용)
// ============================================

/**
 * ClusterEnvironment가 없을 때 classifyFindings()에서 사용하는 기본값.
 * 기존 ALWAYS_TIER3_NAMESPACES(kube-system, longhorn-system)만 포함.
 */
export const DEFAULT_CLUSTER_ENVIRONMENT: ClusterEnvironment = {
  provider: "unknown",
  hasOpenShiftSCC: false,
  systemNamespaces: new Set(["kube-system", "longhorn-system"]),
};
