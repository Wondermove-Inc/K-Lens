/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Trivy raw JSON output → SecurityFinding conversion logic
 * SecurityFinding conversion logic implementation
 *
 * Conversion logic used in TrivyScanner.normalize() is separated into an independent module.
 * Extracted outside the class to improve testability and reusability.
 *
 * Responsibilities:
 * - Trivy JSON schema validation (runtime Type guards without Zod)
 * - Target string parsing (Kind/namespace/name, image:tag pattern)
 * - Vulnerability → CveFinding conversion
 * - Misconfiguration → MisconfigFinding conversion
 * - Severity normalization
 *
 * @packageDocumentation
 */

import { randomUUID } from "crypto";
import { FindingType, ScannerSource, Severity } from "../../../common/security/security-finding";

import type { AnySecurityFinding, CveFinding, MisconfigFinding } from "../../../common/security/security-finding";

// ============================================
// Trivy JSON schema (runtime type)
// ============================================

export interface TrivyReport {
  Results?: TrivyResult[];
  SchemaVersion?: number;
  ArtifactName?: string;
  // trivy k8s --report all structure: top-level Resources array (each Resource contains Results)
  ClusterName?: string;
  Resources?: TrivyK8sResource[];
}

/** Each K8s resource in trivy k8s --report all output */
export interface TrivyK8sResource {
  Namespace?: string;
  Kind?: string;
  Name?: string;
  Results?: TrivyResult[];
}

export interface TrivyResult {
  Target?: string;
  Class?: string;
  Type?: string;
  Vulnerabilities?: TrivyVulnerability[];
  Misconfigurations?: TrivyMisconfiguration[];
}

export interface TrivyVulnerability {
  VulnerabilityID?: string;
  PkgName?: string;
  PkgPath?: string;
  InstalledVersion?: string;
  FixedVersion?: string;
  Status?: string;
  Severity?: string;
  SeveritySource?: string;
  Title?: string;
  Description?: string;
  References?: string[];
  PublishedDate?: string;
  LastModifiedDate?: string;
  CVSS?: Record<string, TrivyCvss>;
}

export interface TrivyCvss {
  V2Score?: number;
  V3Score?: number;
  V2Vector?: string;
  V3Vector?: string;
}

export interface TrivyMisconfiguration {
  ID?: string;
  AVDID?: string;
  Title?: string;
  Description?: string;
  Message?: string;
  Namespace?: string;
  Query?: string;
  Resolution?: string;
  Severity?: string;
  PrimaryURL?: string;
  References?: string[];
  Type?: string;
  Status?: string;
  Layer?: unknown;
  CauseMetadata?: TrivyCauseMetadata;
}

export interface TrivyCauseMetadata {
  Resource?: string;
  Provider?: string;
  Service?: string;
  StartLine?: number;
  EndLine?: number;
  Code?: unknown;
}

// ============================================
// parsed resource information
// ============================================

export interface ParsedK8sResource {
  kind: string;
  name: string;
  namespace?: string;
  container?: string;
  image?: string;
}

// ============================================
// Severity mapping
// ============================================

const SEVERITY_MAP: Record<string, Severity> = {
  CRITICAL: Severity.Critical,
  HIGH: Severity.High,
  MEDIUM: Severity.Medium,
  LOW: Severity.Low,
  UNKNOWN: Severity.Unknown,
};

export function normalizeSeverity(raw?: string): Severity {
  return SEVERITY_MAP[raw?.toUpperCase() ?? ""] ?? Severity.Unknown;
}

// ============================================
// Target parsing
// ============================================

/**
 * Extracts Kubernetes resource information from Trivy's Target string.
 *
 * Supported pattern:
 * - `Deployment/default/my-app (container my-container)` — k8s resource
 * - `my-image:latest (debian 11)` — image scan
 * - `Pod/kube-system/coredns-xxx` — with namespace
 */
