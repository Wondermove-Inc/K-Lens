/**
 * 🎯 목적: Cloud Provider 타입별 브랜드 아이콘 렌더링 컴포넌트
 *
 * 📝 주요 기능:
 * - react-icons (Simple Icons) 사용
 * - 7가지 Provider 아이콘 지원 (aws, azure, gcp, docker, oracle, naver, private)
 * - className prop으로 스타일 커스터마이징 가능
 *
 * 🔄 변경이력:
 * - 2025-11-11 - 초기 생성
 * - 2025-11-11 - Azure 아이콘 lucide-react Cloud로 대체 (react-icons에 Azure 아이콘 없음)
 * - 2026-01-15 - Naver Cloud (NKS) 아이콘 추가
 */

import { Cloud } from "lucide-react"; // Azure 대체 아이콘
import React from "react";
import { SiAmazonwebservices, SiDocker, SiGooglecloud, SiKubernetes, SiNaver, SiOracle } from "react-icons/si";

import type { ClusterProviderType } from "./cluster-provider-utils";

interface ClusterProviderIconProps {
  /** Cloud Provider 타입 */
  provider: ClusterProviderType;
  /** 아이콘 스타일 className (예: "h-4 w-4 text-white") */
  className?: string;
}

/**
 * 🎯 목적: Cloud Provider 타입에 맞는 브랜드 아이콘 렌더링
 *
 * @param provider - Provider 타입 (aws/azure/gcp/docker/oracle/naver/private)
 * @param className - 아이콘에 적용할 CSS 클래스
 *
 * 📝 사용 예시:
 * ```tsx
 * <ClusterProviderIcon provider="aws" className="h-4 w-4 text-white" />
 * <ClusterProviderIcon provider="docker" className="h-6 w-6" />
 * ```
 *
 * 🎨 아이콘 매핑:
 * - aws → SiAmazonwebservices (AWS 로고)
 * - azure → Cloud (lucide-react, react-icons에 Azure 아이콘 없음)
 * - gcp → SiGooglecloud (Google Cloud 로고)
 * - docker → SiDocker (Docker 로고)
 * - oracle → SiOracle (Oracle 로고)
 * - naver → SiNaver (Naver Cloud 로고)
 * - private → SiKubernetes (Kubernetes 로고)
 *
 * 🔄 변경이력:
 * - 2025-11-11 - 초기 생성
 * - 2025-11-11 - Azure에 lucide Cloud 아이콘 사용
 */
export function ClusterProviderIcon({ provider, className }: ClusterProviderIconProps) {
  const iconProps = { className };

  switch (provider) {
    case "aws":
      return <SiAmazonwebservices {...iconProps} />;

    case "azure":
      // ⚠️ react-icons에 Azure 브랜드 아이콘 없음 → lucide Cloud 아이콘 사용
      return <Cloud {...iconProps} />;

    case "gcp":
      return <SiGooglecloud {...iconProps} />;

    case "docker":
      return <SiDocker {...iconProps} />;

    case "oracle":
      return <SiOracle {...iconProps} />;

    case "naver":
      // 🎯 Naver Cloud (NKS) 아이콘
      return <SiNaver {...iconProps} />;

    case "private":
    default:
      // 🎯 기본값: Kubernetes 로고 (private/on-premise 또는 알 수 없는 경우)
      return <SiKubernetes {...iconProps} />;
  }
}
