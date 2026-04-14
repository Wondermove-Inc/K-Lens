/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Security Fix Snapshot & Rollback Manager
 * [A-3]: apply 전 원본 YAML 백업, 멱등성 annotation, 롤백, CrashLoop 자동 감지
 *
 * Snapshot 저장 경로:
 *   {DAIVE_DOCUMENTS_ROOT}/{clusterDir}/manifests/{fixSessionId}/{namespace}/{kind}/{name}.yaml
 *
 * 멱등성 annotation:
 *   daive.io/auto-fixed: {fixSessionId}
 *   이미 해당 세션으로 수정된 리소스는 재수정하지 않음.
 *
 * CrashLoop 감지:
 *   apply 후 30초간 2초 간격으로 Pod 상태 폴링.
 *   CrashLoopBackOff 또는 OOMKilled 감지 시 자동 롤백 + push 이벤트.
 *
 * @packageDocumentation
 */

import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { DAIVE_DOCUMENTS_ROOT, sanitizeClusterName } from "../../ai-assistant/main/ai-file-utils";

import type { Logger } from "@skuberplus/logger";

import type { KubectlExecuteFunction } from "../../ai-assistant/main/agent/main-tools";
import type {
  FixResourceRef,
  PodWatchPayload,
  RollbackRequest,
  RollbackResponse,
} from "../common/security-fix-channels";

// ============================================
// Constants
// ============================================

/** Annotation key used to mark auto-fixed resources */
const AUTO_FIXED_ANNOTATION = "daive.io/auto-fixed";

/** CrashLoop watch duration in ms */
const WATCH_DURATION_MS = 60_000;

/** CrashLoop poll interval in ms */
const WATCH_POLL_INTERVAL_MS = 2_000;

// ============================================
// SaveSnapshot result
// ============================================

export interface SaveSnapshotResult {
  saved: boolean;
  /** Set when saved === false (resource was already fixed in this session) */
  reason?: "already-fixed";
  /** Absolute path of the saved YAML file */
  filePath?: string;
}

// ============================================
// FixSnapshotManager
// ============================================

/**
 * Manages pre-apply snapshots, idempotency annotations, rollback,
 * and CrashLoopBackOff auto-rollback for the DAIVE security fix workflow.
 */
export class FixSnapshotManager {
  private readonly kubectl: KubectlExecuteFunction;
  private readonly sendPodWatchEvent: (payload: PodWatchPayload) => void;
  private readonly logger: Logger;
  /** Safe Zone base path (defaults to os.homedir()) */
  private readonly basePath: string;

  constructor(opts: {
    kubectl: KubectlExecuteFunction;
    sendPodWatchEvent: (payload: PodWatchPayload) => void;
    logger: Logger;
    /** Override for tests — defaults to os.homedir() */
    basePath?: string;
  }) {
    this.kubectl = opts.kubectl;
    this.sendPodWatchEvent = opts.sendPodWatchEvent;
    this.logger = opts.logger;
    this.basePath = opts.basePath ?? os.homedir();
  }

  // ------------------------------------------
  // Snapshot path helper
  // ------------------------------------------

  private snapshotPath(
    clusterId: string,
    clusterName: string | null,
    fixSessionId: string,
    namespace: string,
    kind: string,
    name: string,
  ): string {
    const clusterDir = sanitizeClusterName(clusterName ?? clusterId, clusterId);
    const resolved = path.resolve(
      this.basePath,
      DAIVE_DOCUMENTS_ROOT,
      clusterDir,
      "manifests",
      fixSessionId.replace(/[^a-zA-Z0-9._-]/g, "_"),
      namespace.replace(/[^a-zA-Z0-9._-]/g, "_"),
      kind.toLowerCase().replace(/[^a-z0-9._-]/g, "_"),
      `${name.replace(/[^a-zA-Z0-9._-]/g, "_")}.yaml`,
    );
    const expectedBase = path.resolve(this.basePath, DAIVE_DOCUMENTS_ROOT);
    if (!resolved.startsWith(expectedBase)) {
      throw new Error("Path traversal detected — snapshot path escapes base directory");
    }
    return resolved;
  }

  // ------------------------------------------
  // saveSnapshot
  // ------------------------------------------

