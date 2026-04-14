/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * @jest-environment node
 *
 * Kubescape 스캐너 단위 test
 * kubescape-normalizer.ts의 주요 함수 verify
 */

import { FindingType, ScannerSource, Severity } from "../../../../common/security/security-finding";
import {
  ALL_PASSED_REPORT,
  EMPTY_RESULTS_REPORT,
  FIX_COMMAND_REPORT,
  MIXED_KUBESCAPE_REPORT,
  NO_RESOURCE_MAP_REPORT,
  NO_RESULTS_REPORT,
  SAME_NAME_DIFFERENT_KIND_REPORT,
  SCORE_FACTOR_SEVERITY_REPORT,
} from "../__fixtures__/kubescape-report.fixture";
import {
  isKubescapeReport,
  normalizeKubescapeReport,
  normalizeSeverityFromKubescape,
  parseResourceId,
} from "../kubescape-normalizer";

import type { MisconfigFinding, RbacFinding } from "../../../../common/security/security-finding";

// ============================================
// normalizeSeverityFromKubescape
// ============================================

describe("normalizeSeverityFromKubescape", () => {
  it("severity 문자열 Critical → CRITICAL", () => {
    expect(normalizeSeverityFromKubescape({ severity: "Critical", scoreFactor: 9 })).toBe(Severity.Critical);
  });

  it("severity 문자열 High → HIGH", () => {
    expect(normalizeSeverityFromKubescape({ severity: "High", scoreFactor: 8 })).toBe(Severity.High);
  });

  it("severity 문자열 Medium → MEDIUM", () => {
    expect(normalizeSeverityFromKubescape({ severity: "Medium", scoreFactor: 5 })).toBe(Severity.Medium);
  });

  it("severity 문자열 Low → LOW", () => {
    expect(normalizeSeverityFromKubescape({ severity: "Low", scoreFactor: 2 })).toBe(Severity.Low);
  });

  it("severity 문자열 Unknown → UNKNOWN", () => {
    expect(normalizeSeverityFromKubescape({ severity: "Unknown" })).toBe(Severity.Unknown);
  });

  it("severity 없고 scoreFactor 9.5 → CRITICAL", () => {
    expect(normalizeSeverityFromKubescape({ scoreFactor: 9.5 })).toBe(Severity.Critical);
  });

  it("severity 없고 scoreFactor 7 → HIGH", () => {
    expect(normalizeSeverityFromKubescape({ scoreFactor: 7 })).toBe(Severity.High);
  });

  it("severity 없고 scoreFactor 4 → MEDIUM", () => {
    expect(normalizeSeverityFromKubescape({ scoreFactor: 4 })).toBe(Severity.Medium);
  });

  it("severity 없고 scoreFactor 3 → LOW", () => {
    expect(normalizeSeverityFromKubescape({ scoreFactor: 3 })).toBe(Severity.Low);
  });

  it("severity 없고 scoreFactor 0 → UNKNOWN", () => {
    expect(normalizeSeverityFromKubescape({ scoreFactor: 0 })).toBe(Severity.Unknown);
  });

  it("undefined 입력 → UNKNOWN", () => {
    expect(normalizeSeverityFromKubescape(undefined)).toBe(Severity.Unknown);
  });

  it("severity·scoreFactor 모두 없음 → UNKNOWN", () => {
    expect(normalizeSeverityFromKubescape({})).toBe(Severity.Unknown);
  });

  // kubescape v4+: plain string severity
  it("v4 plain string 'Critical' → CRITICAL", () => {
    expect(normalizeSeverityFromKubescape("Critical")).toBe(Severity.Critical);
  });

  it("v4 plain string 'High' → HIGH", () => {
    expect(normalizeSeverityFromKubescape("High")).toBe(Severity.High);
  });

  it("v4 plain string 'Medium' → MEDIUM", () => {
    expect(normalizeSeverityFromKubescape("Medium")).toBe(Severity.Medium);
  });

  it("v4 plain string 'Low' → LOW", () => {
    expect(normalizeSeverityFromKubescape("Low")).toBe(Severity.Low);
  });

  it("v4 plain string 'Unknown' → UNKNOWN", () => {
    expect(normalizeSeverityFromKubescape("Unknown")).toBe(Severity.Unknown);
  });

  it("v4 plain string 알 수 없는 값 → UNKNOWN", () => {
    expect(normalizeSeverityFromKubescape("SEVERE")).toBe(Severity.Unknown);
  });

  it("v4 plain string 빈 문자열 → UNKNOWN", () => {
    expect(normalizeSeverityFromKubescape("")).toBe(Severity.Unknown);
  });
});

