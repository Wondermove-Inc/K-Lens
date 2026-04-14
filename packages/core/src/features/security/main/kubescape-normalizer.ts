/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Kubescape raw JSON output → SecurityFinding conversion logic
 * Scan result normalization Normalizer implementation
 *
 * Kubescape JSON output structure:
 * ```json
 * {
 *   "summaryDetails": { "frameworks": [...], "controls": { "C-0002": { ... } } },
 *   "results": [
 *     {
 *       "resourceID": "/v1/namespaces/default/Pod/my-pod",
 *       "controls": [
 *         {
 *           "controlID": "C-0002",
 *           "name": "Privileged container",
 *           "status": { "status": "failed" },
 *           "rules": [{ "name": "...", "failedPaths": ["..."], "fixPaths": [...] }]
 *         }
 *       ]
 *     }
 *   ],
 *   "resources": [
 *     {
 *       "resourceID": "/v1/namespaces/default/Pod/my-pod",
 *       "object": { "kind": "Pod", "metadata": { "name": "my-pod", "namespace": "default" } }
 *     }
 *   ]
 * }
 * ```
 *
 * @packageDocumentation
 */

import { FindingType, ScannerSource, Severity } from "../../../common/security/security-finding";
import { getKubescapeControlMeta } from "./kubescape-control-meta";

import type { AnySecurityFinding, MisconfigFinding, RbacFinding } from "../../../common/security/security-finding";

// ============================================
// Kubescape JSON schema (runtime type)
// ============================================

export interface KubescapeReport {
  summaryDetails?: KubescapeSummaryDetails;
  results?: KubescapeResult[];
  resources?: KubescapeResource[];
}

export interface KubescapeSummaryDetails {
  frameworks?: KubescapeFrameworkSummary[];
  controls?: Record<string, KubescapeControlSummary>;
}

export interface KubescapeFrameworkSummary {
  name?: string;
  status?: string;
}

export interface KubescapeControlSummary {
  controlID?: string;
  name?: string;
  severity?: KubescapeSeverityDetail;
  /** Human-readable description of the control (from summaryDetails) */
  description?: string;
  /** Link to official documentation / remediation guide */
  helpUrl?: string;
  /** Compliance frameworks this control maps to (e.g. NSA, MITRE, CIS) */
  complianceFrameworks?: string[];
}

export interface KubescapeSeverityDetail {
  severity?: string;
  scoreFactor?: number;
}

export interface KubescapeResult {
  /** e.g. "/v1/namespaces/default/Pod/my-pod" */
  resourceID?: string;
  controls?: KubescapeControlResult[];
}

export interface KubescapeControlResult {
  controlID?: string;
  name?: string;
  status?: KubescapeControlStatus;
  rules?: KubescapeRule[];
  // kubescape v4+: plain string ('High', 'Medium', etc.)
  // Previous version: KubescapeSeverityDetail object
  severity?: string | KubescapeSeverityDetail;
}

export interface KubescapeControlStatus {
  /** "passed" | "failed" | "skipped" */
  status?: string;
  infoMessages?: string[];
}

export interface KubescapeRule {
  name?: string;
  status?: string;
  controlConfigurations?: Record<string, unknown>;
  failedPaths?: string[];
  fixPaths?: KubescapeFixPath[];
  fixCommand?: string;
}

export interface KubescapeFixPath {
  path?: string;
  value?: string;
}

export interface KubescapeResource {
  resourceID?: string;
  object?: KubescapeK8sObject;
}

export interface KubescapeK8sObject {
  kind?: string;
  apiVersion?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    uid?: string;
  };
}

// ============================================
// RBAC-related control ID list
// ============================================

const RBAC_CONTROL_IDS = new Set([
  "C-0007", // Data Destruction
  "C-0011", // Cluster-admin binding
  "C-0034", // Automatic mapping of service account
  "C-0035", // Cluster-admin binding
  "C-0036", // Validate admission controller
  "C-0041", // HostNetwork access
  "C-0046", // Insecure capabilities
  "C-0053", // Access container service account
  "C-0057", // Privileged container (RBAC context)
  "C-0058", // Impersonate permissions
  "C-0063", // Audit logs enabled
]);

// ============================================
// Severity mapping (based on Kubescape scoreFactor)
// ============================================

const KUBESCAPE_SEVERITY_MAP: Record<string, Severity> = {
  Critical: Severity.Critical,
  High: Severity.High,
  Medium: Severity.Medium,
  Low: Severity.Low,
  Unknown: Severity.Unknown,
};

/**
 * After kubescape v4, controls[].severity is passed as a plain string ("High", "Medium", etc.).
 * For previous versions / summaryDetails, it is a { severity: string, scoreFactor: number } object.
 * Handles both formats.
 */
