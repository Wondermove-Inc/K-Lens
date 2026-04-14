/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Security Fix Snapshot IPC handler (DI registration)
 * [A-3]: Registers the security:fix:rollback request handler
 *
 * Wires together:
 * - FixSnapshotManager (snapshot/rollback/crash-watch logic)
 * - security:fix:rollback RequestChannel (Renderer → Main)
 * - security:fix:pod-watch MessageChannel (Main → Renderer push)
 *
 * @packageDocumentation
 */

import { loggerInjectionToken } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable, sendMessageToChannelInjectionToken } from "@skuberplus/messaging";
import { spawn } from "child_process";
import execFileInjectable from "../../../common/fs/exec-file.injectable";
import kubeconfigManagerInjectable from "../../../main/kubeconfig-manager/kubeconfig-manager.injectable";
import createKubectlInjectable from "../../../main/kubectl/create-kubectl.injectable";
import { hasDangerousKubectlFlags, isAllowedKubectlCommand } from "../../ai-assistant/common/kubectl-execute-channel";
import getClusterByIdInjectable from "../../cluster/storage/common/get-by-id.injectable";
import {
  securityFixPodWatchChannel,
  securityFixRollbackChannel,
  securityFixSaveSnapshotChannel,
  securityFixWatchCrashLoopChannel,
} from "../common/security-fix-channels";
import { FixSnapshotManager } from "./fix-snapshot-manager";

import type { KubectlExecuteFunction } from "../../ai-assistant/main/agent/main-tools";

// ============================================
// Spawn-based kubectl helper (supports stdin)
// ============================================

function spawnKubectl(
  kubectlPath: string,
  args: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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
    proc.on("error", (err) => {
      resolve({ stdout: "", stderr: err.message, exitCode: 1 });
    });

    if (stdin) {
      proc.stdin.write(stdin);
    }
    proc.stdin.end();
  });
}

// ============================================
// Rollback IPC Handler
// ============================================

const fixSnapshotHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-fix-snapshot-handler",
  channel: securityFixRollbackChannel,
  getHandler: (di) => {
    const getClusterById = di.inject(getClusterByIdInjectable);
    const createKubectl = di.inject(createKubectlInjectable);
    const execFile = di.inject(execFileInjectable);
    const logger = di.inject(loggerInjectionToken);
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);

    // Build kubectl execute function (same pattern as agent-host.injectable.ts)
    const executeKubectl: KubectlExecuteFunction = async (clusterId, command, args, stdin?) => {
      if (!isAllowedKubectlCommand(command)) {
        return { success: false, stderr: `Blocked kubectl command: ${command}` };
      }
      if (hasDangerousKubectlFlags(args)) {
        return { success: false, stderr: "Dangerous kubectl flags detected" };
      }

      const cluster = getClusterById(clusterId);
      if (!cluster) {
        return { success: false, stderr: `Cluster not found: ${clusterId}` };
      }

      try {
        const kubectl = createKubectl(cluster.version.get());
        const kubectlPath = await kubectl.getPath();
        const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
        const kubeconfigPath = await kubeconfigManager.ensurePath();

        const fullArgs = [...[command], ...args, "--kubeconfig", kubeconfigPath];

        if (stdin) {
          const result = await spawnKubectl(kubectlPath, fullArgs, stdin);
          return {
            success: result.exitCode === 0,
            stdout: result.stdout,
            stderr: result.stderr,
          };
        }

        const result = await execFile(kubectlPath, fullArgs);
        if (result.callWasSuccessful) {
          return { success: true, stdout: result.response };
        }
        return {
          success: false,
          stderr: result.error.stderr ?? result.error.message,
        };
      } catch (err) {
        return {
          success: false,
          stderr: err instanceof Error ? err.message : String(err),
        };
      }
    };

    const manager = new FixSnapshotManager({
      kubectl: executeKubectl,
      sendPodWatchEvent: (payload) => {
        sendMessageToChannel(securityFixPodWatchChannel, payload);
      },
      logger,
    });

    return async (request) => {
      logger.info(`[FixSnapshotHandler] Rollback requested: session=${request.fixSessionId} scope=${request.scope}`);

      // Resolve cluster name for snapshot path
      const cluster = getClusterById(request.clusterId);
      const clusterName = cluster?.name.get() ?? null;

      return manager.rollback(request, clusterName);
    };
  },
});

// ============================================
// Save Snapshot IPC Handler
// ============================================

