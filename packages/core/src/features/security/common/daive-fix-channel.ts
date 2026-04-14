/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: DAIVE /fix-security IPC 채널 타입 정의
 * finding 데이터 → DAIVE system message IPC 채널
 *
 * Security Dashboard → DAIVE Agent로 보낼 컨텍스트 타입을 정의합니다.
 * Main Process에 직접 전달하지 않고, AIChatPanelStore의
 * agentRequestChannel(ai-assistant:agent-request)을 통해 메시지를 주입합니다.
 *
 * @packageDocumentation
 */

import { FindingType, ScannerSource, Severity } from "../../../common/security/security-finding";
import { isValidImageTarget, stripOsSuffix } from "./daive-image-validator";

import type { AnySecurityFinding } from "../../../common/security/security-finding";

// ============================================
// DAIVE에 전달할 Finding 요약 타입
// ============================================

/**
 * IPC로 직렬화 가능한 finding 요약
 * MobX observable 제거 + 필요한 필드만 포함
 */
export interface DaiveFixFindingSummary {
  type: FindingType;
  severity: Severity;
  title: string;
  source: ScannerSource;
  resource: {
    kind: string;
    name: string;
    namespace?: string;
  };
  /** CVE ID (CVE finding의 경우) */
  cveId?: string;
  /** 영향받는 패키지명 — CVE findings only */
  packageName?: string;
  /** CVSS score */
  cvssScore?: number;
  /** 설치된 버전 */
  installedVersion?: string;
  /** 수정된 버전 */
  fixedVersion?: string;
  /** Check ID (Misconfiguration/RBAC) */
  checkId?: string;
  /** trivy Result.Class — os-pkgs, lang-pkgs, config, secret */
  trivyClass?: string;
  /**
   * 컨테이너 이미지 URI (CVE finding에서만 해당)
   * 예: "docker.io/library/postgres:16-alpine", "ghcr.io/org/app:v1.0"
   * trivy Target 파싱 결과를 담음 — 없으면 워크로드 key 사용
   */
  imageUri?: string;
}

/**
 * DAIVE에 전달할 클러스터 정보
 */
export interface DaiveFixClusterInfo {
  clusterId: string;
  clusterName: string | null;
  contextName: string | null;
}

/**
 * DAIVE fix 요청 컨텍스트 (IPC payload)
 */
export interface DaiveFixContext {
  cluster: DaiveFixClusterInfo;
  findings: DaiveFixFindingSummary[];
  /** 요청 소스 (단건/bulk/전체) */
  scope: "single" | "bulk" | "all";
}

// ============================================
// Finding → DaiveFixFindingSummary 변환 유틸리티
// ============================================

/**
 * AnySecurityFinding[] → DaiveFixFindingSummary[] 변환
 * MobX observable 필드를 plain 객체로 변환 (IPC 직렬화 안전)
 */
export function toFixFindingSummaries(findings: AnySecurityFinding[]): DaiveFixFindingSummary[] {
  return findings.map((f) => {
    const base: DaiveFixFindingSummary = {
      type: f.type,
      severity: f.severity,
      title: f.title,
      source: f.source,
      resource: {
        kind: f.resource.kind,
        name: f.resource.name,
        namespace: f.resource.namespace ?? undefined,
      },
    };

    if (f.type === FindingType.CVE) {
      const cve = f as import("../../../common/security/security-finding").CveFinding;
      base.cveId = cve.cveId;
      base.cvssScore = cve.cvssScore;
      base.installedVersion = cve.installedVersion;
      base.fixedVersion = cve.fixedVersion ?? undefined;
      base.trivyClass = cve.trivyClass;
      base.packageName = cve.packageName;
      // resource.kind === "Image"일 때 resource.name이 이미지 URI
      // trivy image scan 또는 parseK8sTarget에서 kind=Image로 파싱된 경우
      // isValidImageTarget 검사 통일 적용 (kind=Image도 동일하게 필터링)
      if (f.resource.kind === "Image") {
        const cleanedName = stripOsSuffix(f.resource.name);
        if (isValidImageTarget(cleanedName)) {
          base.imageUri = cleanedName;
        }
        // 유효하지 않은 이미지 URI는 imageUri 미세팅 → cve_report_only 분류
      } else if (
        f.resource.kind === "Deployment" ||
        f.resource.kind === "Pod" ||
        f.resource.kind === "DaemonSet" ||
        f.resource.kind === "StatefulSet" ||
        f.resource.kind === "ReplicaSet" ||
        f.resource.kind === "Job" ||
        f.resource.kind === "CronJob"
      ) {
        //: trivy k8s 스캔 — rawLog.Target 또는 rawLog.ImageID → imageUri fallback
        // OS suffix strip 후 저장 (trivy Target: "image:tag (os info)" 형식)
        const raw = f.rawLog as Record<string, unknown> | undefined;
        const target = typeof raw?.["Target"] === "string" ? stripOsSuffix(raw["Target"] as string) : undefined;
        const imageId = typeof raw?.["ImageID"] === "string" ? stripOsSuffix(raw["ImageID"] as string) : undefined;
        if (target && isValidImageTarget(target)) {
          base.imageUri = target;
        } else if (imageId && isValidImageTarget(imageId)) {
          base.imageUri = imageId;
        }
        // 없으면 workload: prefix fallback (groupCveByImage에서 처리)
      }
    } else if (f.type === FindingType.Misconfiguration || f.type === FindingType.RBAC) {
      const mc = f as import("../../../common/security/security-finding").MisconfigFinding;
      base.checkId = mc.checkId;
      base.trivyClass = mc.trivyClass;
    }

    return base;
  });
}