export function normalizeSeverityFromKubescape(severityDetail?: KubescapeSeverityDetail | string): Severity {
  if (!severityDetail) return Severity.Unknown;

  // v4+: plain string
  if (typeof severityDetail === "string") {
    const mapped = KUBESCAPE_SEVERITY_MAP[severityDetail];
    return mapped ?? Severity.Unknown;
  }

  // Object format (previous version / summaryDetails)
  const raw = severityDetail.severity;
  if (raw) {
    const mapped = KUBESCAPE_SEVERITY_MAP[raw];
    if (mapped) return mapped;
  }

  // scoreFactor-based fallback
  const score = severityDetail.scoreFactor ?? 0;
  if (score >= 9) return Severity.Critical;
  if (score >= 7) return Severity.High;
  if (score >= 4) return Severity.Medium;
  if (score >= 1) return Severity.Low;
  return Severity.Unknown;
}

// ============================================
// resourceID parsing
// ============================================

export interface ParsedResourceId {
  kind: string;
  name: string;
  namespace?: string;
  apiVersion?: string;
}

/**
 * Parse Kubescape resourceID string.
 *
 * Examples:
 * - `/v1/namespaces/default/Pod/my-pod`
 * - `/apps/v1/namespaces/kube-system/Deployment/coredns`
 * - `/v1/ClusterRole/cluster-admin` (cluster-scoped)
 */
export function parseResourceId(resourceId?: string): ParsedResourceId {
  if (!resourceId) {
    return { kind: "Unknown", name: "unknown" };
  }

  // Pattern: /apiGroup/version/namespaces/namespace/Kind/name
  // Or:      /version/namespaces/namespace/Kind/name
  const parts = resourceId.split("/").filter(Boolean);

  // Parse based on 'namespaces' keyword
  const nsIdx = parts.indexOf("namespaces");
  if (nsIdx !== -1 && parts.length >= nsIdx + 4) {
    const namespace = parts[nsIdx + 1];
    const kind = parts[nsIdx + 2] ?? "Unknown";
    const name = parts[nsIdx + 3] ?? "unknown";
    return { kind, name, namespace };
  }

  // Kubescape RBAC composite path: /namespace/Kind/name/apiGroup/version/...
  // e.g. /rook-ceph/ServiceAccount/rook-ceph-system/rbac.../ClusterRole/...
  // Distinguish from cluster-scoped paths like /v1/ClusterRole/admin:
  // - RBAC composite: parts[0]=namespace (not a version), parts[1]=Kind (uppercase), many segments
  // - Cluster-scoped: parts[0]=version (v1, apps, etc.), only 3 segments
  // Heuristic: if parts[0] looks like an API version/group (matches /^[a-z]/ or contains digits like v1)
  // then it's NOT a namespace. A real namespace won't start with "v" followed by a digit.
  if (parts.length >= 4) {
    const firstIsVersion = /^v\d/.test(parts[0]) || parts[0].includes(".");
    if (!firstIsVersion && /^[A-Z]/.test(parts[1])) {
      const namespace = parts[0];
      const kind = parts[1];
      const name = parts[2] ?? "unknown";
      return { kind, name, namespace };
    }
  }

  // Cluster-scoped: /version/Kind/name
  if (parts.length >= 2) {
    const kind = parts[parts.length - 2] ?? "Unknown";
    const name = parts[parts.length - 1] ?? "unknown";
    return { kind, name };
  }

  return { kind: "Unknown", name: resourceId };
}

// ============================================
// Extract metadata from resource object
// ============================================

function extractFromObject(obj?: KubescapeK8sObject): ParsedResourceId {
  if (!obj?.metadata) return { kind: obj?.kind ?? "Unknown", name: "unknown" };
  return {
    kind: obj.kind ?? "Unknown",
    name: obj.metadata.name ?? "unknown",
    namespace: obj.metadata.namespace,
    apiVersion: obj.apiVersion,
  };
}

// ============================================
// ControlResult → MisconfigFinding or RbacFinding
// ============================================

