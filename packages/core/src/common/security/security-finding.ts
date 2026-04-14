/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Severity levels for security findings
 */
export enum Severity {
  Critical = "CRITICAL",
  High = "HIGH",
  Medium = "MEDIUM",
  Low = "LOW",
  Unknown = "UNKNOWN",
}

/**
 * Types of security findings
 */
export enum FindingType {
  CVE = "CVE",
  Misconfiguration = "MISCONFIGURATION",
  RBAC = "RBAC",
  NetworkPolicy = "NETWORK_POLICY",
}

/**
 * Scanner source that produced the finding
 */
export enum ScannerSource {
  Trivy = "TRIVY",
  Kubescape = "KUBESCAPE",
}

/**
 * Base interface for all security findings
 */
export interface SecurityFinding {
  /** Unique identifier for this finding */
  id: string;
  /** Type of finding */
  type: FindingType;
  /** Severity level */
  severity: Severity;
  /** Scanner that produced this finding */
  source: ScannerSource;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Kubernetes resource this finding relates to */
  resource: SecurityFindingResource;
  /** Remediation guidance */
  remediation?: string;
  /** External references (CVE links, docs, etc.) */
  references?: string[];
  /** Timestamp when the finding was detected */
  detectedAt: string;
  /** Raw log data from the scanner for detailed inspection */
  rawLog?: Record<string, unknown>;
}

/**
 * Kubernetes resource reference for a finding
 */
export interface SecurityFindingResource {
  kind: string;
  name: string;
  namespace?: string;
  apiVersion?: string;
}

/**
 * CVE-specific finding
 */
export interface CveFinding extends SecurityFinding {
  type: FindingType.CVE;
  /** trivy Result.Class (os-pkgs, lang-pkgs, config, secret) */
  trivyClass?: string;
  /** CVE identifier, e.g. CVE-2024-1234 */
  cveId: string;
  /** Affected package name */
  packageName: string;
  /** Installed version */
  installedVersion: string;
  /** Fixed version (if available) */
  fixedVersion?: string;
  /** CVSS score (0-10) */
  cvssScore?: number;
  /** CVSS v3 vector string (e.g. CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H) */
  cvssVector?: string;
  /** CVE published date (ISO 8601) */
  publishedDate?: string;
}

/**
 * Misconfiguration finding (e.g. Trivy config scan)
 */
export interface MisconfigFinding extends SecurityFinding {
  type: FindingType.Misconfiguration;
  /** trivy Result.Class (os-pkgs, lang-pkgs, config, secret) */
  trivyClass?: string;
  /** Policy/check ID */
  checkId: string;
  /** Category (e.g. "Pod Security") */
  category?: string;
  /** Affected spec fields (from kubescape failedPaths) */
  affectedFields?: string[];
  /** Fix suggestions (from kubescape fixPaths) */
  fixSuggestions?: { path: string; value?: string }[];
}

/**
 * RBAC risk finding
 */
export interface RbacFinding extends SecurityFinding {
  type: FindingType.RBAC;
  /** Affected subject (user/group/serviceaccount) */
  subject: string;
  /** Risky permissions granted (for true RBAC rules) */
  riskyPermissions: string[];
  /** Affected spec fields (for Pod Security / non-RBAC kubescape findings) */
  affectedSpecFields?: string[];
}

/**
 * Union type for all finding variants
 */
export type AnySecurityFinding = CveFinding | MisconfigFinding | RbacFinding;

/**
 * Scan result container
 */
export interface ScanResult {
  clusterId: string;
  findings: AnySecurityFinding[];
  scannedAt: string;
  scannerVersion?: string;
}
