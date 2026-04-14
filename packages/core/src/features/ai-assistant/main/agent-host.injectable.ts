/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Agent Host DI 등록
 *
 * Main Process에서 Agent Host를 DI 컨테이너에 등록합니다.
 *
 * 📝 의존성:
 * - LLMModelFactory: LLM 모델 생성
 * - Logger: 로깅
 * - kubectl/shell 실행 함수
 *
 * 🔄 변경이력:
 * - 2025-12-16: 초기 생성 (Phase 2 Extension Host 패턴)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import { spawn } from "child_process";
import pLimit from "p-limit";

// 🎯 macOS fd 제한(256) 대응: 동시 프로세스 실행 제한
// kubectl/helm spawn 시 fd 고갈로 인한 EBADF 방지
// 2026-01-31: 연구 기반 pLimit(2) → pLimit(5) 상향 (macOS spawn 병목 40/s로 성능 영향 미미)
const processLimit = pLimit(5);

import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import execFileInjectable from "../../../common/fs/exec-file.injectable";
import kubeconfigManagerInjectable from "../../../main/kubeconfig-manager/kubeconfig-manager.injectable";
import createKubectlInjectable from "../../../main/kubectl/create-kubectl.injectable";
import getClusterByIdInjectable from "../../cluster/storage/common/get-by-id.injectable";
import { setUserOverrideDir } from "../agents/md-loader";
// 🎯 2026-01-09: - Helm 화이트리스트 검증 import
import { hasDangerousHelmFlags, isAllowedHelmCommand } from "../common/helm-execute-channel";
import { hasDangerousKubectlFlags, isAllowedKubectlCommand } from "../common/kubectl-execute-channel";
import agentRegistryInjectable from "./agent/agent-registry.injectable";
import { AgentHost, type AgentHostDependencies } from "./agent-host";
import conversationLoggerInjectable from "./conversation-logger.injectable";
import llmModelFactoryInjectable from "./llm-model-factory.injectable";
import agentSessionManagerInjectable from "./session/agent-session-manager.injectable";
import skillRouterInjectable from "./skills/skill-router.injectable";
import profileExtractorInjectable from "./user-profile/profile-extractor.injectable";
import userProfileStoreInjectable from "./user-profile/user-profile-store.injectable";

/**
 * 🎯 Agent Host Injectable
 *
 * Main Process 전용 Agent Host 싱글톤 인스턴스
 *
 * 📝 의존성:
 * - llmModelFactory: LLM 모델 생성
 * - sessionManager: HITL 세션 관리
 * - kubectl/shell 실행 함수
 */