export const fixSaveSnapshotHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-fix-save-snapshot-handler",
  channel: securityFixSaveSnapshotChannel,
  getHandler: (di) => {
    const getClusterById = di.inject(getClusterByIdInjectable);
    const createKubectl = di.inject(createKubectlInjectable);
    const execFile = di.inject(execFileInjectable);
    const logger = di.inject(loggerInjectionToken);
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);

    const executeKubectl: KubectlExecuteFunction = async (clusterId, command, args, stdin?) => {
      if (!isAllowedKubectlCommand(command)) return { success: false, stderr: `Blocked: ${command}` };
      if (hasDangerousKubectlFlags(args)) return { success: false, stderr: "Dangerous flags" };
      const cluster = getClusterById(clusterId);
      if (!cluster) return { success: false, stderr: `Cluster not found: ${clusterId}` };
      try {
        const kubectl = createKubectl(cluster.version.get());
        const kubectlPath = await kubectl.getPath();
        const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
        const kubeconfigPath = await kubeconfigManager.ensurePath();
        const fullArgs = [command, ...args, "--kubeconfig", kubeconfigPath];
        if (stdin) {
          const result = await spawnKubectl(kubectlPath, fullArgs, stdin);
          return { success: result.exitCode === 0, stdout: result.stdout, stderr: result.stderr };
        }
        const result = await execFile(kubectlPath, fullArgs);
        return result.callWasSuccessful
          ? { success: true, stdout: result.response }
          : { success: false, stderr: result.error.stderr ?? result.error.message };
      } catch (err) {
        return { success: false, stderr: err instanceof Error ? err.message : String(err) };
      }
    };

    const manager = new FixSnapshotManager({
      kubectl: executeKubectl,
      sendPodWatchEvent: (payload) => sendMessageToChannel(securityFixPodWatchChannel, payload),
      logger,
    });

    return async (request) => {
      const { fixSessionId, clusterId, resources } = request;
      const cluster = getClusterById(clusterId);
      const clusterName = cluster?.name.get() ?? null;

      const SNAPSHOT_CONCURRENCY = 10;
      let saved = 0;
      let skipped = 0;
      for (let i = 0; i < resources.length; i += SNAPSHOT_CONCURRENCY) {
        const batch = resources.slice(i, i + SNAPSHOT_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((res) =>
            manager.saveSnapshot(fixSessionId, clusterId, clusterName, res.kind, res.name, res.namespace),
          ),
        );
        results.forEach((r) => {
          if (r.status === "fulfilled") saved++;
          else {
            logger.warn(`[FixSaveSnapshotHandler] skip: ${r.reason}`);
            skipped++;
          }
        });
      }
      logger.info(`[FixSaveSnapshotHandler] saved=${saved} skipped=${skipped}`);
      return { saved, skipped };
    };
  },
});

// ============================================
// Watch CrashLoop IPC Handler
// ============================================

export const fixWatchCrashLoopHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-fix-watch-crash-loop-handler",
  channel: securityFixWatchCrashLoopChannel,
  getHandler: (di) => {
    const getClusterById = di.inject(getClusterByIdInjectable);
    const createKubectl = di.inject(createKubectlInjectable);
    const execFile = di.inject(execFileInjectable);
    const logger = di.inject(loggerInjectionToken);
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);

    const executeKubectl: KubectlExecuteFunction = async (clusterId, command, args, stdin?) => {
      if (!isAllowedKubectlCommand(command)) return { success: false, stderr: `Blocked: ${command}` };
      if (hasDangerousKubectlFlags(args)) return { success: false, stderr: "Dangerous flags" };
      const cluster = getClusterById(clusterId);
      if (!cluster) return { success: false, stderr: `Cluster not found: ${clusterId}` };
      try {
        const kubectl = createKubectl(cluster.version.get());
        const kubectlPath = await kubectl.getPath();
        const kubeconfigManager = di.inject(kubeconfigManagerInjectable, cluster);
        const kubeconfigPath = await kubeconfigManager.ensurePath();
        const fullArgs = [command, ...args, "--kubeconfig", kubeconfigPath];
        if (stdin) {
          const result = await spawnKubectl(kubectlPath, fullArgs, stdin);
          return { success: result.exitCode === 0, stdout: result.stdout, stderr: result.stderr };
        }
        const result = await execFile(kubectlPath, fullArgs);
        return result.callWasSuccessful
          ? { success: true, stdout: result.response }
          : { success: false, stderr: result.error.stderr ?? result.error.message };
      } catch (err) {
        return { success: false, stderr: err instanceof Error ? err.message : String(err) };
      }
    };

    const manager = new FixSnapshotManager({
      kubectl: executeKubectl,
      sendPodWatchEvent: (payload) => sendMessageToChannel(securityFixPodWatchChannel, payload),
      logger,
    });

    return async (request) => {
      const { fixSessionId, clusterId, resources } = request;
      const cluster = getClusterById(clusterId);
      const clusterName = cluster?.name.get() ?? null;

      for (const res of resources) {
        manager.watchForCrash(
          fixSessionId,
          clusterId,
          clusterName,
          { kind: res.kind, name: res.name, namespace: res.namespace },
          (status) => {
            logger.warn(`[FixWatchCrashLoop] ${status} on ${res.kind}/${res.name}`);
          },
        );
      }
      logger.info(`[FixWatchCrashLoop] watching ${resources.length} resources`);
      return { watching: true };
    };
  },
});

export default fixSnapshotHandlerInjectable;
