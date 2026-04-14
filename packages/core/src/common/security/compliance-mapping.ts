/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 목적: NSA·MITRE ATT&CK 컴플라이언스 매핑 데이터
 * NSA·MITRE 컴플라이언스 매핑 데이터 구축
 *
 * 주요 내용:
 * - NSA Kubernetes Hardening Guide 컨트롤 목록
 * - MITRE ATT&CK for Containers 전술/기술 목록
 * - Kubescape 컨트롤 ID ↔ 프레임워크 매핑 테이블
 * - Trivy misconfiguration ID ↔ 프레임워크 매핑 테이블
 *
 * @packageDocumentation
 */

// ============================================
// 컴플라이언스 프레임워크 열거형
// ============================================

export enum ComplianceFramework {
  NSA = "NSA",
  MITRE_ATTACK = "MITRE_ATTACK",
  CIS_KUBERNETES = "CIS_KUBERNETES",
}

// ============================================
// 컴플라이언스 컨트롤 타입
// ============================================

export interface ComplianceControl {
  /** 컨트롤 고유 ID */
  id: string;

  /** 프레임워크 */
  framework: ComplianceFramework;

  /** 컨트롤 이름 */
  name: string;

  /** 카테고리 (NSA 섹션명 / MITRE 전술) */
  category: string;

  /** 설명 */
  description: string;

  /** 심각도 수준 */
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

// ============================================
// Finding ID → 컴플라이언스 컨트롤 매핑 타입
// ============================================

export interface FindingComplianceMapping {
  /** Kubescape 컨트롤 ID 또는 Trivy Check ID */
  findingId: string;