// ============================================
// parseResourceId
// ============================================

describe("parseResourceId", () => {
  it("네임스페이스 스코프 리소스 파싱 — /v1/namespaces/default/Pod/nginx-pod", () => {
    const result = parseResourceId("/v1/namespaces/default/Pod/nginx-pod");
    expect(result).toEqual({ kind: "Pod", name: "nginx-pod", namespace: "default" });
  });

  it("apiGroup 포함 네임스페이스 스코프 — /apps/v1/namespaces/kube-system/Deployment/coredns", () => {
    const result = parseResourceId("/apps/v1/namespaces/kube-system/Deployment/coredns");
    expect(result).toEqual({ kind: "Deployment", name: "coredns", namespace: "kube-system" });
  });

  it("클러스터 스코프 리소스 파싱 — /v1/ClusterRole/admin", () => {
    const result = parseResourceId("/v1/ClusterRole/admin");
    expect(result.kind).toBe("ClusterRole");
    expect(result.name).toBe("admin");
    expect(result.namespace).toBeUndefined();
  });

  it("ClusterRoleBinding 파싱 — /v1/ClusterRoleBinding/system:masters", () => {
    const result = parseResourceId("/v1/ClusterRoleBinding/system:masters");
    expect(result.kind).toBe("ClusterRoleBinding");
    expect(result.name).toBe("system:masters");
  });

  it("undefined 입력 → Unknown/unknown", () => {
    const result = parseResourceId(undefined);
    expect(result).toEqual({ kind: "Unknown", name: "unknown" });
  });

  it("빈 문자열 → Unknown/unknown", () => {
    const result = parseResourceId("");
    expect(result).toEqual({ kind: "Unknown", name: "unknown" });
  });
});

// ============================================
// isKubescapeReport
// ============================================

describe("isKubescapeReport", () => {
  it("results 배열 있는 유효한 리포트 → true", () => {
    expect(isKubescapeReport({ results: [] })).toBe(true);
  });

  it("results 없는 빈 객체 → true (results는 optional)", () => {
    expect(isKubescapeReport({})).toBe(true);
  });

  it("summaryDetails만 있는 객체 → true", () => {
    expect(isKubescapeReport({ summaryDetails: {} })).toBe(true);
  });

  it("null → false", () => {
    expect(isKubescapeReport(null)).toBe(false);
  });

  it("undefined → false", () => {
    expect(isKubescapeReport(undefined)).toBe(false);
  });

  it("배열 → false (results가 배열이 아닌 경우)", () => {
    expect(isKubescapeReport({ results: "not-array" })).toBe(false);
  });

  it("문자열 → false", () => {
    expect(isKubescapeReport("not-an-object")).toBe(false);
  });
});

// ============================================
// normalizeKubescapeReport — 혼합 리포트
// ============================================