export function parseK8sTarget(target?: string): ParsedK8sResource {
  if (!target) {
    return { kind: "Unknown", name: "unknown" };
  }

  // pattern 1: "Kind/namespace/name ..." — 3 slashes (kind/ns/name)
  const fullMatch = target.match(/^([A-Za-z]+)\/([^/\s]+)\/([^/\s(]+)/);
  if (fullMatch) {
    const [, kind, namespace, name] = fullMatch;
    const containerMatch = target.match(/\(container[\s:]+([^)]+)\)/i);
    return {
      kind,
      name,
      namespace,
      container: containerMatch?.[1]?.trim(),
    };
  }

  // pattern 2: "Kind/name ..." — 2 slashes (no namespace, cluster-scoped)
  const shortMatch = target.match(/^([A-Za-z]+)\/([^/\s(]+)/);
  if (shortMatch) {
    const [, kind, name] = shortMatch;
    return { kind, name };
  }

  // pattern 3: "image:tag (...)" — image scan
  const imageName = target.split(" ")[0] ?? target;
  return {
    kind: "Image",
    name: imageName,
    image: imageName,
  };
}

// ============================================
// Extract CVSS score (highest score first)
// ============================================

export function extractCvssScore(cvss?: Record<string, TrivyCvss>): number | undefined {
  if (!cvss) return undefined;

  const scores = Object.values(cvss)
    .map((v) => v.V3Score ?? v.V2Score)
    .filter((s): s is number => s !== undefined);

  return scores.length > 0 ? Math.max(...scores) : undefined;
}

/** Extract the best available CVSS v3 vector string (prefer V3Vector, fall back to V2Vector) */
export function extractCvssVector(cvss?: Record<string, TrivyCvss>): string | undefined {
  if (!cvss) return undefined;
  // Prefer V3Vector from the source with the highest V3Score
  let best: { score: number; vector: string } | undefined;
  for (const entry of Object.values(cvss)) {
    const score = entry.V3Score ?? entry.V2Score ?? 0;
    const vector = entry.V3Vector ?? entry.V2Vector;
    if (vector && (!best || score > best.score)) {
      best = { score, vector };
    }
  }
  return best?.vector;
}

// ============================================
// Vulnerability → CveFinding
// ============================================

export function vulnerabilityToCveFinding(
  vuln: TrivyVulnerability,
  resource: ParsedK8sResource,
  scannedAt: string,
  trivyClass?: string,
  imageTarget?: string,
): CveFinding {
  const cveId = vuln.VulnerabilityID ?? "";

  return {
    id: `trivy-cve-${cveId || randomUUID()}-${resource.namespace ?? "cluster"}-${resource.kind ?? ""}-${resource.name}${resource.container ? `-${resource.container}` : ""}-${vuln.PkgName ?? ""}-${vuln.InstalledVersion ?? ""}`,
    type: FindingType.CVE,
    severity: normalizeSeverity(vuln.Severity),
    source: ScannerSource.Trivy,
    title: (vuln.Title ?? cveId) || "Unknown Vulnerability",
    description: vuln.Description ?? "",
    resource: {
      kind: resource.kind,
      name: resource.name,
      namespace: resource.namespace,
    },
    remediation: vuln.FixedVersion
      ? `Upgrade package \`${vuln.PkgName}\` to version ${vuln.FixedVersion} or later.`
      : (() => {
          const status = (vuln.Status ?? "").toLowerCase();
          if (status === "will_not_fix") {
            return `No official fix available (status: Will Not Fix). This vulnerability has been reviewed by the upstream maintainer and a patch is not planned. Mitigate by:\n- Removing or isolating the affected package if not required\n- Applying compensating controls (e.g., network policy, seccomp, AppArmor)\n- Monitoring for upstream status changes`;
          }
          if (status === "fix_deferred" || status === "deferred") {
            return `No fix currently available (status: Fix Deferred). The upstream maintainer has acknowledged the issue but deferred the fix. Keep the package updated and recheck periodically for a patch release.`;
          }
          if (status === "affected" || status === "") {
            return `No fixed version available at this time. Keep the package (\`${vuln.PkgName ?? "unknown"}\`) updated to the latest available version, minimize exposure of the affected functionality, and monitor the upstream advisory for patch releases.`;
          }
          return `No fixed version available (status: ${vuln.Status}). Maintain the package at the latest available version and apply compensating controls until an official patch is released.`;
        })(),
    references: vuln.References,
    detectedAt: scannedAt,
    rawLog: {
      ...(imageTarget
        ? { ...vuln, Target: imageTarget, ImageID: imageTarget }
        : (vuln as unknown as Record<string, unknown>)),
      ...(resource.container ? { _containerName: resource.container } : {}),
    } as unknown as Record<string, unknown>,
    cveId,
    packageName: vuln.PkgName ?? "",
    installedVersion: vuln.InstalledVersion ?? "",
    fixedVersion: vuln.FixedVersion,
    cvssScore: extractCvssScore(vuln.CVSS),
    cvssVector: extractCvssVector(vuln.CVSS),
    publishedDate: vuln.PublishedDate,
    trivyClass,
  };
}

// ============================================
// Misconfiguration → MisconfigFinding
// ============================================

export function misconfigToMisconfigFinding(
  misconfig: TrivyMisconfiguration,
  resource: ParsedK8sResource,
  scannedAt: string,
  trivyClass?: string,
): MisconfigFinding {
  const checkId = misconfig.ID ?? misconfig.AVDID ?? "";

  // NSA·MITRE control mapping from compliance-mapping
  const references = [...(misconfig.References ?? []), ...(misconfig.PrimaryURL ? [misconfig.PrimaryURL] : [])];

  return {
    id: `trivy-misconfig-${checkId || randomUUID()}-${resource.namespace ?? "cluster"}-${resource.kind ?? ""}-${resource.name}`,
    type: FindingType.Misconfiguration,
    severity: normalizeSeverity(misconfig.Severity),
    source: ScannerSource.Trivy,
    title: (misconfig.Title ?? checkId) || "Unknown Misconfiguration",
    description: misconfig.Description ?? misconfig.Message ?? "",
    resource: {
      kind: resource.kind,
      name: resource.name,
      namespace: resource.namespace,
    },
    remediation: misconfig.Resolution,
    references: references.length > 0 ? references : undefined,
    detectedAt: scannedAt,
    rawLog: misconfig as unknown as Record<string, unknown>,
    checkId,
    category: misconfig.Type,
    trivyClass,
  };
}

// ============================================
// TrivyReport → AnySecurityFinding[] (main conversion function)
// ============================================

/**
 * Converts Trivy k8s JSON report to AnySecurityFinding array.
 *
 * @param raw - Trivy raw JSON (unknown type, runtime parsing)
 * @param clusterId - scan target cluster ID (used in ScanResult)
 * @returns list of converted SecurityFindings
 *
 * @example
 * ```ts
 * const raw = JSON.parse(trivyStdout);
 * const findings = normalizeTrivyReport(raw, "my-cluster");
 * ```
 */
export function normalizeTrivyReport(raw: unknown, _clusterId: string): AnySecurityFinding[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const report = raw as TrivyReport;
  const scannedAt = new Date().toISOString();
  const findings: AnySecurityFinding[] = [];

  /**
   * trivy image / fs scan: top-level Results[] structure
   * trivy k8s --report all scan: top-level Resources[].Results[] nested structure
   * handle both cases
   */

  // 1) trivy k8s --report all: Resources[] structure
  if (Array.isArray(report.Resources) && report.Resources.length > 0) {
    for (const k8sResource of report.Resources) {
      for (const result of k8sResource.Results ?? []) {
        // use k8s resource information directly instead of Target string
        const parsedTarget = parseK8sTarget(result.Target);
        const resource: ParsedK8sResource = {
          kind: k8sResource.Kind ?? parsedTarget.kind,
          name: k8sResource.Name ?? parsedTarget.name,
          namespace: k8sResource.Namespace ?? parsedTarget.namespace,
          // container name from Target e.g. 'Deployment/ns/name (container my-container)'
          container: parsedTarget.container,
        };

        for (const vuln of result.Vulnerabilities ?? []) {
          findings.push(vulnerabilityToCveFinding(vuln, resource, scannedAt, result.Class, result.Target));
        }
        for (const misconfig of result.Misconfigurations ?? []) {
          findings.push(misconfigToMisconfigFinding(misconfig, resource, scannedAt, result.Class));
        }
      }
    }
    return deduplicateFindings(findings);
  }

  // 2) trivy image / single Results[] structure
  if (!Array.isArray(report.Results)) {
    return [];
  }

  for (const result of report.Results) {
    const resource = parseK8sTarget(result.Target);

    // CVE conversion
    for (const vuln of result.Vulnerabilities ?? []) {
      findings.push(vulnerabilityToCveFinding(vuln, resource, scannedAt, result.Class, result.Target));
    }

    // Misconfiguration conversion
    for (const misconfig of result.Misconfigurations ?? []) {
      findings.push(misconfigToMisconfigFinding(misconfig, resource, scannedAt, result.Class));
    }
  }

  return deduplicateFindings(findings);
}

/**
 * Removes duplicate findings by id, keeping the first occurrence.
 * Trivy k8s may report the same misconfiguration or CVE multiple times
 * when a resource appears in more than one Result block.
 */
function deduplicateFindings(findings: AnySecurityFinding[]): AnySecurityFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

// ============================================
// runtime validation
// ============================================

/**
 * check if the given value is a valid TrivyReport.
 */
export function isTrivyReport(value: unknown): value is TrivyReport {
  return (
    typeof value === "object" &&
    value !== null &&
    // allow both Results[] structure and Resources[] structure
    (("Results" in value ? Array.isArray((value as TrivyReport).Results) : true) ||
      ("Resources" in value ? Array.isArray((value as TrivyReport).Resources) : false))
  );
}
