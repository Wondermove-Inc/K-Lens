/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Rollback Log Collection IPC handler (Main Process)
 *
 * 롤백 발생 시 에러 로그를 수집하여 Renderer에 반환.
 * - kubectl logs --tail=N (crashloop/oomkilled 파드)
 * - kubectl get events -n <ns> --sort-by='.lastTimestamp'
 *
 * @packageDocumentation
 */

import { loggerInjectionToken } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import execFileInjectable from "../../../common/fs/exec-file.injectable";
import kubeconfigManagerInjectable from "../../../main/kubeconfig-manager/kubeconfig-manager.injectable";
import createKubectlInjectable from "../../../main/kubectl/create-kubectl.injectable";
import getClusterByIdInjectable from "../../cluster/storage/common/get-by-id.injectable";
import { type PodLogSnapshot, securityRollbackLogChannel } from "../common/security-fix-channels";

export const rollbackLogHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-rollback-log-handler",
  channel: securityRollbackLogChannel,
  getHandler: (di) => {
    const getClusterById = di.inject(getClusterByIdInjectable);
    const createKubectl = di.inject(createKubectlInjectable);
    const execFile = di.inject(execFileInjectable);
    const logger = di.inject(loggerInjectionToken);

    return async (request) => {
      const { clusterId, namespaces, logTailLines = 50 } = request;
      const collectedAt = new Date().toISOString();

      const cluster = getClusterById(clusterId);
      if (!cluster) {
        return { snapshots: [], collectedAt, error: `Cluster not found: ${clusterId}` };
      }

      try {
        const kubectl = createKubectl(cluster.version.get());
        const kubectlPath = await kubectl.getPath();
        const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
        const kubeconfigPath = await kubeconfigManager.ensurePath();

        const snapshots: PodLogSnapshot[] = [];

        for (const ns of namespaces) {
          // 1. 문제 파드 목록 (CrashLoop / OOMKilled / Error) 조회
          const podsResult = await execFile(kubectlPath, [
            "get",
            "pods",
            "-n",
            ns,
            "--no-headers",
            "--kubeconfig",
            kubeconfigPath,
          ]);
          if (!podsResult.callWasSuccessful) {
            logger.warn(`[RollbackLog] get pods -n ${ns} failed`);
            continue;
          }

          const problemPods = podsResult.response
            .split("\n")
            .filter((line) => {
              const lower = line.toLowerCase();
              return lower.includes("crashloop") || lower.includes("oomkilled") || lower.includes("error");
            })
            .map((line) => line.trim().split(/\s+/)[0])
            .filter(Boolean)
            .slice(0, 5); // 최대 5개 파드

          // 2. kubectl get events
          const eventsResult = await execFile(kubectlPath, [
            "get",
            "events",
            "-n",
            ns,
            "--sort-by=.lastTimestamp",
            "--kubeconfig",
            kubeconfigPath,
          ]);
          const eventsOutput = eventsResult.callWasSuccessful
            ? eventsResult.response.slice(-3000) // 최대 3000자
            : "";

          if (problemPods.length === 0) {
            // 파드 없어도 events만이라도 기록
            if (eventsOutput) {
              snapshots.push({ podName: "(none)", namespace: ns, logs: "", events: eventsOutput });
            }
            continue;
          }

          // 3. 각 파드 로그 수집
          for (const podName of problemPods) {
            try {
              const logsResult = await execFile(kubectlPath, [
                "logs",
                podName,
                "-n",
                ns,
                `--tail=${logTailLines}`,
                "--previous", // crash 전 컨테이너 로그
                "--kubeconfig",
                kubeconfigPath,
              ]);
              const logs = logsResult.callWasSuccessful ? logsResult.response.slice(-4000) : "";

              snapshots.push({ podName, namespace: ns, logs, events: eventsOutput });
              logger.debug(`[RollbackLog] collected logs for ${ns}/${podName}`);
            } catch (err) {
              snapshots.push({
                podName,
                namespace: ns,
                logs: "",
                events: eventsOutput,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }

        logger.info(`[RollbackLog] clusterId=${clusterId} snapshots=${snapshots.length}`);
        return { snapshots, collectedAt };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[RollbackLog] unexpected error: ${msg}`);
        return { snapshots: [], collectedAt, error: msg };
      }
    };
  },
});

export default rollbackLogHandlerInjectable;
