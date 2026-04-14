/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Main Process용 LangChain Tools
 *
 * Main Process에서 직접 실행되는 Tool들입니다.
 * Renderer의 tools.ts와 다르게 IPC 호출 없이 직접 실행합니다.
 *
 * 📝 Extension Host 패턴:
 * - Renderer: IPC로 요청만 전송
 * - Main: Tool 직접 실행 (보안 강화)
 *
 * 🔄 변경이력:
 * - 2025-12-17: 초기 생성 (Extension Host 완전 마이그레이션)
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ============================================
// 🎯 Tool 실행 함수 타입
// ============================================

export interface KubectlExecuteFunction {
  (
    clusterId: string,
    command: string,
    args: string[],
    stdin?: string,
  ): Promise<{
    success: boolean;
    stdout?: string;
    stderr?: string;
  }>;
}

export interface ShellExecuteFunction {
  (
    clusterId: string,
    command: string,
  ): Promise<{
    success: boolean;
    stdout?: string;
    stderr?: string;
  }>;
}

/**
 * 🎯 Helm 실행 함수 타입
 *
 * 📝 2026-01-09: - Helm 전용 실행 함수 추가
 */
export interface HelmExecuteFunction {
  (
    clusterId: string,
    command: string,
    args: string[],
    stdin?: string,
  ): Promise<{
    success: boolean;
    stdout?: string;
    stderr?: string;
  }>;
}

// ============================================
// 🎯 HITL (Human-in-the-Loop) 설정
// ============================================

export type HitlLevel = "always_approve" | "read_only" | "allow_all";

let currentHitlLevel: HitlLevel = "always_approve";

export const setHitlLevel = (level: HitlLevel): void => {
  console.log("[MainTools] HITL level changed:", currentHitlLevel, "→", level);
  currentHitlLevel = level;
};

export const getHitlLevel = (): HitlLevel => currentHitlLevel;

// ============================================
// 🎯 Tool 응답 타입
// ============================================

export type ToolResponseStatus = "success" | "error";

export interface ToolResponse<TData = unknown> {
  status: ToolResponseStatus;
  data?: TData;
  message?: string;
  code?: string;
}

// ============================================
// 🎯 Main Tools Factory
// ============================================

export interface MainToolsDependencies {
  executeKubectl: KubectlExecuteFunction;
  executeShell: ShellExecuteFunction;
  /** 🎯 2026-01-09: - Helm 전용 실행 함수 추가 */
  executeHelm?: HelmExecuteFunction;
  getClusterId: () => string | null;
}

/**
 * 🎯 Main Process용 LangChain Tools 생성
 *
 * @param dependencies - Tool 실행에 필요한 의존성
 * @returns LangChain Tool 배열
 */
