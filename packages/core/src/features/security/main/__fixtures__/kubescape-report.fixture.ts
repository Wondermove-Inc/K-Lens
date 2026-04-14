/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Kubescape 단위 테스트용 fixture 데이터
 * Kubescape 스캐너 단위 테스트
 */

import type { KubescapeReport } from "../kubescape-normalizer";

// ============================================
// FIXTURE 1: 혼합 리포트 (Misconfig + RBAC)
// ============================================

/**
 * Misconfig 2개 + RBAC 1개 포함 혼합 리포트
 * - C-0002 (Privileged container) → MisconfigFinding
 * - C-0016 (Allow privilege escalation) → MisconfigFinding
 * - C-0011 (Cluster-admin binding) → RbacFinding
 */
export const MIXED_KUBESCAPE_REPORT: KubescapeReport = {
  summaryDetails: {
    frameworks: [
      { name: "NSA", status: "failed" },
      { name: "MITRE", status: "failed" },
    ],
    controls: {
      "C-0002": {
        controlID: "C-0002",
        name: "Privileged container",
        severity: { severity: "High", scoreFactor: 8 },
      },
      "C-0016": {
        controlID: "C-0016",
        name: "Allow privilege escalation",
        severity: { severity: "Medium", scoreFactor: 5 },
      },
      "C-0011": {
        controlID: "C-0011",
        name: "Cluster-admin binding",
        severity: { severity: "Critical", scoreFactor: 9 },
      },
    },
  },
  results: [
    // Pod: C-0002 failed
    {
      resourceID: "/v1/namespaces/default/Pod/nginx-pod",
      controls: [
        {
          controlID: "C-0002",
          name: "Privileged container",
          status: { status: "failed" },
          severity: { severity: "High", scoreFactor: 8 },
          rules: [
            {
              name: "privileged-container",
              failedPaths: ["spec.containers[0].securityContext.privileged"],
              fixPaths: [
                {
                  path: "spec.containers[0].securityContext.privileged",
                  value: "false",
                },
              ],
              fixCommand: undefined,
            },
          ],
        },
        // passed 컨트롤 — Finding 생성 안 함
        {
          controlID: "C-0013",
          name: "Non-root containers",
          status: { status: "passed" },
          severity: { severity: "Medium", scoreFactor: 5 },
          rules: [],
        },
      ],
    },
    // Deployment: C-0016 failed
    {
      resourceID: "/apps/v1/namespaces/kube-system/Deployment/coredns",
      controls: [
        {
          controlID: "C-0016",
          name: "Allow privilege escalation",
          status: { status: "failed" },
          severity: { severity: "Medium", scoreFactor: 5 },
          rules: [
            {
              name: "allow-privilege-escalation",
              failedPaths: ["spec.template.spec.containers[0].securityContext.allowPrivilegeEscalation"],
              fixPaths: [
                {
                  path: "spec.template.spec.containers[0].securityContext.allowPrivilegeEscalation",
                  value: "false",
                },
              ],
            },
          ],
        },
      ],
    },
    // ClusterRoleBinding: C-0011 failed → RbacFinding
    {
      resourceID: "/v1/ClusterRoleBinding/system:masters",
      controls: [
        {
          controlID: "C-0011",
          name: "Cluster-admin binding",
          status: { status: "failed" },
          severity: { severity: "Critical", scoreFactor: 9 },
          rules: [
            {
              name: "cluster-admin-binding",
              failedPaths: ["subjects[0].name"],
              fixCommand: "kubectl delete clusterrolebinding system:masters",
            },
          ],
        },
      ],
    },
  ],
  resources: [
    {
      resourceID: "/v1/namespaces/default/Pod/nginx-pod",
      object: {
        kind: "Pod",
        apiVersion: "v1",
        metadata: { name: "nginx-pod", namespace: "default" },
      },
    },
    {
      resourceID: "/apps/v1/namespaces/kube-system/Deployment/coredns",
      object: {
        kind: "Deployment",
        apiVersion: "apps/v1",
        metadata: { name: "coredns", namespace: "kube-system" },
      },
    },
    {
      resourceID: "/v1/ClusterRoleBinding/system:masters",
      object: {
        kind: "ClusterRoleBinding",
        apiVersion: "v1",
        metadata: { name: "system:masters" },
      },
    },
  ],
};

// ============================================
// FIXTURE 2: results가 빈 배열
// ============================================

export const EMPTY_RESULTS_REPORT: KubescapeReport = {
  summaryDetails: {},
  results: [],
  resources: [],
};

// ============================================
// FIXTURE 3: results 없음 (optional 필드)
// ============================================

export const NO_RESULTS_REPORT: KubescapeReport = {
  summaryDetails: {},
};

// ============================================
// FIXTURE 4: 모두 passed 컨트롤 (Finding 없음)
// ============================================

