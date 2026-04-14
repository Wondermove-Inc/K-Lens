/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Pod Status Polling IPC handler (Main Process)
 *
 * Handles `security:fix:pod-status-poll` channel requests from the Renderer.
 * Runs `kubectl get pods -n <ns>` for each requested namespace and parses
 * the output into structured PodStatusItem + PodStatusSummary.
 *
 * @packageDocumentation
 */

import { loggerInjectionToken } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import execFileInjectable from "../../../common/fs/exec-file.injectable";
import kubeconfigManagerInjectable from "../../../main/kubeconfig-manager/kubeconfig-manager.injectable";
import createKubectlInjectable from "../../../main/kubectl/create-kubectl.injectable";
import getClusterByIdInjectable from "../../cluster/storage/common/get-by-id.injectable";
import {
  type PodStatusItem,
  type PodStatusSummary,
  securityPodStatusPollChannel,
} from "../common/security-fix-channels";

// ============================================
// kubectl get pods 출력 파서
// ============================================

/**
 * `kubectl get pods -A --no-headers` 또는 `-n <ns> --no-headers` 출력 파싱.
 *
 * 컬럼 포맷 (--no-headers):
 *   [NAMESPACE]  NAME   READY   STATUS   RESTARTS   AGE
 *   (namespace col은 -A 옵션일 때만 있음)
 */
function parsePodLines(output: string, defaultNamespace: string): PodStatusItem[] {
  const pods: PodStatusItem[] = [];
  for (const line of output.split("\n")) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 4) continue;

    // -A 옵션: 첫 컬럼이 namespace
    // -n <ns> 옵션: 첫 컬럼이 NAME
    // 컬럼 수로 구분: -A → 6+, -n → 5+
    let namespace: string;
    let name: string;
    let ready: string;
    let status: string;
    let restarts: string;
    let age: string;

    if (cols.length >= 6) {
      // -A 포맷: namespace name ready status restarts age
      [namespace, name, ready, status, restarts, age] = cols;
    } else {
      // -n <ns> 포맷: name ready status restarts age
      namespace = defaultNamespace;
      [name, ready, status, restarts, age] = cols;
    }

    if (!name || name === "NAME") continue; // 헤더 스킵

    // restarts 파싱 — "3 (2h ago)" 형태도 처리
    const restartNum = parseInt(restarts ?? "0", 10);

    pods.push({
      name: name ?? "",
      namespace: namespace ?? defaultNamespace,
      ready: ready ?? "0/0",
      status: status ?? "Unknown",
      restarts: isNaN(restartNum) ? 0 : restartNum,
      age: age ?? "",
    });
  }
  return pods;
}

function buildSummary(pods: PodStatusItem[]): PodStatusSummary {
  const summary: PodStatusSummary = { total: pods.length, ready: 0, notReady: 0, crashLoop: 0, pending: 0, unknown: 0 };
  for (const pod of pods) {
    const st = pod.status.toLowerCase();
    if (st.includes("crashloop")) {
      summary.crashLoop++;
    } else if (st === "running") {
      // "2/2" 형태 파싱
      const [cur, tot] = pod.ready.split("/").map(Number);
      if (!isNaN(cur) && !isNaN(tot) && cur === tot && tot > 0) {
        summary.ready++;
      } else {
        summary.notReady++;
      }
    } else if (st === "pending" || st === "containercreating" || st === "init:0/1") {
      summary.pending++;
    } else if (
      st.includes("terminating") ||
      st.includes("error") ||
      st.includes("oomkilled") ||
      st.includes("completed")
    ) {
      summary.notReady++;
    } else {
      summary.unknown++;
    }
  }
  return summary;
}

// ============================================
// IPC Handler
// ============================================

export const podStatusPollHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-pod-status-poll-handler",
  channel: securityPodStatusPollChannel,
  getHandler: (di) => {
    const getClusterById = di.inject(getClusterByIdInjectable);
    const createKubectl = di.inject(createKubectlInjectable);
    const execFile = di.inject(execFileInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (request) => {
      const { clusterId, namespaces, labelSelector } = request;
      const fetchedAt = new Date().toISOString();

      const cluster = getClusterById(clusterId);
      if (!cluster) {
        return {
          pods: [],
          summary: { total: 0, ready: 0, notReady: 0, crashLoop: 0, pending: 0, unknown: 0 },
          fetchedAt,
          error: `Cluster not found: ${clusterId}`,
        };
      }

      try {
        const kubectl = createKubectl(cluster.version.get());
        const kubectlPath = await kubectl.getPath();
        const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
        const kubeconfigPath = await kubeconfigManager.ensurePath();

        const allPods: PodStatusItem[] = [];

        if (namespaces.length === 0) {
          // 전체 namespace
          const args = ["get", "pods", "-A", "--no-headers", "--kubeconfig", kubeconfigPath];
          if (labelSelector) args.push("-l", labelSelector);
          const result = await execFile(kubectlPath, args);
          if (result.callWasSuccessful) {
            allPods.push(...parsePodLines(result.response, "default"));
          } else {
            logger.warn(`[PodStatusPoll] kubectl get pods -A failed: ${result.error?.message ?? "unknown"}`);
          }
        } else {
          // 지정된 namespace들만 순회
          for (const ns of namespaces) {
            const args = ["get", "pods", "-n", ns, "--no-headers", "--kubeconfig", kubeconfigPath];
            if (labelSelector) args.push("-l", labelSelector);
            const result = await execFile(kubectlPath, args);
            if (result.callWasSuccessful) {
              allPods.push(...parsePodLines(result.response, ns));
            } else {
              logger.warn(`[PodStatusPoll] kubectl get pods -n ${ns} failed: ${result.error?.message ?? "unknown"}`);
            }
          }
        }

        const summary = buildSummary(allPods);
        logger.debug(
          `[PodStatusPoll] clusterId=${clusterId} total=${summary.total} ready=${summary.ready} crash=${summary.crashLoop}`,
        );
        return { pods: allPods, summary, fetchedAt };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[PodStatusPoll] unexpected error: ${msg}`);
        return {
          pods: [],
          summary: { total: 0, ready: 0, notReady: 0, crashLoop: 0, pending: 0, unknown: 0 },
          fetchedAt,
          error: msg,
        };
      }
    };
  },
});

export default podStatusPollHandlerInjectable;