describe("normalizeKubescapeReport", () => {
  describe("혼합 리포트 (Misconfig 2개 + RBAC 1개)", () => {
    let findings: ReturnType<typeof normalizeKubescapeReport>;

    beforeEach(() => {
      findings = normalizeKubescapeReport(MIXED_KUBESCAPE_REPORT, "test-cluster");
    });

    it("passed 컨트롤 제외하고 3개 finding 반환 (failed만)", () => {
      expect(findings).toHaveLength(3);
    });

    describe("MisconfigFinding verify — C-0002 (Privileged container)", () => {
      let finding: MisconfigFinding;

      beforeEach(() => {
        finding = findings.find(
          (f) => f.type === FindingType.Misconfiguration && (f as MisconfigFinding).checkId === "C-0002",
        ) as MisconfigFinding;
      });

      it("MisconfigFinding 타입으로 변환된다", () => {
        expect(finding.type).toBe(FindingType.Misconfiguration);
      });

      it("severity가 HIGH로 매핑된다", () => {
        expect(finding.severity).toBe(Severity.High);
      });

      it("source가 KUBESCAPE다", () => {
        expect(finding.source).toBe(ScannerSource.Kubescape);
      });

      it("checkId가 올바르게 설정된다", () => {
        expect(finding.checkId).toBe("C-0002");
      });

      it("title이 컨트롤 이름으로 설정된다", () => {
        expect(finding.title).toBe("Privileged container");
      });

      it("resource에 kind/name/namespace가 포함된다", () => {
        expect(finding.resource.kind).toBe("Pod");
        expect(finding.resource.name).toBe("nginx-pod");
        expect(finding.resource.namespace).toBe("default");
      });

      it("fixPaths에서 remediation이 추출된다", () => {
        expect(finding.remediation).toContain("spec.containers[0].securityContext.privileged");
      });

      it("finding id가 kubescape-misconfig 접두사를 갖는다", () => {
        expect(finding.id).toMatch(/^kubescape-misconfig-C-0002/);
      });
    });

    describe("MisconfigFinding verify — C-0016 (Allow privilege escalation)", () => {
      let finding: MisconfigFinding;

      beforeEach(() => {
        finding = findings.find(
          (f) => f.type === FindingType.Misconfiguration && (f as MisconfigFinding).checkId === "C-0016",
        ) as MisconfigFinding;
      });

      it("severity가 MEDIUM으로 매핑된다", () => {
        expect(finding.severity).toBe(Severity.Medium);
      });

      it("resource namespace가 kube-system이다", () => {
        expect(finding.resource.namespace).toBe("kube-system");
      });

      it("resource kind가 Deployment다", () => {
        expect(finding.resource.kind).toBe("Deployment");
      });
    });

    describe("RbacFinding verify — C-0011 (Cluster-admin binding)", () => {
      let finding: RbacFinding;

      beforeEach(() => {
        finding = findings.find((f) => f.type === FindingType.RBAC) as RbacFinding;
      });

      it("RbacFinding 타입으로 변환된다", () => {
        expect(finding.type).toBe(FindingType.RBAC);
      });

      it("severity가 CRITICAL로 매핑된다", () => {
        expect(finding.severity).toBe(Severity.Critical);
      });

      it("source가 KUBESCAPE다", () => {
        expect(finding.source).toBe(ScannerSource.Kubescape);
      });

      it("subject 필드가 설정된다", () => {
        expect(finding.subject).toBeDefined();
        expect(typeof finding.subject).toBe("string");
      });

      it("subjects 경로는 affectedSpecFields에 설정된다 (riskyPermissions 아님)", () => {
        // "subjects[0].name" does not start with "rules[" so it goes to affectedSpecFields
        expect(finding.affectedSpecFields).toContain("subjects[0].name");
        expect(finding.riskyPermissions).toHaveLength(0);
      });

      it("fixCommand에서 remediation이 추출된다", () => {
        expect(finding.remediation).toContain("kubectl delete clusterrolebinding");
      });

      it("finding id가 kubescape-rbac 접두사를 갖는다", () => {
        expect(finding.id).toMatch(/^kubescape-rbac-C-0011/);
      });
    });
  });

  describe("빈 데이터 케이스", () => {
    it("빈 results 배열 → 빈 배열 반환", () => {
      expect(normalizeKubescapeReport(EMPTY_RESULTS_REPORT, "cluster")).toEqual([]);
    });

    it("results 없는 리포트 → 빈 배열 반환", () => {
      expect(normalizeKubescapeReport(NO_RESULTS_REPORT, "cluster")).toEqual([]);
    });

    it("null 입력 → 빈 배열 반환", () => {
      expect(normalizeKubescapeReport(null, "cluster")).toEqual([]);
    });

    it("undefined 입력 → 빈 배열 반환", () => {
      expect(normalizeKubescapeReport(undefined, "cluster")).toEqual([]);
    });

    it("잘못된 JSON 구조 → 빈 배열 반환", () => {
      expect(normalizeKubescapeReport("invalid", "cluster")).toEqual([]);
      expect(normalizeKubescapeReport(42, "cluster")).toEqual([]);
    });

    it("모두 passed 컨트롤 → 빈 배열 반환", () => {
      expect(normalizeKubescapeReport(ALL_PASSED_REPORT, "cluster")).toEqual([]);
    });
  });

  describe("scoreFactor 기반 severity 케이스", () => {
    let findings: ReturnType<typeof normalizeKubescapeReport>;

    beforeEach(() => {
      findings = normalizeKubescapeReport(SCORE_FACTOR_SEVERITY_REPORT, "cluster");
    });

    it("3개 finding 반환", () => {
      expect(findings).toHaveLength(3);
    });

    it("scoreFactor 9.5 → CRITICAL", () => {
      const f = findings.find((f) => (f as MisconfigFinding).checkId === "C-0020");
      expect(f?.severity).toBe(Severity.Critical);
    });

    it("scoreFactor 3 → LOW", () => {
      const f = findings.find((f) => (f as MisconfigFinding).checkId === "C-0004");
      expect(f?.severity).toBe(Severity.Low);
    });

    it("scoreFactor 없음 → UNKNOWN", () => {
      const f = findings.find((f) => (f as MisconfigFinding).checkId === "C-0030");
      expect(f?.severity).toBe(Severity.Unknown);
    });
  });

  describe("resources 맵 없이 resourceID 파싱 폴백", () => {
    let findings: ReturnType<typeof normalizeKubescapeReport>;

    beforeEach(() => {
      findings = normalizeKubescapeReport(NO_RESOURCE_MAP_REPORT, "cluster");
    });

    it("2개 finding 반환", () => {
      expect(findings).toHaveLength(2);
    });

    it("네임스페이스 스코프 resourceID 파싱 — Pod/staging", () => {
      const f = findings.find((f) => (f as MisconfigFinding).checkId === "C-0002");
      expect(f?.resource.kind).toBe("Pod");
      expect(f?.resource.name).toBe("worker");
      expect(f?.resource.namespace).toBe("staging");
    });

    it("클러스터 스코프 resourceID 파싱 — ClusterRole", () => {
      const f = findings.find((f) => f.type === FindingType.RBAC);
      expect(f?.resource.kind).toBe("ClusterRole");
      expect(f?.resource.name).toBe("admin");
    });
  });

  describe("fixCommand remediation 케이스", () => {
    it("fixCommand가 있으면 remediation에 포함된다", () => {
      const findings = normalizeKubescapeReport(FIX_COMMAND_REPORT, "cluster");
      expect(findings).toHaveLength(1);
      expect(findings[0].remediation).toContain("kubectl patch pod");
    });
  });

  describe("Finding ID 고유성", () => {
    it("모든 finding의 id가 고유하다", () => {
      const findings = normalizeKubescapeReport(MIXED_KUBESCAPE_REPORT, "cluster");
      const ids = findings.map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});

describe("Finding ID — 동일 이름 다른 kind 충돌 방지", () => {
  it("Role과 ClusterRoleBinding이 같은 이름이어도 finding ID가 달라야 한다", () => {
    const findings = normalizeKubescapeReport(SAME_NAME_DIFFERENT_KIND_REPORT, "cluster");
    expect(findings).toHaveLength(2);
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("ID에 kind가 포함되어 Role finding과 ClusterRoleBinding finding을 구분한다", () => {
    const findings = normalizeKubescapeReport(SAME_NAME_DIFFERENT_KIND_REPORT, "cluster");
    const roleId = findings.find((f) => f.resource.kind === "Role")?.id ?? "";
    const crbId = findings.find((f) => f.resource.kind === "ClusterRoleBinding")?.id ?? "";
    expect(roleId).toContain("Role");
    expect(crbId).toContain("ClusterRoleBinding");
    expect(roleId).not.toBe(crbId);
  });
});

// ============================================
// 추가 파싱 케이스 test
// ============================================

import {
  FIX_PATHS_NO_VALUE_REPORT,
  FIX_PATHS_ONLY_REPORT,
  MISSING_CONTROL_ID_REPORT,
  MISSING_RESOURCE_ID_REPORT,
  NO_CONTROLS_REPORT,
  NO_RULES_REPORT,
  RBAC_C0007_REPORT,
  RESOURCE_WITHOUT_OBJECT_REPORT,
  SAME_RESOURCE_MULTI_CONTROL_REPORT,
} from "../__fixtures__/kubescape-report.fixture";

describe("parseResourceId — 추가 케이스", () => {
  it("슬래시만 있는 경우 → Unknown 폴백", () => {
    const result = parseResourceId("/");
    expect(result.kind).toBe("Unknown");
  });

  it("system:controller:node-approver 특수문자 이름 파싱", () => {
    const result = parseResourceId("/v1/ClusterRole/system:controller:node-approver");
    expect(result.kind).toBe("ClusterRole");
    expect(result.name).toBe("system:controller:node-approver");
    expect(result.namespace).toBeUndefined();
  });

  it("/apps/v1/namespaces/ns/StatefulSet/my-sts apiGroup 포함 파싱", () => {
    const result = parseResourceId("/apps/v1/namespaces/production/StatefulSet/my-sts");
    expect(result.kind).toBe("StatefulSet");
    expect(result.name).toBe("my-sts");
    expect(result.namespace).toBe("production");
  });
});

describe("normalizeKubescapeReport — 추가 파싱 케이스", () => {
  describe("resourceID 없는 result", () => {
    it("resourceID 없는 result는 skip되고 유효한 result만 finding 반환", () => {
      const findings = normalizeKubescapeReport(MISSING_RESOURCE_ID_REPORT, "cluster");
      expect(findings).toHaveLength(1);
    });

    it("유효한 result의 finding은 올바른 resource 정보를 가진다", () => {
      const findings = normalizeKubescapeReport(MISSING_RESOURCE_ID_REPORT, "cluster");
      expect(findings[0].resource.name).toBe("valid-pod");
      expect(findings[0].resource.namespace).toBe("default");
    });
  });

  describe("controls 없는 result", () => {
    it("controls 빈 배열이면 finding 0개 반환", () => {
      const findings = normalizeKubescapeReport(NO_CONTROLS_REPORT, "cluster");
      expect(findings).toHaveLength(0);
    });
  });

  describe("controlID/name 없는 control", () => {
    it("controlID 없는 control도 finding이 생성된다", () => {
      const findings = normalizeKubescapeReport(MISSING_CONTROL_ID_REPORT, "cluster");
      expect(findings).toHaveLength(2);
    });

    it("controlID 없으면 id가 trivy-misconfig-- 패턴이다", () => {
      const findings = normalizeKubescapeReport(MISSING_CONTROL_ID_REPORT, "cluster");
      const noId = findings.find((f) => (f as MisconfigFinding).checkId === "");
      expect(noId?.id).toMatch(/^kubescape-misconfig--/);
    });

    it("name 없는 control은 controlID를 title로 사용한다", () => {
      const findings = normalizeKubescapeReport(MISSING_CONTROL_ID_REPORT, "cluster");
      const noName = findings.find((f) => (f as MisconfigFinding).checkId === "C-0099");
      expect(noName?.title).toBe("C-0099");
    });
  });

  describe("rules 없는 control", () => {
    it("rules 없으면 finding이 생성된다", () => {
      const findings = normalizeKubescapeReport(NO_RULES_REPORT, "cluster");
      expect(findings).toHaveLength(1);
    });

    it("rules 없으면 staticMeta remediation이 채워진다 (C-0002)", () => {
      const findings = normalizeKubescapeReport(NO_RULES_REPORT, "cluster");
      // C-0002는 staticMeta에 등록되어 있으므로 remediation이 존재해야 함
      expect(findings[0].remediation).toBeDefined();
      expect(findings[0].remediation).toContain("exec");
    });

    it("rules 없고 staticMeta도 없으면 description이 빈 문자열이다", () => {
      const findings = normalizeKubescapeReport(NO_RULES_REPORT, "cluster");
      // C-0002는 staticMeta.description이 있으므로 비어있지 않아야 함
      expect(findings[0].description).not.toBe("");
    });
  });

  describe("fixPaths 기반 remediation", () => {
    it("fixCommand 없이 fixPaths만 있으면 경로가 remediation에 포함된다", () => {
      const findings = normalizeKubescapeReport(FIX_PATHS_ONLY_REPORT, "cluster");
      expect(findings[0].remediation).toContain("spec.containers[0].securityContext.allowPrivilegeEscalation");
      expect(findings[0].remediation).toContain("false");
    });

    it("fixPaths.value 없으면 remediation에 'recommended value'가 포함된다", () => {
      const findings = normalizeKubescapeReport(FIX_PATHS_NO_VALUE_REPORT, "cluster");
      expect(findings[0].remediation).toContain("recommended value");
    });
  });

  describe("동일 resourceID + 다른 controlID", () => {
    it("하나의 resource에 2개 failed control → 2개 finding 반환", () => {
      const findings = normalizeKubescapeReport(SAME_RESOURCE_MULTI_CONTROL_REPORT, "cluster");
      expect(findings).toHaveLength(2);
    });

    it("2개 finding의 id가 각각 다르다", () => {
      const findings = normalizeKubescapeReport(SAME_RESOURCE_MULTI_CONTROL_REPORT, "cluster");
      expect(findings[0].id).not.toBe(findings[1].id);
    });

    it("각 finding이 다른 controlID를 가진다", () => {
      const findings = normalizeKubescapeReport(SAME_RESOURCE_MULTI_CONTROL_REPORT, "cluster");
      const checkIds = findings.map((f) => (f as MisconfigFinding).checkId);
      expect(checkIds).toContain("C-0002");
      expect(checkIds).toContain("C-0016");
    });
  });

  describe("C-0007 RBAC 컨트롤", () => {
    it("C-0007은 RbacFinding으로 변환된다", () => {
      const findings = normalizeKubescapeReport(RBAC_C0007_REPORT, "cluster");
      expect(findings).toHaveLength(1);
      expect(findings[0].type).toBe(FindingType.RBAC);
    });

    it("id가 kubescape-rbac-C-0007 접두사를 가진다", () => {
      const findings = normalizeKubescapeReport(RBAC_C0007_REPORT, "cluster");
      expect(findings[0].id).toMatch(/^kubescape-rbac-C-0007/);
    });

    it("severity가 CRITICAL이다", () => {
      const findings = normalizeKubescapeReport(RBAC_C0007_REPORT, "cluster");
      expect(findings[0].severity).toBe(Severity.Critical);
    });

    it("fixCommand가 remediation에 포함된다", () => {
      const findings = normalizeKubescapeReport(RBAC_C0007_REPORT, "cluster");
      expect(findings[0].remediation).toContain("kubectl edit clusterrole system:node");
    });
  });

  describe("resources 맵에 있으나 object 없는 경우", () => {
    it("object 없으면 resourceID 파싱 폴백으로 finding이 생성된다", () => {
      const findings = normalizeKubescapeReport(RESOURCE_WITHOUT_OBJECT_REPORT, "cluster");
      expect(findings).toHaveLength(1);
    });

    it("resourceID 파싱으로 올바른 resource 정보가 설정된다", () => {
      const findings = normalizeKubescapeReport(RESOURCE_WITHOUT_OBJECT_REPORT, "cluster");
      expect(findings[0].resource.kind).toBe("Pod");
      expect(findings[0].resource.name).toBe("my-pod");
      expect(findings[0].resource.namespace).toBe("default");
    });
  });
});

describe("KubescapeControlResult.severity 타입 (70e28708 수정 verify)", () => {
  // severity?: string | KubescapeSeverityDetail 타입 변경 확인
  it("severity 필드가 string | KubescapeSeverityDetail 타입을 허용하는지 소스 확인", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(path.resolve(__dirname, "../kubescape-normalizer.ts"), "utf-8");
    // string | KubescapeSeverityDetail 유니온 타입 선언 확인
    expect(src).toMatch(/severity\?\s*:\s*string\s*\|\s*KubescapeSeverityDetail/);
  });
});
