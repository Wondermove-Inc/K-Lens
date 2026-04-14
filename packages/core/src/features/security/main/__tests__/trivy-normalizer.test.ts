/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Trivy 스캐너 단위 test (fixture 포함)
 *
 * test 대상: trivy-normalizer.ts
 * - normalizeTrivyReport(): 핵심 변환 함수
 * - parseK8sTarget(): Target 문자열 파싱
 * - normalizeSeverity(): Severity enum 변환
 * - extractCvssScore(): CVSS 점수 추출
 * - isTrivyReport(): 런타임 타입 가드
 */

import { FindingType, ScannerSource, Severity } from "../../../../common/security/security-finding";
import {
  TRIVY_EMPTY_RESULTS,
  TRIVY_IMAGE_TARGET,
  TRIVY_INVALID_STRUCTURE,
  TRIVY_MIXED_REPORT,
  TRIVY_NO_FIX_AVAILABLE,
  TRIVY_NO_RESULTS,
} from "../__fixtures__/trivy-report.fixture";
import {
  extractCvssScore,
  isTrivyReport,
  normalizeSeverity,
  normalizeTrivyReport,
  parseK8sTarget,
} from "../trivy-normalizer";

import type { CveFinding, MisconfigFinding } from "../../../../common/security/security-finding";

const CLUSTER_ID = "test-cluster-id";

// ============================================
// normalizeSeverity
// ============================================

describe("normalizeSeverity", () => {
  it.each([
    ["CRITICAL", Severity.Critical],
    ["HIGH", Severity.High],
    ["MEDIUM", Severity.Medium],
    ["LOW", Severity.Low],
    ["UNKNOWN", Severity.Unknown],
  ])("maps %s → %s", (input, expected) => {
    expect(normalizeSeverity(input)).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(normalizeSeverity("critical")).toBe(Severity.Critical);
    expect(normalizeSeverity("High")).toBe(Severity.High);
  });

  it("returns Unknown for unrecognized values", () => {
    expect(normalizeSeverity("NEGLIGIBLE")).toBe(Severity.Unknown);
    expect(normalizeSeverity(undefined)).toBe(Severity.Unknown);
    expect(normalizeSeverity("")).toBe(Severity.Unknown);
  });
});

// ============================================
// parseK8sTarget
// ============================================

describe("parseK8sTarget", () => {
  it("parses kind/namespace/name pattern", () => {
    const result = parseK8sTarget("Deployment/default/my-app (container my-container)");
    expect(result.kind).toBe("Deployment");
    expect(result.namespace).toBe("default");
    expect(result.name).toBe("my-app");
    expect(result.container).toBe("my-container");
  });

  it("parses kind/name pattern (no namespace)", () => {
    const result = parseK8sTarget("ClusterRole/system:node");
    expect(result.kind).toBe("ClusterRole");
    expect(result.name).toBe("system:node");
    expect(result.namespace).toBeUndefined();
  });

  it("parses image target pattern", () => {
    const result = parseK8sTarget("nginx:1.24.0 (debian 11.7)");
    expect(result.kind).toBe("Image");
    expect(result.name).toBe("nginx:1.24.0");
    expect(result.image).toBe("nginx:1.24.0");
  });

  it("handles undefined target", () => {
    const result = parseK8sTarget(undefined);
    expect(result.kind).toBe("Unknown");
    expect(result.name).toBe("unknown");
  });

  it("parses pod in kube-system namespace", () => {
    const result = parseK8sTarget("Pod/kube-system/coredns-xxx");
    expect(result.kind).toBe("Pod");
    expect(result.namespace).toBe("kube-system");
    expect(result.name).toBe("coredns-xxx");
  });
});

// ============================================
// extractCvssScore
// ============================================

describe("extractCvssScore", () => {
  it("returns highest V3Score among multiple providers", () => {
    const score = extractCvssScore({
      nvd: { V3Score: 9.8 },
      redhat: { V3Score: 6.5 },
    });
    expect(score).toBe(9.8);
  });

  it("falls back to V2Score when V3 is absent", () => {
    const score = extractCvssScore({
      nvd: { V2Score: 6.0 },
    });
    expect(score).toBe(6.0);
  });

  it("returns undefined when cvss is undefined", () => {
    expect(extractCvssScore(undefined)).toBeUndefined();
  });

  it("returns undefined when no scores are present", () => {
    expect(extractCvssScore({ nvd: {} })).toBeUndefined();
  });
});