function controlResultToFinding(
  control: KubescapeControlResult,
  resource: ParsedResourceId,
  scannedAt: string,
  resourceId?: string,
  resourceObj?: KubescapeK8sObject,
  summaryControl?: KubescapeControlSummary,
): AnySecurityFinding | null {
  // Don't create Finding for passed controls
  if (control.status?.status !== "failed") return null;

  const controlId = control.controlID ?? "";
  const severity = normalizeSeverityFromKubescape(control.severity);

  // remediation: fixPaths/fixCommand → static meta in fallback order
  const firstRule = control.rules?.[0];
  const ruleRemediation =
    firstRule?.fixCommand ??
    (firstRule?.fixPaths?.[0]?.path
      ? `Set \`${firstRule.fixPaths[0].path}\` to \`${firstRule.fixPaths[0].value ?? "recommended value"}\``
      : undefined);
  // staticRemediation is assigned after description fallback, so temporary undefined
  let remediation: string | undefined = ruleRemediation;

  // Static control metadata (based on regolibrary) — provides description/remediation/references not in Kubescape JSON
  const staticMeta = getKubescapeControlMeta(controlId);
  const staticRemediation = staticMeta?.remediation;

  // NOTE: compliance URL references to be added during Epic 2 dashboard implementation
  // getComplianceControls(controlId) can map NSA·MITRE but external URLs not provided

  // Collect all failedPaths and fixPaths across all rules
  const allFailedPaths: string[] = [];
  const allFixPaths: { path: string; value?: string }[] = [];
  for (const rule of control.rules ?? []) {
    for (const fp of rule.failedPaths ?? []) allFailedPaths.push(fp);
    for (const fx of rule.fixPaths ?? []) {
      if (fx.path) allFixPaths.push({ path: fx.path, value: fx.value });
    }
  }

  // Build human-readable description from failedPaths / fixPaths
  const descriptionLines: string[] = [];
  if (allFailedPaths.length > 0) {
    descriptionLines.push(`Affected fields: ${allFailedPaths.join(", ")}`);
  }
  if (allFixPaths.length > 0) {
    const fixLine = allFixPaths.map((fx) => `Set \`${fx.path}\` to \`${fx.value ?? "recommended"}\``).join("; ");
    descriptionLines.push(`Fix: ${fixLine}`);
  }
  // Priority: failedPaths/fixPaths > static meta description > summaryDetails > rule names
  const description =
    descriptionLines.length > 0
      ? descriptionLines.join("\n")
      : staticMeta?.description ||
        summaryControl?.description ||
        control.rules
          ?.map((r) => r.name ?? "")
          .filter(Boolean)
          .join("; ") ||
        "";

  // Final remediation decision: rule-based → static meta order
  remediation = remediation ?? staticRemediation;

  const baseFields = {
    severity,
    source: ScannerSource.Kubescape,
    title: control.name ?? controlId,
    description,
    resource: {
      kind: resource.kind,
      name: resource.name,
      namespace: resource.namespace,
    },
    remediation,
    references: staticMeta?.references?.length
      ? staticMeta.references
      : summaryControl?.helpUrl
        ? [summaryControl.helpUrl]
        : undefined,
    detectedAt: scannedAt,
    rawLog: {
      controlID: controlId,
      controlName: control.name,
      severity: control.severity,
      rules: control.rules,
      status: control.status,
      _resourceID: resourceId,
      _k8sObject: resourceObj ?? null,
      ...(summaryControl?.description ? { summaryDescription: summaryControl.description } : {}),
      ...(summaryControl?.helpUrl ? { helpUrl: summaryControl.helpUrl } : {}),
      ...(summaryControl?.complianceFrameworks?.length
        ? { complianceFrameworks: summaryControl.complianceFrameworks }
        : {}),
      ...(staticMeta?.threatMatrix?.length ? { threatMatrix: staticMeta.threatMatrix } : {}),
    } as Record<string, unknown>,
  };

  // Use resourceId as part of the id to guarantee uniqueness when multiple resources
  // share the same kind/name (e.g. metadata.name missing → all fallback to "unknown")
  const resourceSuffix = resourceId ?? `${resource.namespace ?? "cluster"}-${resource.kind}-${resource.name}`;

  // If RBAC control, create RbacFinding
  if (RBAC_CONTROL_IDS.has(controlId)) {
    // True RBAC rules have paths starting with "rules[" (e.g. ClusterRole rules)
    // Pod Security / spec findings use spec paths (e.g. "spec.containers[0].hostNetwork")
    const hasPermissionPaths = (control.rules ?? []).some((r) =>
      (r.failedPaths ?? []).some((p) => p.startsWith("rules[")),
    );

    // Extract actual verbs/resources from _k8sObject.rules instead of raw JSON paths
    // Makes riskyPermissions human-readable (e.g. "get apps/deployments") for AI analysis and UI
    let riskyPermissions: string[] = [];
    if (hasPermissionPaths && resourceObj) {
      const k8sRules: Array<{ verbs?: string[]; resources?: string[]; apiGroups?: string[] }> =
        (resourceObj as any)?.rules ?? (resourceObj as any)?.spec?.rules ?? [];
      for (const rule of k8sRules) {
        const verbs = rule.verbs ?? [];
        const resources = rule.resources ?? [];
        const apiGroups = rule.apiGroups ?? [""];
        if (verbs.length > 0 && resources.length > 0) {
          for (const verb of verbs) {
            for (const res of resources) {
              const group = apiGroups[0] && apiGroups[0] !== "" ? `${apiGroups[0]}/` : "";
              riskyPermissions.push(`${verb} ${group}${res}`);
            }
          }
        }
      }
    }
    // Fallback to raw paths if k8sObject parsing yielded nothing (e.g. object missing)
    if (riskyPermissions.length === 0 && hasPermissionPaths) {
      riskyPermissions = allFailedPaths;
    }

    const rbacFinding: RbacFinding = {
      id: `kubescape-rbac-${controlId}-${resourceSuffix}`,
      type: FindingType.RBAC,
      ...baseFields,
      subject: resource.name, // MVP: using resource name (actual subject requires extraction from RoleBinding.subjects — Epic 2)
      riskyPermissions: hasPermissionPaths ? riskyPermissions : [],
      affectedSpecFields: !hasPermissionPaths && allFailedPaths.length > 0 ? allFailedPaths : undefined,
    };
    return rbacFinding;
  }

  // Otherwise MisconfigFinding
  const misconfigFinding: MisconfigFinding = {
    id: `kubescape-misconfig-${controlId}-${resourceSuffix}`,
    type: FindingType.Misconfiguration,
    ...baseFields,
    checkId: controlId,
    category: "Kubescape",
    affectedFields: allFailedPaths.length > 0 ? allFailedPaths : undefined,
    fixSuggestions: allFixPaths.length > 0 ? allFixPaths : undefined,
  };
  return misconfigFinding;
}

