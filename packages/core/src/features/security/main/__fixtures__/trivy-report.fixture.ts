/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Trivy k8s JSON 출력 fixture 데이터
 * 실제 `trivy k8s --all-namespaces --format json all` 출력 형식 기반
 */

import type { TrivyReport } from "../trivy-normalizer";

/** 정상 케이스: CVE + Misconfiguration 혼합 */
export const TRIVY_MIXED_REPORT: TrivyReport = {
  SchemaVersion: 2,
  ArtifactName: "test-cluster",
  Results: [
    {
      Target: "Deployment/default/my-app (container my-container)",
      Class: "os-pkgs",
      Type: "debian",
      Vulnerabilities: [
        {
          VulnerabilityID: "CVE-2024-1234",
          PkgName: "libssl",
          InstalledVersion: "1.1.1n-0+deb11u4",
          FixedVersion: "1.1.1n-0+deb11u5",
          Severity: "CRITICAL",
          Title: "OpenSSL buffer overflow",
          Description: "A buffer overflow vulnerability exists in OpenSSL.",
          References: ["https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-1234"],
          CVSS: {
            nvd: { V3Score: 9.8, V3Vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" },
          },
        },
        {
          VulnerabilityID: "CVE-2024-5678",
          PkgName: "curl",
          InstalledVersion: "7.74.0-1.3+deb11u3",
          Severity: "HIGH",
          Title: "curl integer overflow",
          Description: "An integer overflow vulnerability exists in curl.",
          References: [],
          CVSS: {
            nvd: { V3Score: 7.5 },
            redhat: { V3Score: 6.5 },
          },
        },
      ],
    },
    {
      Target: "Pod/kube-system/coredns-xxx",
      Class: "config",
      Type: "kubernetes",
      Misconfigurations: [
        {
          ID: "KSV001",
          Title: "Process can elevate its own privileges",
          Description:
            "A program inside the container can elevate its own privileges using set-user-ID or set-group-ID.",
          Severity: "MEDIUM",
          Resolution: "Set allowPrivilegeEscalation to false.",
          References: ["https://kubernetes.io/docs/tasks/configure-pod-container/security-context/"],
          PrimaryURL: "https://avd.aquasec.com/misconfig/ksv001",
          Type: "Kubernetes Security Check",
        },
        {
          ID: "KSV012",
          Title: "Runs as root user",
          Description: "Container runs as root user which may allow privilege escalation.",
          Severity: "HIGH",
          Resolution: "Set runAsNonRoot to true or runAsUser to a non-zero value.",
          Type: "Kubernetes Security Check",
        },
      ],
    },
  ],
};

/** 빈 Results 케이스 */
export const TRIVY_EMPTY_RESULTS: TrivyReport = {
  SchemaVersion: 2,
  Results: [],
};

/** Results 없는 케이스 */
export const TRIVY_NO_RESULTS: TrivyReport = {
  SchemaVersion: 2,
};

/** 이미지 스캔 타겟 케이스 */
export const TRIVY_IMAGE_TARGET: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "nginx:1.24.0 (debian 11.7)",
      Class: "os-pkgs",
      Type: "debian",
      Vulnerabilities: [
        {
          VulnerabilityID: "CVE-2023-9999",
          PkgName: "zlib",
          InstalledVersion: "1:1.2.11.dfsg-2+deb11u2",
          Severity: "LOW",
          Title: "zlib issue",
        },
      ],
    },
  ],
};

/** CVE에 fixedVersion 없는 케이스 */
export const TRIVY_NO_FIX_AVAILABLE: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "Deployment/production/api-server",
      Class: "os-pkgs",
      Type: "alpine",
      Vulnerabilities: [
        {
          VulnerabilityID: "CVE-2024-9999",
          PkgName: "busybox",
          InstalledVersion: "1.34.1-r7",
          Severity: "UNKNOWN",
          Title: "busybox vulnerability",
          Description: "A vulnerability in busybox with no fix available.",
        },
      ],
    },
  ],
};

/** 잘못된 JSON 구조 케이스 */
export const TRIVY_INVALID_STRUCTURE = {
  NotResults: "wrong",
  SomeOtherField: 123,
};

/**  추가 fixture */

/** 빈 문자열 target 케이스 */
export const TRIVY_EMPTY_STRING_TARGET: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "",
      Class: "config",
      Type: "kubernetes",
      Misconfigurations: [
        {
          ID: "KSV001",
          Title: "Empty target misconfig",
          Severity: "LOW",
        },
      ],
    },
  ],
};

