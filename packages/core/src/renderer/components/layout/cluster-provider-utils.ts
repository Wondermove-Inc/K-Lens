/**
 * 🎯 목적: Kubernetes 클러스터의 Cloud Provider 타입 추론 및 정보 제공
 *
 * 📝 주요 기능:
 * - metadata.distro 필드 기반 Cloud Provider 타입 자동 감지
 * - Provider별 브랜드 색상 및 표시명 제공
 * - 6가지 Provider 지원: AWS, Azure, GCP, Docker, Oracle, Private
 */

import type { KubernetesCluster } from "../../../common/catalog-entities";

/**
 * 지원하는 Cloud Provider 타입
 */
export type ClusterProviderType = "aws" | "azure" | "gcp" | "docker" | "oracle" | "naver" | "private";

/**
 * Cloud Provider 상세 정보
 */
export interface ClusterProviderInfo {
  /** Provider 타입 */
  type: ClusterProviderType;
  /** UI 표시명 */
  displayName: string;
  /** 브랜드 색상 (HEX) */
  color: string;
}

/**
 * 🎯 목적: 클러스터의 distro 정보로부터 Cloud Provider 타입 추론
 *
 * @param cluster - KubernetesCluster 엔티티
 * @returns Provider 타입 (aws/azure/gcp/docker/oracle/private)
 *
 * 📝 추론 규칙:
 * - AWS: "eks", "aws", "kops" 포함
 * - Azure: "aks", "azure" 포함
 * - GCP: "gke", "gcp", "google" 포함
 * - Docker: "docker", "kind" 포함
 * - Oracle: "oracle", "oke" 포함
 * - Private: 위 조건에 해당하지 않는 모든 경우 (기본값)
 *
 * 🔄 변경이력: 2025-11-11 - 초기 생성
 */
export function inferProviderFromDistro(distro?: string): ClusterProviderType {
  const d = distro?.toLowerCase() || "";

  if (d.includes("eks") || d.includes("aws") || d.includes("kops")) return "aws";
  if (d.includes("aks") || d.includes("azure")) return "azure";
  if (d.includes("gke") || d.includes("gcp") || d.includes("google")) return "gcp";
  if (d.includes("docker") || d.includes("kind")) return "docker";
  if (d.includes("oracle") || d.includes("oke")) return "oracle";
  if (d.includes("nks") || d.includes("naver") || d.includes("ncloud")) return "naver";

  return "private";
}

export function inferCloudProvider(cluster: KubernetesCluster): ClusterProviderType {
  return inferProviderFromDistro(cluster.metadata.distro);
}

/**
 * 🎯 목적: Provider 타입에 따른 상세 정보 반환 (브랜드 색상 포함)
 *
 * @param providerType - Provider 타입
 * @returns Provider 상세 정보 (표시명, 브랜드 색상)
 *
 * 📝 브랜드 색상: CSS 변수 사용 (--provider-*)
 * - AWS: var(--provider-aws) - 주황색
 * - Azure: var(--provider-azure) - 파란색
 * - GCP: var(--provider-gcp) - 구글 파란색
 * - Docker: var(--provider-docker) - Docker 파란색
 * - Oracle: var(--provider-oracle) - 빨간색
 * - Naver: var(--provider-naver) - 초록색
 * - Private: var(--color-primary) - 테마 Primary 색상
 *
 * 🔄 변경이력:
 * - 2025-11-11 - 초기 생성
 * - 2026-01-31 - THEME-023: CSS 변수로 마이그레이션
 */
export function getProviderInfo(providerType: ClusterProviderType): ClusterProviderInfo {
  // 🎯 THEME-023: CSS 변수 사용으로 중앙 집중식 색상 관리
  const PROVIDER_MAP: Record<ClusterProviderType, ClusterProviderInfo> = {
    aws: {
      type: "aws",
      displayName: "AWS",
      color: "var(--provider-aws)", // 🎯 THEME-023: CSS 변수 사용
    },
    azure: {
      type: "azure",
      displayName: "Azure",
      color: "var(--provider-azure)", // 🎯 THEME-023: CSS 변수 사용
    },
    gcp: {
      type: "gcp",
      displayName: "Google Cloud",
      color: "var(--provider-gcp)", // 🎯 THEME-023: CSS 변수 사용
    },
    docker: {
      type: "docker",
      displayName: "Docker",
      color: "var(--provider-docker)", // 🎯 THEME-023: CSS 변수 사용
    },
    oracle: {
      type: "oracle",
      displayName: "Oracle Cloud",
      color: "var(--provider-oracle)", // 🎯 THEME-023: CSS 변수 사용
    },
    naver: {
      type: "naver",
      displayName: "Naver Cloud",
      color: "var(--provider-naver)", // 🎯 THEME-023: CSS 변수 사용
    },
    private: {
      type: "private",
      displayName: "Kubernetes",
      color: "var(--color-primary)", // 🎯 테마 Primary 색상 사용
    },
  };

  return PROVIDER_MAP[providerType];
}