const agentHostInjectable = getInjectable({
  id: "ai-assistant-agent-host",
  instantiate: async (di) => {
    const llmModelFactory = di.inject(llmModelFactoryInjectable);
    const logger = di.inject(loggerInjectionToken);
    const getClusterById = di.inject(getClusterByIdInjectable);
    const execFile = di.inject(execFileInjectable);
    const createKubectl = di.inject(createKubectlInjectable);

    // 🎯 Session Manager 주입
    const sessionManager = await di.inject(agentSessionManagerInjectable);

    // 🎯 ConversationLogger 주입 (파일 기반 대화 저장)
    const conversationLogger = await di.inject(conversationLoggerInjectable);

    /**
     * 🎯 stdin을 지원하는 kubectl 실행 헬퍼
     *
     * @param kubectlPath - kubectl 바이너리 경로
     * @param args - 명령 인자
     * @param stdin - stdin으로 전달할 내용 (선택사항)
     * @returns Promise<{ stdout: string; stderr: string; exitCode: number }>
     */
    const executeWithStdin = (
      kubectlPath: string,
      args: string[],
      stdin?: string,
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
      return new Promise((resolve) => {
        const proc = spawn(kubectlPath, args);

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        proc.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        proc.on("error", (error) => {
          resolve({ stdout: "", stderr: error.message, exitCode: 1 });
        });

        // 🎯 stdin이 있으면 파이프로 전달
        if (stdin) {
          proc.stdin.write(stdin);
          proc.stdin.end();
        } else {
          proc.stdin.end();
        }
      });
    };

    // 🎯 kubectl 실행 헬퍼
    // 📝 processLimit으로 동시 실행 제한 (macOS fd 제한 대응)
    const executeKubectl = async (
      clusterId: string,
      command: string,
      args: string[],
      stdin?: string,
    ): Promise<{ success: boolean; stdout?: string; stderr?: string }> => {
      // Whitelist 검증 (limit 외부에서 수행 - 빠른 실패)
      if (!isAllowedKubectlCommand(command)) {
        return {
          success: false,
          stderr: `허용되지 않은 kubectl 명령입니다: ${command}`,
        };
      }

      // 위험 플래그 검증
      if (hasDangerousKubectlFlags(args)) {
        return {
          success: false,
          stderr: "보안상 위험한 플래그가 포함되어 있습니다",
        };
      }

      // 클러스터 확인
      const cluster = getClusterById(clusterId);
      if (!cluster) {
        return {
          success: false,
          stderr: `클러스터를 찾을 수 없습니다: ${clusterId}`,
        };
      }

      // 🎯 processLimit으로 동시 프로세스 실행 제한 (macOS EBADF 방지)
      return processLimit(async () => {
        try {
          const kubectl = createKubectl(cluster.version.get());
          const kubectlPath = await kubectl.getPath();
          const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
          const proxyKubeconfigPath = await kubeconfigManager.ensurePath();

          const fullArgs = [command, ...args, "--kubeconfig", proxyKubeconfigPath];

          // 🎯 stdin이 있으면 spawn 사용, 없으면 기존 execFile 사용
          if (stdin) {
            logger.debug(`[AgentHost] kubectl stdin 모드로 실행 (${stdin.length} bytes)`);
            const spawnResult = await executeWithStdin(kubectlPath, fullArgs, stdin);
            if (spawnResult.exitCode === 0) {
              trackWorkspaceContext(command, args, undefined, clusterId);
            }
            return {
              success: spawnResult.exitCode === 0,
              stdout: spawnResult.stdout,
              stderr: spawnResult.stderr || undefined,
            };
          }

          // 기존 execFile 방식 (stdin 없는 경우)
          const result = await execFile(kubectlPath, fullArgs);

          if (result.callWasSuccessful) {
            trackWorkspaceContext(command, args, undefined, clusterId);
            return {
              success: true,
              stdout: result.response,
            };
          }

          return {
            success: false,
            stderr: result.error.stderr || result.error.message,
          };
        } catch (error) {
          return {
            success: false,
            stderr: error instanceof Error ? error.message : "알 수 없는 오류",
          };
        }
      });
    };

    // 🎯 kubectl 실행 시 워크스페이스 컨텍스트 자동 수집
    const RESOURCE_COMMANDS = new Set(["get", "describe", "logs", "top"]);
    const RESOURCE_TYPES = new Set([
      "pods",
      "pod",
      "po",
      "deployments",
      "deployment",
      "deploy",
      "services",
      "service",
      "svc",
      "statefulsets",
      "statefulset",
      "sts",
      "daemonsets",
      "daemonset",
      "ds",
      "jobs",
      "job",
      "cronjobs",
      "cronjob",
      "cj",
      "ingress",
      "ing",
      "configmaps",
      "configmap",
      "cm",
      "secrets",
      "secret",
      "nodes",
      "node",
      "no",
      "namespaces",
      "namespace",
      "ns",
      "pv",
      "pvc",
      "events",
      "ev",
      "hpa",
      "networkpolicies",
      "netpol",
      "endpoints",
      "ep",
      "replicasets",
      "replicaset",
      "rs",
    ]);
    const RESOURCE_NORMALIZE: Record<string, string> = {
      pod: "pods",
      po: "pods",
      deploy: "deployments",
      deployment: "deployments",
      svc: "services",
      service: "services",
      sts: "statefulsets",
      statefulset: "statefulsets",
      ds: "daemonsets",
      daemonset: "daemonsets",
      job: "jobs",
      cj: "cronjobs",
      cronjob: "cronjobs",
      ing: "ingress",
      cm: "configmaps",
      configmap: "configmaps",
      secret: "secrets",
      node: "nodes",
      no: "nodes",
      ns: "namespaces",
      namespace: "namespaces",
      ev: "events",
      netpol: "networkpolicies",
      ep: "endpoints",
      rs: "replicasets",
      replicaset: "replicasets",
    };

    const trackWorkspaceContext = (command: string, args: string[], namespace?: string, clusterId?: string) => {
      try {
        const profileStore = di.inject(userProfileStoreInjectable);
        if (!RESOURCE_COMMANDS.has(command)) return;

        // Track namespace
        if (namespace) {
          profileStore.recordNamespaceAccess(namespace, clusterId).catch(() => {});
        } else {
          const nsIdx = args.indexOf("-n");
          const nsIdx2 = args.indexOf("--namespace");
          const idx = nsIdx >= 0 ? nsIdx : nsIdx2;
          if (idx >= 0 && idx + 1 < args.length) {
            profileStore.recordNamespaceAccess(args[idx + 1], clusterId).catch(() => {});
          }
        }

        // Track resource type
        const resourceArg = args.find((a) => RESOURCE_TYPES.has(a.toLowerCase()));
        if (resourceArg) {
          const normalized = RESOURCE_NORMALIZE[resourceArg.toLowerCase()] || resourceArg.toLowerCase();
          profileStore.recordResourceTypeAccess(normalized, clusterId).catch(() => {});
        }
      } catch {
        // Fire-and-forget: never block kubectl execution
      }
    };

    // 🎯 shell 실행 헬퍼
    // 📝 보안: Whitelist 기반으로 허용된 명령만 실행
    // 🆕 K8s CLI 도구 추가 (shell-execute-channel.ts와 일치)
    const ALLOWED_SHELL_COMMANDS = [
      // 기본 shell 명령어
      "ls",
      "cat",
      "head",
      "tail",
      "grep",
      "awk",
      "sed",
      "wc",
      "sort",
      "uniq",
      "find",
      "xargs",
      "echo",
      "date",
      "df",
      "du",
      "free",
      "top",
      "ps",
      "whoami",
      "pwd",
      // 🆕 K8s CLI 도구
      "stern", // 다중 Pod 로그 스트리밍
      "helm", // Helm 차트 관리
      "kubectx", // 컨텍스트 전환
      "kubens", // 네임스페이스 전환
      "k9s", // Kubernetes CLI 대시보드
      "kustomize", // Kustomize 빌드
      "jq", // JSON 처리
      "yq", // YAML 처리
      // 네트워크 진단
      "ping", // 네트워크 연결 확인
      "traceroute", // 네트워크 경로 추적
      "nslookup", // DNS 조회
      "dig", // DNS 디버깅
      "host", // DNS 조회
    ];

    const executeShell = async (
      clusterId: string,
      command: string,
    ): Promise<{ success: boolean; stdout?: string; stderr?: string }> => {
      // 🎯 명령어 파싱 (첫 번째 단어가 실제 명령)
      const parts = command.trim().split(/\s+/);
      const baseCommand = parts[0];

      if (!baseCommand) {
        return {
          success: false,
          stderr: "빈 명령입니다",
        };
      }

      // 🎯 Whitelist 검증
      if (!ALLOWED_SHELL_COMMANDS.includes(baseCommand)) {
        return {
          success: false,
          stderr: `허용되지 않은 shell 명령입니다: ${baseCommand}. 허용 목록: ${ALLOWED_SHELL_COMMANDS.join(", ")}`,
        };
      }

      // 🎯 위험 패턴 검증
      const dangerousPatterns = [
        /[;&|`$]/, // 명령 체이닝, 변수 확장
        /\.\.\//, // 상위 디렉토리 접근
        /rm\s/, // 삭제 명령 (추가 안전장치)
        />\s*\//, // 루트로 리다이렉션
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(command)) {
          return {
            success: false,
            stderr:
              "보안상 위험한 패턴이 포함되어 있습니다. " +
              "파일을 저장하려면 shell 명령(echo, cat, >) 대신 save_to_cluster 도구를 사용하세요. " +
              "save_to_cluster(filename, folderType, content)를 호출하면 안전하게 파일을 저장할 수 있습니다.",
          };
        }
      }

      // 🎯 processLimit으로 동시 프로세스 실행 제한 (macOS EBADF 방지)
      return processLimit(async () => {
        try {
          // 🎯 Node.js child_process로 실행
          const { exec } = await import("child_process");
          const { promisify } = await import("util");
          const execAsync = promisify(exec);

          const result = await execAsync(command, {
            timeout: 30000, // 30초 타임아웃
            maxBuffer: 1024 * 1024, // 1MB 버퍼
          });

          return {
            success: true,
            stdout: result.stdout,
            stderr: result.stderr || undefined,
          };
        } catch (error: any) {
          logger.error("[AgentHost] Shell 실행 실패:", error);
          return {
            success: false,
            stderr: error.stderr || error.message || "Shell 실행 실패",
          };
        }
      });
    };

    // ============================================
    // 🎯 Helm 실행 헬퍼 (2026-01-09:)
    // ============================================

    /**
     * 🎯 Helm 명령 실행 (stdin 지원)
     *
     * @param helmPath - Helm 실행 파일 경로
     * @param args - 명령 인자
     * @param stdin - stdin으로 전달할 내용 (선택사항)
     * @returns Promise<{ stdout: string; stderr: string; exitCode: number }>
     */
    const executeHelmWithStdin = (
      helmPath: string,
      args: string[],
      stdin?: string,
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
      return new Promise((resolve) => {
        const proc = spawn(helmPath, args);

        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        proc.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          resolve({ stdout, stderr, exitCode: code ?? 0 });
        });

        proc.on("error", (error) => {
          resolve({ stdout: "", stderr: error.message, exitCode: 1 });
        });

        if (stdin) {
          proc.stdin.write(stdin);
          proc.stdin.end();
        } else {
          proc.stdin.end();
        }
      });
    };

    /**
     * 🎯 Helm 설치 확인
     */
    const isHelmInstalled = async (): Promise<boolean> => {
      try {
        const { execFile: nodeExecFile } = await import("child_process");
        const { promisify } = await import("util");
        const execFileAsync = promisify(nodeExecFile);
        await execFileAsync("which", ["helm"]);
        return true;
      } catch {
        return false;
      }
    };

    /**
     * 🎯 Helm 실행 헬퍼
     *
     * 📝 Main Process에서 직접 Helm 실행
     * - 화이트리스트 기반 명령 검증
     * - 위험 플래그 검증
     * - 클러스터별 kubeconfig 자동 설정
     */
    const executeHelm = async (
      clusterId: string,
      command: string,
      args: string[],
      stdin?: string,
    ): Promise<{ success: boolean; stdout?: string; stderr?: string }> => {
      // 1. Helm 설치 확인
      if (!(await isHelmInstalled())) {
        return {
          success: false,
          stderr: "Helm이 설치되지 않았습니다. 설치 방법: brew install helm (macOS) / apt install helm (Linux)",
        };
      }

      // 2. Whitelist 검증
      if (!isAllowedHelmCommand(command)) {
        return {
          success: false,
          stderr: `허용되지 않은 Helm 명령입니다: ${command}`,
        };
      }

      // 3. 위험 플래그 검증
      if (hasDangerousHelmFlags(args)) {
        return {
          success: false,
          stderr: "보안상 위험한 플래그가 포함되어 있습니다 (--kubeconfig, --kube-context, --post-renderer)",
        };
      }

      // 4. 클러스터 확인
      const cluster = getClusterById(clusterId);
      if (!cluster) {
        return {
          success: false,
          stderr: `클러스터를 찾을 수 없습니다: ${clusterId}`,
        };
      }

      // 🎯 processLimit으로 동시 프로세스 실행 제한 (macOS EBADF 방지)
      return processLimit(async () => {
        try {
          // 5. kubeconfig 경로 획득
          const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
          const proxyKubeconfigPath = await kubeconfigManager.ensurePath();

          // 6. Helm 실행 (--kubeconfig 플래그 자동 추가)
          const fullArgs = [command, ...args, "--kubeconfig", proxyKubeconfigPath];
          logger.debug(`[AgentHost] Helm 실행: helm ${fullArgs.join(" ")}`);

          const result = await executeHelmWithStdin("helm", fullArgs, stdin);

          return {
            success: result.exitCode === 0,
            stdout: result.stdout,
            stderr: result.stderr || undefined,
          };
        } catch (error) {
          logger.error("[AgentHost] Helm 실행 오류:", error);
          return {
            success: false,
            stderr: error instanceof Error ? error.message : "알 수 없는 오류",
          };
        }
      });
    };

    // Agent Registry (sync injectable)
    const agentRegistry = di.inject(agentRegistryInjectable);

    // Skill Router (async — loads custom skills from disk)
    const skillRouter = await di.inject(skillRouterInjectable);

    // 🎯 유저 프로필 개인화 의존성
    const userProfileStore = di.inject(userProfileStoreInjectable);
    const profileExtractor = di.inject(profileExtractorInjectable);

    // 🎯 MD 사용자 오버라이드 디렉토리 설정
    const userDataDir = di.inject(directoryForUserDataInjectable);
    setUserOverrideDir(userDataDir);

    const dependencies: AgentHostDependencies = {
      llmModelFactory,
      logger,
      sessionManager,
      conversationLogger,
      executeKubectl,
      executeShell,
      executeHelm,
      agentRegistry,
      skillRouter,
      userProfileStore,
      profileExtractor,
    };

    logger.info("[AgentHost] Agent Host 초기화 완료 (ReAct Loop Agent)");

    return new AgentHost(dependencies);
  },
});

export default agentHostInjectable;