export function createMainTools(dependencies: MainToolsDependencies) {
  const { executeKubectl, executeShell, executeHelm, getClusterId } = dependencies;

  // ============================================
  // 🎯 kubectl Tool
  // ============================================

  const kubectlTool = tool(
    async (input) => {
      const { command, args, namespace, stdin } = input;
      const clusterId = getClusterId();

      if (!clusterId) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "클러스터가 연결되어 있지 않습니다. 사이드바에서 클러스터를 선택하세요.",
        });
      }

      // 🎯 namespace 옵션 추가
      const fullArgs = namespace ? [...args, "-n", namespace] : args;

      // 🎯 kubectl 실행 (stdin 전달)
      // 📝 HITL 승인은 react-loop.ts에서 처리
      const result = await executeKubectl(clusterId, command, fullArgs, stdin);

      if (result.success) {
        return JSON.stringify({
          status: "success",
          data: result.stdout,
          message: `kubectl ${command} 실행 성공`,
        });
      }

      return JSON.stringify({
        status: "error",
        code: "EXECUTION_ERROR",
        message: result.stderr || "kubectl 실행 실패",
      });
    },
    {
      name: "kubectl",
      description: `Kubernetes 클러스터에서 kubectl 명령을 실행합니다.
사용 가능한 명령: get, describe, logs, apply, create, delete, patch, scale, rollout, exec, top
예시:
- Pod 조회: command="get", args=["pods"]
- Deployment 상세: command="describe", args=["deployment", "nginx"]
- 로그 조회: command="logs", args=["pod-name", "-f"]
- YAML 적용: command="apply", args=["-f", "-"], stdin="apiVersion: v1\\nkind: Pod..."`,
      schema: z.object({
        command: z.string().describe("kubectl 명령 (get, describe, logs, apply 등)"),
        args: z.array(z.string()).describe("명령 인자 배열"),
        namespace: z.string().optional().describe("네임스페이스 (선택사항)"),
        stdin: z.string().optional().describe("stdin으로 전달할 내용 (YAML 등, kubectl apply -f - 용)"),
      }),
    },
  );

  // ============================================
  // 🎯 shell Tool
  // ============================================

  const shellTool = tool(
    async (input) => {
      const { command } = input;
      const clusterId = getClusterId();

      if (!clusterId) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "클러스터가 연결되어 있지 않습니다.",
        });
      }

      // 🎯 Shell 실행
      // 📝 HITL 승인은 react-loop.ts에서 처리
      const result = await executeShell(clusterId, command);

      if (result.success) {
        return JSON.stringify({
          status: "success",
          data: result.stdout,
          message: "Shell 명령 실행 성공",
        });
      }

      return JSON.stringify({
        status: "error",
        code: "EXECUTION_ERROR",
        message: result.stderr || "Shell 실행 실패",
      });
    },
    {
      name: "shell",
      description: `클러스터 노드에서 shell 명령을 실행합니다.
보안상 제한된 명령만 허용됩니다.
예시: ls, cat, grep, awk, sed, head, tail, wc, sort, uniq
⚠️ 파일 저장/쓰기는 이 도구로 할 수 없습니다. 파일 저장은 반드시 save_to_cluster 도구를 사용하세요.`,
      schema: z.object({
        command: z.string().describe("실행할 shell 명령"),
      }),
    },
  );

  // ============================================
  // 🎯 getPods Tool (구조화된 Pod 조회)
  // ============================================

  const getPodsTool = tool(
    async (input) => {
      const { namespace, labelSelector, allNamespaces } = input;
      const clusterId = getClusterId();

      if (!clusterId) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "클러스터가 연결되어 있지 않습니다.",
        });
      }

      const args = ["pods", "-o", "json"];
      if (allNamespaces) {
        args.push("-A");
      } else if (namespace) {
        args.push("-n", namespace);
      }
      if (labelSelector) {
        args.push("-l", labelSelector);
      }

      const result = await executeKubectl(clusterId, "get", args);

      if (result.success && result.stdout) {
        try {
          const data = JSON.parse(result.stdout);
          // 🎯 Pod 정보를 간결하게 정리
          const pods = (data.items || []).map((pod: any) => ({
            name: pod.metadata?.name,
            namespace: pod.metadata?.namespace,
            status: pod.status?.phase,
            ready: pod.status?.containerStatuses?.every((c: any) => c.ready) ? "Ready" : "NotReady",
            restarts: pod.status?.containerStatuses?.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0),
            age: pod.metadata?.creationTimestamp,
            node: pod.spec?.nodeName,
          }));

          return JSON.stringify({
            status: "success",
            data: pods,
            message: `${pods.length}개의 Pod를 찾았습니다.`,
          });
        } catch {
          return JSON.stringify({
            status: "success",
            data: result.stdout,
            message: "Pod 목록 조회 성공 (raw)",
          });
        }
      }

      return JSON.stringify({
        status: "error",
        code: "EXECUTION_ERROR",
        message: result.stderr || "Pod 조회 실패",
      });
    },
    {
      name: "getPods",
      description: `클러스터의 Pod 목록을 조회합니다. kubectl보다 구조화된 응답을 반환합니다.
예시:
- 전체 Pod: allNamespaces=true
- 특정 네임스페이스: namespace="default"
- 라벨 필터: labelSelector="app=nginx"`,
      schema: z.object({
        namespace: z.string().optional().describe("조회할 네임스페이스"),
        labelSelector: z.string().optional().describe("라벨 셀렉터 (예: app=nginx)"),
        allNamespaces: z.boolean().optional().describe("모든 네임스페이스 조회 여부"),
      }),
    },
  );

  // ============================================
  // 🎯 getDeployments Tool (구조화된 Deployment 조회)
  // ============================================

  const getDeploymentsTool = tool(
    async (input) => {
      const { namespace, allNamespaces } = input;
      const clusterId = getClusterId();

      if (!clusterId) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "클러스터가 연결되어 있지 않습니다.",
        });
      }

      const args = ["deployments", "-o", "json"];
      if (allNamespaces) {
        args.push("-A");
      } else if (namespace) {
        args.push("-n", namespace);
      }

      const result = await executeKubectl(clusterId, "get", args);

      if (result.success && result.stdout) {
        try {
          const data = JSON.parse(result.stdout);
          const deployments = (data.items || []).map((deploy: any) => ({
            name: deploy.metadata?.name,
            namespace: deploy.metadata?.namespace,
            replicas: `${deploy.status?.readyReplicas || 0}/${deploy.spec?.replicas || 0}`,
            updatedReplicas: deploy.status?.updatedReplicas,
            availableReplicas: deploy.status?.availableReplicas,
            age: deploy.metadata?.creationTimestamp,
            image: deploy.spec?.template?.spec?.containers?.[0]?.image,
          }));

          return JSON.stringify({
            status: "success",
            data: deployments,
            message: `${deployments.length}개의 Deployment를 찾았습니다.`,
          });
        } catch {
          return JSON.stringify({
            status: "success",
            data: result.stdout,
            message: "Deployment 목록 조회 성공 (raw)",
          });
        }
      }

      return JSON.stringify({
        status: "error",
        code: "EXECUTION_ERROR",
        message: result.stderr || "Deployment 조회 실패",
      });
    },
    {
      name: "getDeployments",
      description: `클러스터의 Deployment 목록을 조회합니다. 레플리카 상태와 이미지 정보를 포함합니다.`,
      schema: z.object({
        namespace: z.string().optional().describe("조회할 네임스페이스"),
        allNamespaces: z.boolean().optional().describe("모든 네임스페이스 조회 여부"),
      }),
    },
  );

  // ============================================
  // 🎯 getServices Tool (구조화된 Service 조회)
  // ============================================

  const getServicesTool = tool(
    async (input) => {
      const { namespace, allNamespaces } = input;
      const clusterId = getClusterId();

      if (!clusterId) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "클러스터가 연결되어 있지 않습니다.",
        });
      }

      const args = ["services", "-o", "json"];
      if (allNamespaces) {
        args.push("-A");
      } else if (namespace) {
        args.push("-n", namespace);
      }

      const result = await executeKubectl(clusterId, "get", args);

      if (result.success && result.stdout) {
        try {
          const data = JSON.parse(result.stdout);
          const services = (data.items || []).map((svc: any) => ({
            name: svc.metadata?.name,
            namespace: svc.metadata?.namespace,
            type: svc.spec?.type,
            clusterIP: svc.spec?.clusterIP,
            externalIP: svc.status?.loadBalancer?.ingress?.[0]?.ip || svc.spec?.externalIPs?.[0] || "None",
            ports: svc.spec?.ports?.map((p: any) => `${p.port}/${p.protocol}`).join(", "),
            age: svc.metadata?.creationTimestamp,
          }));

          return JSON.stringify({
            status: "success",
            data: services,
            message: `${services.length}개의 Service를 찾았습니다.`,
          });
        } catch {
          return JSON.stringify({
            status: "success",
            data: result.stdout,
            message: "Service 목록 조회 성공 (raw)",
          });
        }
      }

      return JSON.stringify({
        status: "error",
        code: "EXECUTION_ERROR",
        message: result.stderr || "Service 조회 실패",
      });
    },
    {
      name: "getServices",
      description: `클러스터의 Service 목록을 조회합니다. 타입, IP, 포트 정보를 포함합니다.`,
      schema: z.object({
        namespace: z.string().optional().describe("조회할 네임스페이스"),
        allNamespaces: z.boolean().optional().describe("모든 네임스페이스 조회 여부"),
      }),
    },
  );

  // ============================================
  // 🎯 getLogs Tool (Pod 로그 조회)
  // ============================================

  const getLogsTool = tool(
    async (input) => {
      const { podName, namespace, container, tailLines, since } = input;
      const clusterId = getClusterId();

      if (!clusterId) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "클러스터가 연결되어 있지 않습니다.",
        });
      }

      const args = [podName];
      if (namespace) {
        args.push("-n", namespace);
      }
      if (container) {
        args.push("-c", container);
      }
      if (tailLines) {
        args.push("--tail", String(tailLines));
      }
      if (since) {
        args.push("--since", since);
      }

      const result = await executeKubectl(clusterId, "logs", args);

      if (result.success) {
        return JSON.stringify({
          status: "success",
          data: result.stdout,
          message: `Pod ${podName} 로그 조회 성공`,
        });
      }

      return JSON.stringify({
        status: "error",
        code: "EXECUTION_ERROR",
        message: result.stderr || "로그 조회 실패",
      });
    },
    {
      name: "getLogs",
      description: `Pod의 로그를 조회합니다.
예시:
- 최근 100줄: tailLines=100
- 최근 1시간: since="1h"
- 특정 컨테이너: container="nginx"`,
      schema: z.object({
        podName: z.string().describe("로그를 조회할 Pod 이름"),
        namespace: z.string().optional().describe("Pod의 네임스페이스"),
        container: z.string().optional().describe("특정 컨테이너 이름 (multi-container pod)"),
        tailLines: z.number().optional().describe("마지막 N줄만 조회"),
        since: z.string().optional().describe("시간 범위 (예: 1h, 30m, 1d)"),
      }),
    },
  );

  // ============================================
  // 🎯 describeResource Tool (리소스 상세 조회)
  // ============================================

  const describeResourceTool = tool(
    async (input) => {
      const { resourceType, resourceName, namespace } = input;
      const clusterId = getClusterId();

      if (!clusterId) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "클러스터가 연결되어 있지 않습니다.",
        });
      }

      const args = [resourceType, resourceName];
      if (namespace) {
        args.push("-n", namespace);
      }

      const result = await executeKubectl(clusterId, "describe", args);

      if (result.success) {
        return JSON.stringify({
          status: "success",
          data: result.stdout,
          message: `${resourceType}/${resourceName} 상세 조회 성공`,
        });
      }

      return JSON.stringify({
        status: "error",
        code: "EXECUTION_ERROR",
        message: result.stderr || "리소스 상세 조회 실패",
      });
    },
    {
      name: "describeResource",
      description: `Kubernetes 리소스의 상세 정보를 조회합니다.
예시:
- Pod 상세: resourceType="pod", resourceName="nginx-abc123"
- Node 상세: resourceType="node", resourceName="worker-1"
- Deployment 상세: resourceType="deployment", resourceName="nginx"`,
      schema: z.object({
        resourceType: z.string().describe("리소스 타입 (pod, node, deployment, service 등)"),
        resourceName: z.string().describe("리소스 이름"),
        namespace: z.string().optional().describe("네임스페이스 (namespace-scoped 리소스인 경우)"),
      }),
    },
  );

  // ============================================
  // 🎯 getNodes Tool (노드 목록 조회)
  // ============================================

  const getNodesTool = tool(
    async () => {
      const clusterId = getClusterId();

      if (!clusterId) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "클러스터가 연결되어 있지 않습니다.",
        });
      }

      const result = await executeKubectl(clusterId, "get", ["nodes", "-o", "json"]);

      if (result.success && result.stdout) {
        try {
          const data = JSON.parse(result.stdout);
          const nodes = (data.items || []).map((node: any) => {
            const conditions = node.status?.conditions || [];
            const readyCondition = conditions.find((c: any) => c.type === "Ready");
            return {
              name: node.metadata?.name,
              status: readyCondition?.status === "True" ? "Ready" : "NotReady",
              roles:
                Object.keys(node.metadata?.labels || {})
                  .filter((l) => l.startsWith("node-role.kubernetes.io/"))
                  .map((l) => l.replace("node-role.kubernetes.io/", ""))
                  .join(", ") || "worker",
              age: node.metadata?.creationTimestamp,
              version: node.status?.nodeInfo?.kubeletVersion,
              internalIP: node.status?.addresses?.find((a: any) => a.type === "InternalIP")?.address,
              os: node.status?.nodeInfo?.osImage,
            };
          });

          return JSON.stringify({
            status: "success",
            data: nodes,
            message: `${nodes.length}개의 노드를 찾았습니다.`,
          });
        } catch {
          return JSON.stringify({
            status: "success",
            data: result.stdout,
            message: "노드 목록 조회 성공 (raw)",
          });
        }
      }

      return JSON.stringify({
        status: "error",
        code: "EXECUTION_ERROR",
        message: result.stderr || "노드 조회 실패",
      });
    },
    {
      name: "getNodes",
      description: `클러스터의 모든 노드를 조회합니다. 상태, 역할, 버전, IP 정보를 포함합니다.`,
      schema: z.object({}),
    },
  );

  // ============================================
  // 🎯 getNamespaces Tool (네임스페이스 목록 조회)
  // ============================================

  const getNamespacesTool = tool(
    async () => {
      const clusterId = getClusterId();

      if (!clusterId) {
        return JSON.stringify({
          status: "error",
          code: "NO_CLUSTER",
          message: "클러스터가 연결되어 있지 않습니다.",
        });
      }

      const result = await executeKubectl(clusterId, "get", ["namespaces", "-o", "json"]);

      if (result.success && result.stdout) {
        try {
          const data = JSON.parse(result.stdout);
          const namespaces = (data.items || []).map((ns: any) => ({
            name: ns.metadata?.name,
            status: ns.status?.phase,
            age: ns.metadata?.creationTimestamp,
          }));

          return JSON.stringify({
            status: "success",
            data: namespaces,
            message: `${namespaces.length}개의 네임스페이스를 찾았습니다.`,
          });
        } catch {
          return JSON.stringify({
            status: "success",
            data: result.stdout,
            message: "네임스페이스 목록 조회 성공 (raw)",
          });
        }
      }

      return JSON.stringify({
        status: "error",
        code: "EXECUTION_ERROR",
        message: result.stderr || "네임스페이스 조회 실패",
      });
    },
    {
      name: "getNamespaces",
      description: `클러스터의 모든 네임스페이스를 조회합니다.`,
      schema: z.object({}),
    },
  );

  // ============================================
  // 🎯 helm Tool (2026-01-09:)
  // ============================================

  /**
   * 🎯 Helm Tool - Helm 명령 실행
   *
   * 📝 주의사항:
   * - 화이트리스트 기반 명령 검증 (executeHelm 내부에서 처리)
   * - 쓰기 명령(install, upgrade, uninstall 등)은 HITL 승인 필요
   * - 로컬 시스템에 설치된 Helm CLI 사용
   */
  const helmTool = executeHelm
    ? tool(
        async (input) => {
          const { command, args, namespace, stdin } = input;
          const clusterId = getClusterId();

          if (!clusterId) {
            return JSON.stringify({
              status: "error",
              code: "NO_CLUSTER",
              message: "클러스터가 연결되어 있지 않습니다. 사이드바에서 클러스터를 선택하세요.",
            });
          }

          // 🎯 namespace 옵션 추가 (자동)
          const fullArgs = namespace ? [...args, "-n", namespace] : args;

          // 🎯 Helm 실행
          // 📝 HITL 승인은 react-loop.ts에서 처리
          const result = await executeHelm(clusterId, command, fullArgs, stdin);

          if (result.success) {
            return JSON.stringify({
              status: "success",
              data: result.stdout,
              message: `helm ${command} 실행 성공`,
            });
          }

          return JSON.stringify({
            status: "error",
            code: "EXECUTION_ERROR",
            message: result.stderr || "Helm 실행 실패",
          });
        },
        {
          name: "helm",
          description: `Helm CLI를 사용하여 차트와 릴리즈를 관리합니다.
사용 가능한 명령:
- 읽기 (14개): list, get, history, status, show, search, repo, env, version, template, lint, dependency, pull, create
- 쓰기 (6개): install, upgrade, uninstall, rollback, test, push

예시:
- 릴리즈 목록: command="list", args=["-A"]
- 릴리즈 상태: command="status", args=["nginx-release"]
- 차트 설치: command="install", args=["my-release", "bitnami/nginx"]
- 릴리즈 업그레이드: command="upgrade", args=["my-release", "bitnami/nginx"]
- 리포지토리 추가: command="repo", args=["add", "bitnami", "https://charts.bitnami.com/bitnami"]
- 리포지토리 목록: command="repo", args=["list"]
- values 파일로 설치: command="install", args=["my-release", "bitnami/nginx", "-f", "-"], stdin="replicaCount: 3"

⚠️ Helm 관련 질문에는 반드시 이 도구를 사용하세요. kubectl 대신 helm 명령을 사용해야 정확한 정보를 얻을 수 있습니다.`,
          schema: z.object({
            command: z.string().describe("Helm 명령 (list, install, upgrade, status 등)"),
            args: z.array(z.string()).describe("명령 인자 배열"),
            namespace: z.string().optional().describe("네임스페이스 (선택사항)"),
            stdin: z.string().optional().describe("stdin으로 전달할 내용 (values.yaml 등, helm install -f - 용)"),
          }),
        },
      )
    : null;

  // ============================================
  // 🎯 모든 Tools 반환
  // ============================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- LangChain 1.1.39 DynamicStructuredTool 제네릭 변경으로 인한 타입 불일치 우회
  const tools: any[] = [
    // 범용 Tools
    kubectlTool,
    shellTool,
    // 구조화된 조회 Tools
    getPodsTool,
    getDeploymentsTool,
    getServicesTool,
    getLogsTool,
    describeResourceTool,
    getNodesTool,
    getNamespacesTool,
  ];

  // 🎯 2026-01-09: - Helm Tool 추가 (executeHelm이 있을 때만)
  if (helmTool) {
    tools.push(helmTool);
  }

  return tools;
}