export const ALL_PASSED_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/namespaces/default/Pod/healthy-pod",
      controls: [
        {
          controlID: "C-0002",
          name: "Privileged container",
          status: { status: "passed" },
          severity: { severity: "High", scoreFactor: 8 },
          rules: [],
        },
        {
          controlID: "C-0013",
          name: "Non-root containers",
          status: { status: "skipped" },
          rules: [],
        },
      ],
    },
  ],
  resources: [
    {
      resourceID: "/v1/namespaces/default/Pod/healthy-pod",
      object: {
        kind: "Pod",
        apiVersion: "v1",
        metadata: { name: "healthy-pod", namespace: "default" },
      },
    },
  ],
};

// ============================================
// FIXTURE 5: scoreFactor 기반 severity (severity 문자열 없음)
// ============================================

export const SCORE_FACTOR_SEVERITY_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/namespaces/prod/Pod/api-server",
      controls: [
        {
          controlID: "C-0020",
          name: "Mount service principal",
          status: { status: "failed" },
          severity: { scoreFactor: 9.5 }, // severity 문자열 없음 → scoreFactor로 CRITICAL
          rules: [],
        },
        {
          controlID: "C-0004",
          name: "Resource policies",
          status: { status: "failed" },
          severity: { scoreFactor: 3 }, // LOW
          rules: [],
        },
        {
          controlID: "C-0030",
          name: "Ingress and Egress blocked",
          status: { status: "failed" },
          severity: {}, // scoreFactor 없음 → UNKNOWN
          rules: [],
        },
      ],
    },
  ],
  resources: [
    {
      resourceID: "/v1/namespaces/prod/Pod/api-server",
      object: {
        kind: "Pod",
        apiVersion: "v1",
        metadata: { name: "api-server", namespace: "prod" },
      },
    },
  ],
};

// ============================================
// FIXTURE 6: resources 맵 없음 (resourceID 파싱 폴백)
// ============================================

export const NO_RESOURCE_MAP_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/namespaces/staging/Pod/worker",
      controls: [
        {
          controlID: "C-0002",
          name: "Privileged container",
          status: { status: "failed" },
          severity: { severity: "High", scoreFactor: 8 },
          rules: [],
        },
      ],
    },
    {
      resourceID: "/v1/ClusterRole/admin",
      controls: [
        {
          controlID: "C-0046",
          name: "Insecure capabilities",
          status: { status: "failed" },
          severity: { severity: "Low", scoreFactor: 2 },
          rules: [],
        },
      ],
    },
  ],
  // resources 없음 → resourceID 파싱 폴백
};

// ============================================
// FIXTURE 7: fixCommand 있는 케이스 (remediation)
// ============================================

export const FIX_COMMAND_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/namespaces/default/Pod/vulnerable-pod",
      controls: [
        {
          controlID: "C-0017",
          name: "Immutable container filesystem",
          status: { status: "failed" },
          severity: { severity: "Medium", scoreFactor: 5 },
          rules: [
            {
              name: "immutable-container-filesystem",
              failedPaths: [],
              fixCommand:
                'kubectl patch pod vulnerable-pod --patch \'{"spec":{"containers":[{"readOnlyRootFilesystem":true}]}}\'',
            },
          ],
        },
      ],
    },
  ],
  resources: [
    {
      resourceID: "/v1/namespaces/default/Pod/vulnerable-pod",
      object: {
        kind: "Pod",
        apiVersion: "v1",
        metadata: { name: "vulnerable-pod", namespace: "default" },
      },
    },
  ],
};

// ============================================
// FIXTURE 8: 동일 이름 다른 kind 중복 ID 충돌 재현
// Role/local-path-provisioner-bind vs ClusterRoleBinding/local-path-provisioner-bind
// ============================================

export const SAME_NAME_DIFFERENT_KIND_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/rbac.authorization.k8s.io/v1/local-path-storage/Role/local-path-provisioner-bind",
      controls: [
        {
          controlID: "C-0053",
          name: "Access container service account",
          status: { status: "failed" },
          severity: { severity: "Medium", scoreFactor: 5 },
          rules: [],
        },
      ],
    },
    {
      resourceID: "/rbac.authorization.k8s.io/v1/local-path-storage/ClusterRoleBinding/local-path-provisioner-bind",
      controls: [
        {
          controlID: "C-0053",
          name: "Access container service account",
          status: { status: "failed" },
          severity: { severity: "Medium", scoreFactor: 5 },
          rules: [],
        },
      ],
    },
  ],
  resources: [
    {
      resourceID: "/rbac.authorization.k8s.io/v1/local-path-storage/Role/local-path-provisioner-bind",
      object: {
        kind: "Role",
        apiVersion: "rbac.authorization.k8s.io/v1",
        metadata: { name: "local-path-provisioner-bind", namespace: "local-path-storage" },
      },
    },
    {
      resourceID: "/rbac.authorization.k8s.io/v1/local-path-storage/ClusterRoleBinding/local-path-provisioner-bind",
      object: {
        kind: "ClusterRoleBinding",
        apiVersion: "rbac.authorization.k8s.io/v1",
        metadata: { name: "local-path-provisioner-bind", namespace: "local-path-storage" },
      },
    },
  ],
};