// ============================================
// KubescapeReport → AnySecurityFinding[] (main conversion function)
// ============================================

/**
 * Converts Kubescape JSON report to AnySecurityFinding array.
 *
 * @param raw - Kubescape raw JSON
 * @param clusterId - Target cluster ID for scan
 * @returns Converted SecurityFinding list (failed controls only)
 */
export function normalizeKubescapeReport(raw: unknown, _clusterId: string): AnySecurityFinding[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const report = raw as KubescapeReport;

  if (!Array.isArray(report.results)) {
    return [];
  }

  // Build resourceID → KubescapeK8sObject map (O(1) lookup)
  const resourceMap = new Map<string, KubescapeK8sObject>();
  for (const res of report.resources ?? []) {
    if (res.resourceID && res.object) {
      resourceMap.set(res.resourceID, res.object);
    }
  }

  // Build controlID → KubescapeControlSummary map (extract description, helpUrl etc. from summaryDetails)
  const summaryControlMap = new Map<string, KubescapeControlSummary>();
  for (const [cid, summary] of Object.entries(report.summaryDetails?.controls ?? {})) {
    summaryControlMap.set(cid, summary);
  }

  const scannedAt = new Date().toISOString();
  const findings: AnySecurityFinding[] = [];

  for (const result of report.results) {
    if (!result.resourceID) continue;

    // Resource info: prioritize object if available, otherwise parse resourceID
    // When metadata.name is missing from the object (e.g. RBAC resources with composite paths),
    // fall back to parseResourceId to get a meaningful name from the resourceID path.
    const obj = resourceMap.get(result.resourceID);
    const fromObj = obj ? extractFromObject(obj) : null;
    const fromId = parseResourceId(result.resourceID);
    const resource: ParsedResourceId = fromObj
      ? {
          ...fromObj,
          // If extractFromObject got name/kind as unknown, use parsed resourceID values instead
          name: fromObj.name === "unknown" && fromId.name !== "unknown" ? fromId.name : fromObj.name,
          kind: fromObj.kind === "Unknown" && fromId.kind !== "Unknown" ? fromId.kind : fromObj.kind,
        }
      : fromId;

    for (const control of result.controls ?? []) {
      const summaryControl = summaryControlMap.get(control.controlID ?? "");
      const finding = controlResultToFinding(control, resource, scannedAt, result.resourceID, obj, summaryControl);
      if (finding) {
        findings.push(finding);
      }
    }
  }

  return deduplicateFindings(findings);
}

function deduplicateFindings(findings: AnySecurityFinding[]): AnySecurityFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

// ============================================
// Runtime type guard
// ============================================

export function isKubescapeReport(value: unknown): value is KubescapeReport {
  return (
    typeof value === "object" &&
    value !== null &&
    ("results" in value ? Array.isArray((value as KubescapeReport).results) : true)
  );
}
