/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 관리형 쿠버네티스 클러스터 감지
 *
 * 📝 주의사항:
 * - EKS, GKE, AKS, NKS 등 관리형 클러스터는 Control Plane이 클라우드에서 관리됨
 * - 이 경우 Master Nodes가 사용자에게 노출되지 않음
 * - Server URL 패턴 기반으로 독립적으로 감지 (다른 detector 의존 없음)
 *
 * 🔄 변경이력:
 * - 2026-01-22 - 최초 생성 (관리형 클러스터 UI 개선)
 * - 2026-01-22 - 독립 감지 로직으로 변경 (병렬 실행 문제 해결)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ClusterMetadataKey } from "../../common/cluster-types";
import clusterApiUrlInjectable from "../../features/cluster/connections/main/api-url.injectable";
import { clusterMetadataDetectorInjectionToken } from "./token";

/**
 * 관리형 쿠버네티스 Server URL 패턴
 * Control Plane이 클라우드 제공업체에 의해 관리되는 서비스들
 */
const MANAGED_SERVER_PATTERNS = [
  /\.eks\.amazonaws\.com$/, // Amazon EKS
  /\.azmk8s\.io$/, // Azure AKS
  /\.gke\.io$/, // Google GKE (일부)
  /gke\..*\..*\.cloud\.google\.com$/, // Google GKE (신규 패턴)
  /vnks\.ntruss\.com$/, // Naver Cloud NKS
  /k8s\.ondigitalocean\.com$/, // DigitalOcean Kubernetes
  /containers\.cloud\.ibm\.com$/, // IBM Cloud Kubernetes Service
  /\.tke\.cloud\.tencent\.com$/, // Tencent Cloud TKE
] as const;

/**
 * 관리형 쿠버네티스 버전 문자열 패턴
 * Server URL로 감지 안 될 경우 fallback
 */
const MANAGED_VERSION_PATTERNS = [
  /eks/i, // Amazon EKS
  /gke/i, // Google GKE
  /aks/i, // Azure AKS (드물게 버전에 포함)
  /-aliyun/i, // Alibaba Cloud ACK
  /-CCE/i, // Huawei Cloud CCE
  /-tke\./i, // Tencent Cloud TKE
  /IKS/i, // IBM Cloud Kubernetes Service
] as const;

const clusterManagedDetectorInjectable = getInjectable({
  id: "cluster-managed-detector",
  instantiate: (di) => {
    return {
      key: ClusterMetadataKey.IS_MANAGED,
      detect: async (cluster) => {
        // 방법 1: Server URL 패턴 매칭 (정확도 높음)
        try {
          const apiUrl = await di.inject(clusterApiUrlInjectable, cluster)();

          if (MANAGED_SERVER_PATTERNS.some((pattern) => pattern.test(apiUrl.hostname))) {
            return { value: true, accuracy: 95 };
          }
        } catch {
          // API URL 가져오기 실패 시 다음 방법으로
        }

        // 방법 2: 버전 문자열 패턴 매칭 (Fallback)
        try {
          const version = cluster.metadata[ClusterMetadataKey.VERSION];

          if (typeof version === "string" && MANAGED_VERSION_PATTERNS.some((pattern) => pattern.test(version))) {
            return { value: true, accuracy: 80 };
          }
        } catch {
          // 버전 정보 없으면 무시
        }

        // 기본값: 자체 관리형 클러스터로 간주
        return { value: false, accuracy: 70 };
      },
    };
  },
  injectionToken: clusterMetadataDetectorInjectionToken,
});

export default clusterManagedDetectorInjectable;