/**  추가 fixture */

/** resourceID 없는 result → skip */
export const MISSING_RESOURCE_ID_REPORT: KubescapeReport = {
  results: [
    {
      // resourceID 없음 → skip
      controls: [
        {
          controlID: "C-0002",
          name: "Privileged container",
          severity: { severity: "High", scoreFactor: 8 },
          status: { status: "failed" },
        },
      ],
    },
    {
      resourceID: "/v1/namespaces/default/Pod/valid-pod",
      controls: [
        {
          controlID: "C-0016",
          name: "Privilege escalation",
          severity: { severity: "Medium", scoreFactor: 5 },
          status: { status: "failed" },
        },
      ],
    },
  ],
};

/** controls 없는 result */
export const NO_CONTROLS_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/namespaces/default/Pod/my-pod",
      controls: [],
    },
  ],
};

/** controlID/name 없는 control */
export const MISSING_CONTROL_ID_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/namespaces/default/Pod/my-pod",
      controls: [
        {
          // controlID 없음
          name: "Some control",
          severity: { severity: "Low", scoreFactor: 2 },
          status: { status: "failed" },
        },
        {
          controlID: "C-0099",
          // name 없음
          severity: { severity: "Medium", scoreFactor: 5 },
          status: { status: "failed" },
        },
      ],
    },
  ],
};

/** rules 없는 control */
export const NO_RULES_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/namespaces/default/Pod/my-pod",
      controls: [
        {
          controlID: "C-0002",
          name: "Privileged container",
          severity: { severity: "High", scoreFactor: 8 },
          status: { status: "failed" },
          // rules 없음
        },
      ],
    },
  ],
};

/** fixPaths만 있는 경우 (fixCommand 없음) */
export const FIX_PATHS_ONLY_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/namespaces/default/Pod/my-pod",
      controls: [
        {
          controlID: "C-0016",
          name: "Privilege escalation",
          severity: { severity: "Medium", scoreFactor: 5 },
          status: { status: "failed" },
          rules: [
            {
              name: "rule-1",
              fixPaths: [{ path: "spec.containers[0].securityContext.allowPrivilegeEscalation", value: "false" }],
            },
          ],
        },
      ],
    },
  ],
};

/** fixPaths.value 없는 경우 → "recommended value" 폴백 */
export const FIX_PATHS_NO_VALUE_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/namespaces/default/Pod/my-pod",
      controls: [
        {
          controlID: "C-0016",
          name: "Privilege escalation",
          severity: { severity: "Medium", scoreFactor: 5 },
          status: { status: "failed" },
          rules: [
            {
              name: "rule-1",
              fixPaths: [{ path: "spec.containers[0].securityContext.allowPrivilegeEscalation" }],
            },
          ],
        },
      ],
    },
  ],
};

/** 동일 resourceID + 다른 controlID → 별개 finding 2개 */
export const SAME_RESOURCE_MULTI_CONTROL_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/namespaces/default/Pod/my-pod",
      controls: [
        {
          controlID: "C-0002",
          name: "Privileged container",
          severity: { severity: "High", scoreFactor: 8 },
          status: { status: "failed" },
        },
        {
          controlID: "C-0016",
          name: "Privilege escalation",
          severity: { severity: "Medium", scoreFactor: 5 },
          status: { status: "failed" },
        },
      ],
    },
  ],
};

/** C-0007 (RBAC 컨트롤 — C-0011 이외) */
export const RBAC_C0007_REPORT: KubescapeReport = {
  results: [
    {
      resourceID: "/v1/ClusterRole/system:node",
      controls: [
        {
          controlID: "C-0007",
          name: "Data Destruction",
          severity: { severity: "Critical", scoreFactor: 9 },
          status: { status: "failed" },
          rules: [
            {
              name: "rule-1",
              failedPaths: ["rules[0].verbs"],
              fixCommand: "kubectl edit clusterrole system:node",
            },
          ],
        },
      ],
    },
  ],
};

/** resources 맵에 있으나 object 없는 경우 → resourceID 파싱 폴백 */
export const RESOURCE_WITHOUT_OBJECT_REPORT: KubescapeReport = {
  resources: [
    {
      resourceID: "/v1/namespaces/default/Pod/my-pod",
      // object 없음
    },
  ],
  results: [
    {
      resourceID: "/v1/namespaces/default/Pod/my-pod",
      controls: [
        {
          controlID: "C-0016",
          name: "Privilege escalation",
          severity: { severity: "Medium", scoreFactor: 5 },
          status: { status: "failed" },
        },
      ],
    },
  ],
};