// ============================================
// 🎯 Tool 설명 (Agent에게 제공)
// ============================================

export const toolFunctionDescriptions = `
## Available Tools

### 범용 Tools
- **kubectl**: Kubernetes 클러스터에서 kubectl 명령을 직접 실행합니다.
- **shell**: 로컬 시스템에서 shell 명령을 실행합니다 (보안 제한).
- **helm**: Helm CLI를 사용하여 차트와 릴리즈를 관리합니다 (🆕 2026-01-09).

### 구조화된 조회 Tools (권장)
- **getPods**: Pod 목록을 구조화된 형태로 조회합니다.
- **getDeployments**: Deployment 목록을 조회합니다.
- **getServices**: Service 목록을 조회합니다.
- **getLogs**: Pod 로그를 조회합니다.
- **describeResource**: 리소스의 상세 정보를 조회합니다.
- **getNodes**: 클러스터 노드 목록을 조회합니다.
- **getNamespaces**: 네임스페이스 목록을 조회합니다.

### 파일 관리 Tools
- **save_to_cluster**: 보고서, 매니페스트, 계획서 등을 클러스터 전용 폴더에 저장합니다. 파일 저장 시 반드시 이 도구를 사용하세요.
- **read_file**: 클러스터 폴더에서 기존 문서를 읽습니다.

📝 Tips:
- 간단한 조회는 구조화된 Tools (getPods, getDeployments 등) 사용 권장
- 복잡한 작업이나 특수한 명령은 kubectl Tool 사용
- 쓰기 작업(create, delete, apply 등)은 kubectl Tool 사용
- ⚠️ Helm 관련 질문(릴리즈, 차트, 리포지토리 등)에는 반드시 helm Tool 사용!
- ⚠️ 파일 저장은 반드시 save_to_cluster 사용! shell이나 kubectl로 파일을 쓰지 마세요.
`;