  /**
   * Fetch current resource YAML and save to manifests directory.
   * Skips (returns saved=false, reason="already-fixed") if the resource
   * already carries the AUTO_FIXED_ANNOTATION for this session.
   */
  async saveSnapshot(
    fixSessionId: string,
    clusterId: string,
    clusterName: string | null,
    kind: string,
    name: string,
    namespace: string,
  ): Promise<SaveSnapshotResult> {
    // 1. Fetch current YAML
    const result = await this.kubectl(clusterId, "get", [`${kind}/${name}`, "-n", namespace, "-o", "yaml"]);

    if (!result.success || !result.stdout) {
      this.logger.warn(`[FixSnapshot] Failed to fetch ${kind}/${name} in ${namespace}: ${result.stderr}`);
      return { saved: false };
    }

    // 2. Idempotency check — skip if already fixed in this session
    if (result.stdout.includes(`${AUTO_FIXED_ANNOTATION}: ${fixSessionId}`)) {
      this.logger.info(`[FixSnapshot] ${kind}/${name} already fixed in session ${fixSessionId}, skipping snapshot`);
      return { saved: false, reason: "already-fixed" };
    }

    // 3. Write YAML to disk
    const filePath = this.snapshotPath(clusterId, clusterName, fixSessionId, namespace, kind, name);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, result.stdout, "utf8");