/** VulnerabilityID 없는 CVE (UUID fallback) */
export const TRIVY_MISSING_CVE_ID: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "Deployment/default/my-app",
      Class: "os-pkgs",
      Type: "debian",
      Vulnerabilities: [
        {
          PkgName: "libssl",
          InstalledVersion: "1.0.0",
          Severity: "HIGH",
          Title: "Unknown CVE",
        },
      ],
    },
  ],
};

/** ID도 AVDID도 없는 Misconfig (UUID fallback) */
export const TRIVY_MISSING_MISCONFIG_ID: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "Pod/default/my-pod",
      Class: "config",
      Type: "kubernetes",
      Misconfigurations: [
        {
          Title: "Unknown misconfig",
          Description: "No ID assigned.",
          Severity: "MEDIUM",
        },
      ],
    },
  ],
};

/** 여러 Result (multi-resource) */
export const TRIVY_MULTI_RESOURCE: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "Deployment/default/app-a",
      Class: "os-pkgs",
      Type: "debian",
      Vulnerabilities: [
        {
          VulnerabilityID: "CVE-2024-0001",
          PkgName: "libssl",
          InstalledVersion: "1.0.0",
          Severity: "HIGH",
          Title: "App A CVE",
        },
      ],
    },
    {
      Target: "Deployment/production/app-b",
      Class: "os-pkgs",
      Type: "alpine",
      Vulnerabilities: [
        {
          VulnerabilityID: "CVE-2024-0002",
          PkgName: "musl",
          InstalledVersion: "1.2.3",
          Severity: "CRITICAL",
          Title: "App B CVE",
        },
      ],
    },
    {
      Target: "Pod/kube-system/dns",
      Class: "config",
      Type: "kubernetes",
      Misconfigurations: [
        {
          ID: "KSV003",
          Title: "DNS misconfig",
          Severity: "LOW",
          Resolution: "Fix DNS config.",
        },
      ],
    },
  ],
};

/** Vulnerabilities/Misconfigurations 모두 없는 Result */
export const TRIVY_RESULT_NO_FINDINGS: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "Deployment/default/clean-app",
      Class: "os-pkgs",
      Type: "debian",
    },
  ],
};

/** CVSS 없는 CVE */
export const TRIVY_NO_CVSS: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "Deployment/default/my-app",
      Class: "os-pkgs",
      Type: "debian",
      Vulnerabilities: [
        {
          VulnerabilityID: "CVE-2024-NOCVSS",
          PkgName: "bash",
          InstalledVersion: "5.1.4",
          Severity: "MEDIUM",
          Title: "bash issue",
        },
      ],
    },
  ],
};

/** PrimaryURL 없는 Misconfig */
export const TRIVY_MISCONFIG_NO_PRIMARY_URL: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "Pod/default/my-pod",
      Class: "config",
      Type: "kubernetes",
      Misconfigurations: [
        {
          ID: "KSV099",
          Title: "No primary URL",
          Description: "This misconfig has no PrimaryURL.",
          Severity: "LOW",
          References: ["https://kubernetes.io/docs/"],
        },
      ],
    },
  ],
};

/** References 빈 배열 + PrimaryURL 없는 Misconfig → references undefined */
export const TRIVY_MISCONFIG_EMPTY_REFS: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "Pod/default/my-pod",
      Class: "config",
      Type: "kubernetes",
      Misconfigurations: [
        {
          ID: "KSV098",
          Title: "No refs at all",
          Severity: "LOW",
        },
      ],
    },
  ],
};

/** Severity 빈 문자열 → Unknown */
export const TRIVY_EMPTY_SEVERITY: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "Deployment/default/my-app",
      Class: "os-pkgs",
      Type: "debian",
      Vulnerabilities: [
        {
          VulnerabilityID: "CVE-2024-NOSEV",
          PkgName: "curl",
          InstalledVersion: "7.0.0",
          Severity: "",
          Title: "Empty severity CVE",
        },
      ],
    },
  ],
};

/** AVDID만 있는 Misconfig (ID 없음) */
export const TRIVY_AVDID_ONLY: TrivyReport = {
  SchemaVersion: 2,
  Results: [
    {
      Target: "Pod/staging/my-pod",
      Class: "config",
      Type: "kubernetes",
      Misconfigurations: [
        {
          AVDID: "AVD-KSV-0001",
          Title: "AVDID only misconfig",
          Severity: "HIGH",
          Resolution: "Fix it.",
        },
      ],
    },
  ],
};