// ============================================
// isTrivyReport
// ============================================

describe("isTrivyReport", () => {
  it("returns true for valid report with Results array", () => {
    expect(isTrivyReport({ Results: [] })).toBe(true);
  });

  it("returns true for report without Results (optional)", () => {
    expect(isTrivyReport({ SchemaVersion: 2 })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isTrivyReport(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isTrivyReport("string")).toBe(false);
    expect(isTrivyReport(42)).toBe(false);
  });

  it("returns false when Results is not an array", () => {
    expect(isTrivyReport({ Results: "not-array" })).toBe(false);
  });
});

// ============================================
// normalizeTrivyReport — 핵심 변환 함수
// ============================================

describe("normalizeTrivyReport", () => {
  describe("정상 케이스 — 혼합 리포트 (CVE + Misconfiguration)", () => {
    let findings: ReturnType<typeof normalizeTrivyReport>;

    beforeEach(() => {
      findings = normalizeTrivyReport(TRIVY_MIXED_REPORT, CLUSTER_ID);
    });

    it("총 4개의 finding을 반환한다 (CVE 2개 + Misconfig 2개)", () => {
      expect(findings).toHaveLength(4);
    });

    describe("CveFinding verify", () => {
      let cveFinding: CveFinding;

      beforeEach(() => {
        cveFinding = findings.find(
          (f) => f.type === FindingType.CVE && (f as CveFinding).cveId === "CVE-2024-1234",
        ) as CveFinding;
      });

      it("CveFinding 타입으로 변환된다", () => {
        expect(cveFinding).toBeDefined();
        expect(cveFinding.type).toBe(FindingType.CVE);
      });

      it("severity가 CRITICAL로 매핑된다", () => {
        expect(cveFinding.severity).toBe(Severity.Critical);
      });

      it("source가 TRIVY다", () => {
        expect(cveFinding.source).toBe(ScannerSource.Trivy);
      });

      it("cveId가 올바르게 설정된다", () => {
        expect(cveFinding.cveId).toBe("CVE-2024-1234");
      });

      it("CVSS 점수가 추출된다", () => {
        expect(cveFinding.cvssScore).toBe(9.8);
      });

      it("fixedVersion이 있으면 remediation에 포함된다", () => {
        expect(cveFinding.remediation).toContain("1.1.1n-0+deb11u5");
        expect(cveFinding.remediation).toContain("libssl");
      });

      it("resource에 kind/name/namespace가 포함된다", () => {
        expect(cveFinding.resource.kind).toBe("Deployment");
        expect(cveFinding.resource.name).toBe("my-app");
        expect(cveFinding.resource.namespace).toBe("default");
      });

      it("여러 CVSS provider 중 최고 점수를 선택한다 (CVE-2024-5678)", () => {
        const highCve = findings.find(
          (f) => f.type === FindingType.CVE && (f as CveFinding).cveId === "CVE-2024-5678",
        ) as CveFinding;
        expect(highCve.cvssScore).toBe(7.5); // nvd: 7.5 > redhat: 6.5
      });
    });

    describe("MisconfigFinding verify", () => {
      let misconfigFinding: MisconfigFinding;

      beforeEach(() => {
        misconfigFinding = findings.find(
          (f) => f.type === FindingType.Misconfiguration && (f as MisconfigFinding).checkId === "KSV001",
        ) as MisconfigFinding;
      });

      it("MisconfigFinding 타입으로 변환된다", () => {
        expect(misconfigFinding).toBeDefined();
        expect(misconfigFinding.type).toBe(FindingType.Misconfiguration);
      });

      it("severity가 MEDIUM으로 매핑된다", () => {
        expect(misconfigFinding.severity).toBe(Severity.Medium);
      });

      it("checkId가 올바르게 설정된다", () => {
        expect(misconfigFinding.checkId).toBe("KSV001");
      });

      it("remediation이 포함된다", () => {
        expect(misconfigFinding.remediation).toBe("Set allowPrivilegeEscalation to false.");
      });

      it("PrimaryURL이 references에 포함된다", () => {
        expect(misconfigFinding.references).toContain("https://avd.aquasec.com/misconfig/ksv001");
      });

      it("resource에 kind/name/namespace가 포함된다", () => {
        expect(misconfigFinding.resource.kind).toBe("Pod");
        expect(misconfigFinding.resource.namespace).toBe("kube-system");
      });
    });
  });

  describe("빈 데이터 케이스", () => {
    it("빈 Results는 빈 배열을 반환한다", () => {
      expect(normalizeTrivyReport(TRIVY_EMPTY_RESULTS, CLUSTER_ID)).toHaveLength(0);
    });

    it("Results 없는 리포트는 빈 배열을 반환한다", () => {
      expect(normalizeTrivyReport(TRIVY_NO_RESULTS, CLUSTER_ID)).toHaveLength(0);
    });

    it("null 입력은 빈 배열을 반환한다", () => {
      expect(normalizeTrivyReport(null, CLUSTER_ID)).toHaveLength(0);
    });

    it("undefined 입력은 빈 배열을 반환한다", () => {
      expect(normalizeTrivyReport(undefined, CLUSTER_ID)).toHaveLength(0);
    });

    it("잘못된 JSON 구조는 빈 배열을 반환한다", () => {
      expect(normalizeTrivyReport(TRIVY_INVALID_STRUCTURE, CLUSTER_ID)).toHaveLength(0);
    });
  });

  describe("이미지 스캔 타겟 케이스", () => {
    it("이미지 타겟의 kind가 Image로 설정된다", () => {
      const findings = normalizeTrivyReport(TRIVY_IMAGE_TARGET, CLUSTER_ID);
      expect(findings).toHaveLength(1);
      expect(findings[0].resource.kind).toBe("Image");
      expect(findings[0].resource.name).toBe("nginx:1.24.0");
    });

    it("severity LOW가 올바르게 매핑된다", () => {
      const findings = normalizeTrivyReport(TRIVY_IMAGE_TARGET, CLUSTER_ID);
      expect(findings[0].severity).toBe(Severity.Low);
    });
  });

  describe("fixedVersion 없는 케이스", () => {
    it("fixedVersion이 없으면 remediation에 fallback 메시지가 포함된다", () => {
      const findings = normalizeTrivyReport(TRIVY_NO_FIX_AVAILABLE, CLUSTER_ID);
      const cve = findings[0] as CveFinding;
      expect(cve.remediation).toBeDefined();
      expect(cve.remediation).toContain("No fixed version available");
      expect(cve.fixedVersion).toBeUndefined();
    });

    it("UNKNOWN severity가 올바르게 매핑된다", () => {
      const findings = normalizeTrivyReport(TRIVY_NO_FIX_AVAILABLE, CLUSTER_ID);
      expect(findings[0].severity).toBe(Severity.Unknown);
    });

    it("Status가 will_not_fix이면 Will Not Fix 메시지가 포함된다", () => {
      const report = {
        ...TRIVY_NO_FIX_AVAILABLE,
        Results: [
          {
            ...TRIVY_NO_FIX_AVAILABLE.Results[0],
            Vulnerabilities: [
              {
                ...TRIVY_NO_FIX_AVAILABLE.Results[0].Vulnerabilities[0],
                Status: "will_not_fix",
                FixedVersion: undefined,
              },
            ],
          },
        ],
      };
      const findings = normalizeTrivyReport(report, CLUSTER_ID);
      const cve = findings[0] as CveFinding;
      expect(cve.remediation).toContain("Will Not Fix");
    });
  });

  describe("Finding ID 고유성", () => {
    it("모든 finding의 id가 고유하다", () => {
      const findings = normalizeTrivyReport(TRIVY_MIXED_REPORT, CLUSTER_ID);
      const ids = findings.map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("finding id에 CVE ID가 포함된다", () => {
      const findings = normalizeTrivyReport(TRIVY_MIXED_REPORT, CLUSTER_ID);
      const cveFinding = findings.find(
        (f) => f.type === FindingType.CVE && (f as CveFinding).cveId === "CVE-2024-1234",
      );
      expect(cveFinding?.id).toContain("CVE-2024-1234");
    });
  });
});

// ============================================
// 추가 파싱 케이스 test
// ============================================

import {
  TRIVY_AVDID_ONLY,
  TRIVY_EMPTY_SEVERITY,
  TRIVY_EMPTY_STRING_TARGET,
  TRIVY_MISCONFIG_EMPTY_REFS,
  TRIVY_MISCONFIG_NO_PRIMARY_URL,
  TRIVY_MISSING_CVE_ID,
  TRIVY_MISSING_MISCONFIG_ID,
  TRIVY_MULTI_RESOURCE,
  TRIVY_NO_CVSS,
  TRIVY_RESULT_NO_FINDINGS,
} from "../__fixtures__/trivy-report.fixture";

describe("parseK8sTarget — 추가 케이스", () => {
  it("빈 문자열 target은 Image kind로 폴백된다", () => {
    const result = parseK8sTarget("");
    expect(result.kind).toBe("Unknown");
    expect(result.name).toBe("unknown");
  });

  it("container 이름에 콜론 포함된 경우도 파싱된다", () => {
    const result = parseK8sTarget("Deployment/default/my-app (container init:container)");
    expect(result.kind).toBe("Deployment");
    expect(result.namespace).toBe("default");
    expect(result.name).toBe("my-app");
    expect(result.container).toBe("init:container");
  });

  it("ClusterRoleBinding은 kind/name 2단계 패턴으로 파싱된다", () => {
    const result = parseK8sTarget("ClusterRoleBinding/system:node-proxier");
    expect(result.kind).toBe("ClusterRoleBinding");
    expect(result.namespace).toBeUndefined();
  });

  it("target에 이미지 다이제스트 포함된 경우", () => {
    const result = parseK8sTarget("nginx@sha256:abc123 (debian 11)");
    expect(result.kind).toBe("Image");
    expect(result.name).toBe("nginx@sha256:abc123");
  });
});

describe("normalizeTrivyReport — 추가 파싱 케이스", () => {
  describe("빈 문자열 target", () => {
    it("빈 target에서도 finding이 생성된다", () => {
      const findings = normalizeTrivyReport(TRIVY_EMPTY_STRING_TARGET, CLUSTER_ID);
      expect(findings).toHaveLength(1);
    });

    it("빈 target의 resource.kind는 Image다", () => {
      const findings = normalizeTrivyReport(TRIVY_EMPTY_STRING_TARGET, CLUSTER_ID);
      expect(findings[0].resource.kind).toBe("Unknown");
    });
  });

  describe("VulnerabilityID 없는 CVE", () => {
    it("finding이 생성된다 (UUID fallback)", () => {
      const findings = normalizeTrivyReport(TRIVY_MISSING_CVE_ID, CLUSTER_ID);
      expect(findings).toHaveLength(1);
    });

    it("id는 uuid를 포함한 형식이다", () => {
      const findings = normalizeTrivyReport(TRIVY_MISSING_CVE_ID, CLUSTER_ID);
      expect(findings[0].id).toMatch(/^trivy-cve-/);
    });

    it("type은 CVE다", () => {
      const findings = normalizeTrivyReport(TRIVY_MISSING_CVE_ID, CLUSTER_ID);
      expect(findings[0].type).toBe(FindingType.CVE);
    });
  });

  describe("ID/AVDID 없는 Misconfig", () => {
    it("finding이 생성된다 (UUID fallback)", () => {
      const findings = normalizeTrivyReport(TRIVY_MISSING_MISCONFIG_ID, CLUSTER_ID);
      expect(findings).toHaveLength(1);
    });

    it("id는 trivy-misconfig- 프리픽스를 가진다", () => {
      const findings = normalizeTrivyReport(TRIVY_MISSING_MISCONFIG_ID, CLUSTER_ID);
      expect(findings[0].id).toMatch(/^trivy-misconfig-/);
    });
  });

  describe("여러 Result (multi-resource)", () => {
    it("3개 Result에서 총 3개 finding을 반환한다", () => {
      const findings = normalizeTrivyReport(TRIVY_MULTI_RESOURCE, CLUSTER_ID);
      expect(findings).toHaveLength(3);
    });

    it("각 finding의 namespace가 올바르게 분리된다", () => {
      const findings = normalizeTrivyReport(TRIVY_MULTI_RESOURCE, CLUSTER_ID);
      const namespaces = findings.map((f) => f.resource.namespace);
      expect(namespaces).toContain("default");
      expect(namespaces).toContain("production");
      expect(namespaces).toContain("kube-system");
    });

    it("모든 finding의 id가 고유하다", () => {
      const findings = normalizeTrivyReport(TRIVY_MULTI_RESOURCE, CLUSTER_ID);
      const ids = new Set(findings.map((f) => f.id));
      expect(ids.size).toBe(3);
    });
  });

  describe("Vulnerabilities/Misconfigurations 모두 없는 Result", () => {
    it("finding 없이 빈 배열을 반환한다", () => {
      const findings = normalizeTrivyReport(TRIVY_RESULT_NO_FINDINGS, CLUSTER_ID);
      expect(findings).toHaveLength(0);
    });
  });

  describe("CVSS 없는 CVE", () => {
    it("cvssScore가 undefined다", () => {
      const findings = normalizeTrivyReport(TRIVY_NO_CVSS, CLUSTER_ID);
      const cve = findings[0] as CveFinding;
      expect(cve.cvssScore).toBeUndefined();
    });

    it("finding은 정상적으로 생성된다", () => {
      const findings = normalizeTrivyReport(TRIVY_NO_CVSS, CLUSTER_ID);
      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe(FindingType.CVE);
    });
  });

  describe("Misconfig references 케이스", () => {
    it("PrimaryURL 없으면 References만 포함된다", () => {
      const findings = normalizeTrivyReport(TRIVY_MISCONFIG_NO_PRIMARY_URL, CLUSTER_ID);
      const misconfig = findings[0] as MisconfigFinding;
      expect(misconfig.references).toEqual(["https://kubernetes.io/docs/"]);
    });

    it("References 빈 배열 + PrimaryURL 없으면 references가 undefined다", () => {
      const findings = normalizeTrivyReport(TRIVY_MISCONFIG_EMPTY_REFS, CLUSTER_ID);
      const misconfig = findings[0] as MisconfigFinding;
      expect(misconfig.references).toBeUndefined();
    });
  });

  describe("빈 Severity 문자열", () => {
    it("빈 Severity는 Unknown으로 매핑된다", () => {
      const findings = normalizeTrivyReport(TRIVY_EMPTY_SEVERITY, CLUSTER_ID);
      expect(findings[0].severity).toBe(Severity.Unknown);
    });
  });

  describe("AVDID만 있는 Misconfig (ID 없음)", () => {
    it("checkId에 AVDID가 사용된다", () => {
      const findings = normalizeTrivyReport(TRIVY_AVDID_ONLY, CLUSTER_ID);
      const misconfig = findings[0] as MisconfigFinding;
      expect(misconfig.checkId).toBe("AVD-KSV-0001");
    });

    it("id에 AVDID가 포함된다", () => {
      const findings = normalizeTrivyReport(TRIVY_AVDID_ONLY, CLUSTER_ID);
      expect(findings[0].id).toContain("AVD-KSV-0001");
    });

    it("namespace가 id에 포함된다", () => {
      const findings = normalizeTrivyReport(TRIVY_AVDID_ONLY, CLUSTER_ID);
      expect(findings[0].id).toContain("staging");
    });
  });
});

describe("trivy k8s --report all: Resources[] 중첩 구조", () => {
  const K8S_RESOURCES_REPORT = {
    ClusterName: "kubernetes-admin@kubernetes",
    Resources: [
      {
        Namespace: "default",
        Kind: "Pod",
        Name: "vuln-nginx",
        Results: [
          {
            Target: "nginx:1.14.0 (debian 9.13)",
            Class: "os-pkgs",
            Type: "debian",
            Vulnerabilities: [
              {
                VulnerabilityID: "CVE-2021-1234",
                PkgName: "libssl1.1",
                InstalledVersion: "1.1.0l-1~deb9u3",
                FixedVersion: "1.1.1n-0+deb9u1",
                Severity: "HIGH",
                Title: "OpenSSL vulnerability",
                Description: "Test CVE",
              },
            ],
          },
        ],
      },
      {
        Namespace: "default",
        Kind: "Deployment",
        Name: "my-app",
        Results: [
          {
            Target: "Deployment/default/my-app",
            Class: "config",
            Type: "kubernetes",
            Misconfigurations: [
              {
                Type: "Kubernetes Security Check",
                ID: "KSV001",
                Title: "Process can elevate its own privileges",
                Description: "Privilege escalation allowed.",
                Severity: "MEDIUM",
                Status: "FAIL",
              },
            ],
          },
        ],
      },
    ],
  };

  it("Resources[] 구조를 파싱해 findings를 반환한다", () => {
    const findings = normalizeTrivyReport(K8S_RESOURCES_REPORT, "test-cluster");
    expect(findings.length).toBeGreaterThan(0);
  });

  it("CVE finding이 올바른 resource(Kind/Name/Namespace)를 갖는다", () => {
    const findings = normalizeTrivyReport(K8S_RESOURCES_REPORT, "test-cluster");
    const cve = findings.find((f) => f.type === FindingType.CVE);
    expect(cve).toBeDefined();
    expect(cve!.resource.name).toBe("vuln-nginx");
    expect(cve!.resource.namespace).toBe("default");
    expect(cve!.resource.kind).toBe("Pod");
  });

  it("Misconfig finding이 올바른 resource를 갖는다", () => {
    const findings = normalizeTrivyReport(K8S_RESOURCES_REPORT, "test-cluster");
    const misconfig = findings.find((f) => f.type === FindingType.Misconfiguration);
    expect(misconfig).toBeDefined();
    expect(misconfig!.resource.name).toBe("my-app");
    expect(misconfig!.resource.kind).toBe("Deployment");
  });

  it("Results[]가 없는 경우에도 에러 없이 동작한다", () => {
    const report = { ClusterName: "test", Resources: [{ Kind: "Pod", Name: "x" }] };
    expect(() => normalizeTrivyReport(report, "test")).not.toThrow();
    expect(normalizeTrivyReport(report, "test")).toEqual([]);
  });
});

describe("Resources[] 멀티컨테이너 Finding id 고유성", () => {
  const MULTI_CONTAINER_REPORT = {
    ClusterName: "test-cluster",
    Resources: [
      {
        Namespace: "default",
        Kind: "Pod",
        Name: "my-pod",
        Results: [
          {
            Target: "Pod/default/my-pod (container container-a)",
            Class: "os-pkgs",
            Type: "debian",
            Vulnerabilities: [
              {
                VulnerabilityID: "CVE-2024-1234",
                PkgName: "openssl",
                InstalledVersion: "1.0.0",
                Severity: "HIGH",
                Title: "OpenSSL vuln",
              },
            ],
          },
          {
            Target: "Pod/default/my-pod (container container-b)",
            Class: "os-pkgs",
            Type: "debian",
            Vulnerabilities: [
              {
                VulnerabilityID: "CVE-2024-1234",
                PkgName: "openssl",
                InstalledVersion: "1.0.0",
                Severity: "HIGH",
                Title: "OpenSSL vuln",
              },
            ],
          },
        ],
      },
    ],
  };

  it("같은 CVE가 다른 컨테이너에 있으면 두 Finding 모두 보존된다", () => {
    const findings = normalizeTrivyReport(MULTI_CONTAINER_REPORT, "test-cluster");
    const cveFindings = findings.filter((f) => f.type === FindingType.CVE);
    expect(cveFindings.length).toBe(2);
  });

  it("두 Finding의 id가 서로 다르다 (container명으로 충돌 방지)", () => {
    const findings = normalizeTrivyReport(MULTI_CONTAINER_REPORT, "test-cluster");
    const ids = findings.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("container-a Finding id에 container-a가 포함된다", () => {
    const findings = normalizeTrivyReport(MULTI_CONTAINER_REPORT, "test-cluster");
    const cveFindings = findings.filter((f) => f.type === FindingType.CVE);
    const idA = cveFindings.find((f) => f.id.includes("container-a"));
    expect(idA).toBeDefined();
  });

  it("container-b Finding id에 container-b가 포함된다", () => {
    const findings = normalizeTrivyReport(MULTI_CONTAINER_REPORT, "test-cluster");
    const cveFindings = findings.filter((f) => f.type === FindingType.CVE);
    const idB = cveFindings.find((f) => f.id.includes("container-b"));
    expect(idB).toBeDefined();
  });
});