    this.logger.info(`[FixSnapshot] Snapshot saved: ${filePath}`);
    return { saved: true, filePath };
  }

  // ------------------------------------------
  // markFixed
  // ------------------------------------------

  /**
   * Add idempotency annotation after a successful apply.
   */
  async markFixed(
    fixSessionId: string,
    clusterId: string,
    kind: string,
    name: string,
    namespace: string,
  ): Promise<void> {
    const patch = JSON.stringify({
      metadata: {
        annotations: {
          [AUTO_FIXED_ANNOTATION]: fixSessionId,
        },
      },
    });

    const result = await this.kubectl(clusterId, "patch", [
      `${kind}/${name}`,
      "-n",
      namespace,
      "--type",
      "merge",
      "-p",
      patch,
    ]);

    if (!result.success) {
      this.logger.warn(`[FixSnapshot] Failed to mark ${kind}/${name} as fixed: ${result.stderr}`);
    } else {
      this.logger.info(`[FixSnapshot] Marked ${kind}/${name} as fixed (session: ${fixSessionId})`);
    }
  }

  // ------------------------------------------
  // rollback
  // ------------------------------------------

  /**
   * Restore resources to their pre-fix state using saved snapshots.
   */
  async rollback(req: RollbackRequest, clusterName: string | null): Promise<RollbackResponse> {
    const { fixSessionId, clusterId, scope, resourceRef, namespace } = req;
    const clusterDir = sanitizeClusterName(clusterName ?? clusterId, clusterId);
    const sessionDir = path.join(this.basePath, DAIVE_DOCUMENTS_ROOT, clusterDir, "manifests", fixSessionId);

    // Collect YAML files to restore
    const files = await this.collectYamlFiles(sessionDir, scope, namespace, resourceRef);

    let rolledBack = 0;
    const errors: string[] = [];

    for (const file of files) {
      try {
        const yaml = await fs.readFile(file, "utf8");

        // Strip the auto-fixed annotation before applying
        const cleaned = yaml.replace(new RegExp(`\\s*${AUTO_FIXED_ANNOTATION}:[^\n]*\n?`, "g"), "");

        // Apply via stdin (kubectl apply -f -)
        const result = await this.kubectl(clusterId, "apply", ["-f", "-"], cleaned);

        if (result.success) {
          rolledBack++;
          this.logger.info(`[FixSnapshot] Rolled back: ${file}`);
        } else {
          errors.push(`${file}: ${result.stderr ?? "unknown error"}`);
          this.logger.warn(`[FixSnapshot] Rollback failed for ${file}: ${result.stderr}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${file}: ${msg}`);
        this.logger.warn(`[FixSnapshot] Rollback error for ${file}: ${msg}`);
      }
    }

    return {
      success: errors.length === 0,
      rolledBack,
      errors,
    };
  }

  // ------------------------------------------
  // watchForCrash
  // ------------------------------------------

  /**
   * Poll pod status for 30 seconds after applying a fix.
   * Auto-rolls back and emits a pod-watch event on CrashLoopBackOff or OOMKilled.
   */
  watchForCrash(
    fixSessionId: string,
    clusterId: string,
    clusterName: string | null,
    resourceRef: Omit<FixResourceRef, "fixSessionId">,
    onCrash: (status: "crash-loop" | "oomkilled") => void,
  ): void {
    const { kind, name, namespace } = resourceRef;
    const fullRef: FixResourceRef = { ...resourceRef, fixSessionId };

    this.logger.info(
      `[FixSnapshot] Starting crash watch for ${kind}/${name} in ${namespace} (${WATCH_DURATION_MS / 1000}s)`,
    );

    const startAt = Date.now();
    let resolved = false;

    const intervalId = setInterval(async () => {
      if (resolved) return;

      if (Date.now() - startAt >= WATCH_DURATION_MS) {
        resolved = true;
        clearInterval(intervalId);
        this.logger.info(`[FixSnapshot] Watch timeout for ${kind}/${name} — pod appears healthy`);
        this.sendPodWatchEvent({
          fixSessionId,
          resourceRef: fullRef,
          status: "watch-timeout",
        });
        return;
      }

      try {
        // Get pods owned by this workload (label selector approach)
        const result = await this.kubectl(clusterId, "get", [
          "pods",
          "-n",
          namespace,
          "-o",
          "json",
          "--field-selector",
          `status.phase!=Succeeded`,
        ]);

        if (!result.success || !result.stdout) return;

        const parsed = JSON.parse(result.stdout) as { items: PodJson[] };
        const relatedPods = parsed.items.filter((p) => this.isPodOwnedByWorkload(p, kind, name));

        for (const pod of relatedPods) {
          const crashStatus = this.detectCrashStatus(pod);
          if (!crashStatus) continue;

          resolved = true;
          clearInterval(intervalId);

          this.logger.warn(`[FixSnapshot] ${crashStatus} detected on pod ${pod.metadata.name}, triggering rollback`);

          // Auto-rollback
          await this.rollback(
            {
              fixSessionId,
              clusterId,
              scope: "single",
              resourceRef: { kind, name, namespace },
            },
            clusterName,
          );

          this.sendPodWatchEvent({
            fixSessionId,
            resourceRef: fullRef,
            status: "rollback-triggered",
            message: `${crashStatus} detected on pod ${pod.metadata.name}`,
          });

          onCrash(crashStatus);
          return;
        }
      } catch (err) {
        // Silently ignore parse errors — keep polling
        this.logger.debug(`[FixSnapshot] Poll error (non-fatal): ${err}`);
      }
    }, WATCH_POLL_INTERVAL_MS);
  }

  // ------------------------------------------
  // Private helpers
  // ------------------------------------------

  private async collectYamlFiles(
    sessionDir: string,
    scope: RollbackRequest["scope"],
    namespace?: string,
    resourceRef?: RollbackRequest["resourceRef"],
  ): Promise<string[]> {
    if (scope === "single" && resourceRef) {
      const file = path.join(
        sessionDir,
        resourceRef.namespace,
        resourceRef.kind.toLowerCase(),
        `${resourceRef.name}.yaml`,
      );
      return (await this.fileExists(file)) ? [file] : [];
    }

    if (scope === "namespace" && namespace) {
      return this.globYaml(path.join(sessionDir, namespace));
    }

    // scope === "session"
    return this.globYaml(sessionDir);
  }

  private async globYaml(dir: string): Promise<string[]> {
    try {
      return await this.walkYaml(dir);
    } catch {
      return [];
    }
  }

  private async walkYaml(dir: string): Promise<string[]> {
    const results: string[] = [];
    let entries: string[];

    try {
      entries = await fs.readdir(dir);
    } catch {
      return results;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory()) {
        results.push(...(await this.walkYaml(full)));
      } else if (entry.endsWith(".yaml")) {
        results.push(full);
      }
    }

    return results;
  }

  private async fileExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private isPodOwnedByWorkload(pod: PodJson, kind: string, name: string): boolean {
    const owners = pod.metadata.ownerReferences ?? [];
    const lowerKind = kind.toLowerCase();

    // Direct ownership (ReplicaSet owned by Deployment, DaemonSet, StatefulSet)
    for (const owner of owners) {
      if (owner.kind.toLowerCase() === lowerKind && owner.name === name) return true;
      // ReplicaSet name usually starts with deployment name
      if (lowerKind === "deployment" && owner.kind === "ReplicaSet" && owner.name.startsWith(name)) {
        return true;
      }
    }
    return false;
  }

  private detectCrashStatus(pod: PodJson): "crash-loop" | "oomkilled" | null {
    const containerStatuses = [...(pod.status.containerStatuses ?? []), ...(pod.status.initContainerStatuses ?? [])];

    for (const cs of containerStatuses) {
      const waiting = cs.state?.waiting;
      if (waiting?.reason === "CrashLoopBackOff") return "crash-loop";
      // ImagePullBackOff / ErrImagePull / InvalidImageName — 잘못된 이미지 태그 감지
      if (
        waiting?.reason === "ImagePullBackOff" ||
        waiting?.reason === "ErrImagePull" ||
        waiting?.reason === "InvalidImageName"
      )
        return "crash-loop";

      const terminated = cs.state?.terminated ?? cs.lastState?.terminated;
      if (terminated?.reason === "OOMKilled") return "oomkilled";
    }

    return null;
  }
}

// ============================================
// Internal pod JSON types (minimal subset)
// ============================================

interface PodJson {
  metadata: {
    name: string;
    namespace: string;
    ownerReferences?: Array<{ kind: string; name: string }>;
  };
  status: {
    containerStatuses?: ContainerStatusJson[];
    initContainerStatuses?: ContainerStatusJson[];
  };
}

interface ContainerStatusJson {
  name: string;
  state?: {
    waiting?: { reason?: string };
    terminated?: { reason?: string };
  };
  lastState?: {
    terminated?: { reason?: string };
  };
}