  /** 매핑되는 컴플라이언스 컨트롤 ID 목록 */
  controlIds: string[];
}

// ============================================
// NSA Kubernetes Hardening Guide 컨트롤
// ============================================

export const NSA_CONTROLS: ComplianceControl[] = [
  // Pod Security
  {
    id: "NSA-1.1",
    framework: ComplianceFramework.NSA,
    name: "Non-root containers",
    category: "Pod Security",
    description: "Containers should not run as root user to minimize privilege escalation risk.",
    severity: "HIGH",
  },
  {
    id: "NSA-1.2",
    framework: ComplianceFramework.NSA,
    name: "Immutable container filesystem",
    category: "Pod Security",
    description: "Container root filesystem should be read-only to prevent runtime modification.",
    severity: "MEDIUM",
  },
  {
    id: "NSA-1.3",
    framework: ComplianceFramework.NSA,
    name: "Privileged containers",
    category: "Pod Security",
    description: "Privileged containers should not be used as they have full host access.",
    severity: "CRITICAL",
  },
  {
    id: "NSA-1.4",
    framework: ComplianceFramework.NSA,
    name: "Host namespaces",
    category: "Pod Security",
    description: "Pods should not share host network, PID, or IPC namespaces.",
    severity: "HIGH",
  },
  {
    id: "NSA-1.5",
    framework: ComplianceFramework.NSA,
    name: "Resource limits",
    category: "Pod Security",
    description: "CPU and memory limits should be set on all containers.",
    severity: "MEDIUM",
  },
  // Network Security
  {
    id: "NSA-2.1",
    framework: ComplianceFramework.NSA,
    name: "Network policies",
    category: "Network Security",
    description: "Network policies should restrict pod-to-pod and external communication.",
    severity: "HIGH",
  },
  {
    id: "NSA-2.2",
    framework: ComplianceFramework.NSA,
    name: "Ingress/Egress filtering",
    category: "Network Security",
    description: "Namespaces should have explicit ingress and egress network policies.",
    severity: "MEDIUM",
  },
  // RBAC
  {
    id: "NSA-3.1",
    framework: ComplianceFramework.NSA,
    name: "Least privilege RBAC",
    category: "RBAC",
    description: "Service accounts and users should follow principle of least privilege.",
    severity: "HIGH",
  },
  {
    id: "NSA-3.2",
    framework: ComplianceFramework.NSA,
    name: "Avoid cluster-admin binding",
    category: "RBAC",
    description: "ClusterRoleBinding to cluster-admin should be avoided.",
    severity: "CRITICAL",
  },
  {
    id: "NSA-3.3",
    framework: ComplianceFramework.NSA,
    name: "Wildcard permissions",
    category: "RBAC",
    description: "Wildcard (*) permissions in roles should be avoided.",
    severity: "HIGH",
  },
  // Secrets Management
  {
    id: "NSA-4.1",
    framework: ComplianceFramework.NSA,
    name: "Secret encryption at rest",
    category: "Secrets Management",
    description: "Kubernetes secrets should be encrypted at rest in etcd.",
    severity: "CRITICAL",
  },
  {
    id: "NSA-4.2",
    framework: ComplianceFramework.NSA,
    name: "Avoid environment variable secrets",
    category: "Secrets Management",
    description: "Secrets should not be passed via environment variables.",
    severity: "MEDIUM",
  },
  // Audit Logging
  {
    id: "NSA-5.1",
    framework: ComplianceFramework.NSA,
    name: "Audit logging enabled",
    category: "Audit Logging",
    description: "Kubernetes API server audit logging should be enabled.",
    severity: "HIGH",
  },
];

// ============================================
// MITRE ATT&CK for Containers 전술/기술
// ============================================

export const MITRE_CONTROLS: ComplianceControl[] = [
  // Initial Access
  {
    id: "MITRE-TA0001-T1190",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Exploit Public-Facing Application",
    category: "Initial Access",
    description: "Attackers may exploit vulnerabilities in public-facing containerized applications.",
    severity: "CRITICAL",
  },
  // Execution
  {
    id: "MITRE-TA0002-T1609",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Container Administration Command",
    category: "Execution",
    description: "Attackers may abuse container administration tools to execute commands.",
    severity: "HIGH",
  },
  {
    id: "MITRE-TA0002-T1610",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Deploy Container",
    category: "Execution",
    description: "Attackers may deploy containers to execute malicious workloads.",
    severity: "HIGH",
  },
  // Persistence
  {
    id: "MITRE-TA0003-T1525",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Implant Internal Image",
    category: "Persistence",
    description: "Attackers may implant malicious code into container images for persistence.",
    severity: "CRITICAL",
  },
  {
    id: "MITRE-TA0003-T1611",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Escape to Host",
    category: "Persistence",
    description: "Attackers may break out of container isolation to gain host access.",
    severity: "CRITICAL",
  },
  // Privilege Escalation
  {
    id: "MITRE-TA0004-T1611",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Container Escape (Privilege Escalation)",
    category: "Privilege Escalation",
    description: "Privileged containers or host mount abuse can lead to privilege escalation.",
    severity: "CRITICAL",
  },
  // Defense Evasion
  {
    id: "MITRE-TA0005-T1578",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Modify Cloud Compute Infrastructure",
    category: "Defense Evasion",
    description: "Attackers may modify container infrastructure to evade detection.",
    severity: "HIGH",
  },
  // Credential Access
  {
    id: "MITRE-TA0006-T1552",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Unsecured Credentials",
    category: "Credential Access",
    description: "Secrets exposed via environment variables or mounted volumes.",
    severity: "HIGH",
  },
  // Discovery
  {
    id: "MITRE-TA0007-T1613",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Container and Resource Discovery",
    category: "Discovery",
    description: "Attackers may enumerate cluster resources using Kubernetes API.",
    severity: "MEDIUM",
  },
  // Lateral Movement
  {
    id: "MITRE-TA0008-T1570",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Lateral Tool Transfer",
    category: "Lateral Movement",
    description: "Attackers may move laterally across pods using network access.",
    severity: "HIGH",
  },
  // Impact
  {
    id: "MITRE-TA0040-T1496",
    framework: ComplianceFramework.MITRE_ATTACK,
    name: "Resource Hijacking",
    category: "Impact",
    description: "Attackers may exploit resources for cryptocurrency mining or other purposes.",
    severity: "MEDIUM",
  },
];

// ============================================
// 전체 컨트롤 맵 (ID → Control)
// ============================================

export const ALL_CONTROLS: Map<string, ComplianceControl> = new Map([
  ...NSA_CONTROLS.map((c) => [c.id, c] as [string, ComplianceControl]),
  ...MITRE_CONTROLS.map((c) => [c.id, c] as [string, ComplianceControl]),
]);

// ============================================
// Kubescape 컨트롤 ID ↔ 컴플라이언스 매핑
// ============================================

export const KUBESCAPE_COMPLIANCE_MAPPING: FindingComplianceMapping[] = [
  { findingId: "C-0002", controlIds: ["NSA-1.3", "MITRE-TA0004-T1611"] }, // Privileged container
  { findingId: "C-0004", controlIds: ["NSA-3.3", "MITRE-TA0007-T1613"] }, // Resource policies
  { findingId: "C-0007", controlIds: ["NSA-3.1"] }, // Data Destruction
  { findingId: "C-0013", controlIds: ["NSA-3.2", "MITRE-TA0004-T1611"] }, // Non-root containers
  { findingId: "C-0016", controlIds: ["NSA-1.3"] }, // Allow privilege escalation
  { findingId: "C-0017", controlIds: ["NSA-1.4"] }, // Immutable container filesystem
  { findingId: "C-0020", controlIds: ["NSA-2.1", "MITRE-TA0008-T1570"] }, // Mount service principal
  { findingId: "C-0021", controlIds: ["NSA-4.2", "MITRE-TA0006-T1552"] }, // Exposed secret in env
  { findingId: "C-0030", controlIds: ["NSA-2.1"] }, // Ingress and Egress blocked
  { findingId: "C-0034", controlIds: ["NSA-3.2", "MITRE-TA0004-T1611"] }, // Automatic mapping of service account
  { findingId: "C-0036", controlIds: ["NSA-1.2", "MITRE-TA0005-T1578"] }, // Validate admission controller
  { findingId: "C-0041", controlIds: ["NSA-1.4"] }, // HostNetwork access
  { findingId: "C-0044", controlIds: ["NSA-4.1"] }, // Container hostPort
  { findingId: "C-0045", controlIds: ["NSA-1.1"] }, // Writable hostPath mount
  { findingId: "C-0046", controlIds: ["NSA-1.5"] }, // Insecure capabilities
  { findingId: "C-0048", controlIds: ["NSA-2.1", "MITRE-TA0008-T1570"] }, // HostPath mount
  { findingId: "C-0055", controlIds: ["NSA-1.5"] }, // Linux hardening
  { findingId: "C-0057", controlIds: ["NSA-1.1"] }, // Privileged container
  { findingId: "C-0058", controlIds: ["NSA-3.1", "MITRE-TA0007-T1613"] }, // Impersonate permissions
  { findingId: "C-0065", controlIds: ["NSA-2.1", "MITRE-TA0008-T1570"] }, // No network policy
];

// ============================================
// Trivy Misconfiguration ID ↔ 컴플라이언스 매핑
// ============================================

export const TRIVY_COMPLIANCE_MAPPING: FindingComplianceMapping[] = [
  { findingId: "KSV001", controlIds: ["NSA-1.3", "MITRE-TA0004-T1611"] }, // Process can elevate its own privileges
  { findingId: "KSV002", controlIds: ["NSA-1.3"] }, // AppArmor policies disabled
  { findingId: "KSV003", controlIds: ["NSA-3.3"] }, // Default capabilities not dropped
  { findingId: "KSV005", controlIds: ["NSA-1.3", "MITRE-TA0004-T1611"] }, // SYS_ADMIN capability added
  { findingId: "KSV006", controlIds: ["NSA-1.4"] }, // hostPath volume mounted
  { findingId: "KSV008", controlIds: ["NSA-1.4"] }, // hostPID enabled
  { findingId: "KSV009", controlIds: ["NSA-1.4"] }, // hostNetwork enabled
  { findingId: "KSV010", controlIds: ["NSA-1.4"] }, // hostIPC enabled
  { findingId: "KSV011", controlIds: ["NSA-1.5"] }, // CPU not limited
  { findingId: "KSV012", controlIds: ["NSA-1.1"] }, // Runs as root user
  { findingId: "KSV013", controlIds: ["MITRE-TA0003-T1525"] }, // Image tag latest
  { findingId: "KSV014", controlIds: ["NSA-1.2"] }, // Root filesystem not read-only
  { findingId: "KSV015", controlIds: ["NSA-1.5"] }, // CPU requests not specified
  { findingId: "KSV016", controlIds: ["NSA-1.5"] }, // Memory requests not specified
  { findingId: "KSV017", controlIds: ["NSA-1.3", "MITRE-TA0004-T1611"] }, // Privileged container
  { findingId: "KSV018", controlIds: ["NSA-1.5"] }, // Memory not limited
  { findingId: "KSV020", controlIds: ["NSA-1.1"] }, // Runs with UID 0
  { findingId: "KSV021", controlIds: ["NSA-1.1"] }, // Runs with GID 0
  { findingId: "KSV023", controlIds: ["NSA-4.2", "MITRE-TA0006-T1552"] }, // hostPath writable
  { findingId: "KSV025", controlIds: ["NSA-1.3"] }, // Seccomp policies disabled
  { findingId: "KSV030", controlIds: ["NSA-1.3"] }, // RuntimeDefault seccomp not set
];

// ============================================
// 유틸 함수
// ============================================

/**
 * Finding ID로 매핑된 컴플라이언스 컨트롤 목록을 반환합니다.
 */
export function getComplianceControls(findingId: string): ComplianceControl[] {
  const kubescapeEntry = KUBESCAPE_COMPLIANCE_MAPPING.find((m) => m.findingId === findingId);
  const trivyEntry = TRIVY_COMPLIANCE_MAPPING.find((m) => m.findingId === findingId);

  const controlIds = [...(kubescapeEntry?.controlIds ?? []), ...(trivyEntry?.controlIds ?? [])];

  return controlIds.map((id) => ALL_CONTROLS.get(id)).filter((c): c is ComplianceControl => c !== undefined);
}

/**
 * 프레임워크별 컨트롤 목록을 반환합니다.
 */
export function getControlsByFramework(framework: ComplianceFramework): ComplianceControl[] {
  return Array.from(ALL_CONTROLS.values()).filter((c) => c.framework === framework);
}
