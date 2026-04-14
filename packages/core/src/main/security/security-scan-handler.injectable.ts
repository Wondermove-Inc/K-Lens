/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Security scan IPC handlers (Main Process)
 * Main IPC handler implementation
 *
 * Handlers:
 * - `security:scan:run`: TrivyScanner / KubescapeScanner execution
 * - `security:scan:cancel`: Abort via AbortController
 * - `security:scanner:get-status`: Binary status check
 * - Scan progress pushed to Renderer via `broadcastMessage`
 *
 * Pattern: getRequestChannelListenerInjectable + broadcastMessageInjectable
 *
 * @packageDocumentation
 */

import { loggerInjectionToken } from "@skuberplus/logger";
import { getRequestChannelListenerInjectable } from "@skuberplus/messaging";
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import broadcastMessageInjectable from "../../common/ipc/broadcast-message.injectable";
import bundledBinaryPathInjectable from "../../common/utils/bundled-binary-path.injectable";
import {
  securityCancelScanChannel,
  securityClearScanCacheChannel,
  securityGetScannerStatusChannel,
  securityLoadAllScanCachesChannel,
  securityLoadScanCacheChannel,
  securityRunScanChannel,
  securitySaveScanCacheChannel,
  securityScanCompleteChannel,
  securityScanErrorChannel,
  securityScanProgressChannel,
} from "../../features/security/common/security-ipc-channels";
import { KubescapeScanner } from "../../features/security/main/kubescape-scanner";
import { TrivyScanner } from "../../features/security/main/trivy-scanner";

import type { Logger } from "@skuberplus/logger";

import type { BroadcastMessage } from "../../common/ipc/broadcast-message.injectable";
import type { ScannerStatus } from "../../features/security/common/scanner-engine";
import type {
  CachedClusterEntry,
  CancelScanRequest,
  CancelScanResponse,
  ClearScanCacheRequest,
  GetScannerStatusRequest,
  LoadAllScanCachesRequest,
  LoadAllScanCachesResponse,
  LoadScanCacheRequest,
  LoadScanCacheResponse,
  RunScanRequest,
  RunScanResponse,
  SaveScanCacheRequest,
  SaveScanCacheResponse,
  ScanCompletePayload,
  ScanErrorPayload,
  ScanProgressPayload,
} from "../../features/security/common/security-ipc-channels";

// ============================================
// Active scan registry (scanId → AbortController)
// ============================================

const activeScanControllers = new Map<string, AbortController>();
// Tracks which clusterIds are currently being scanned — prevents concurrent scans for the same cluster
const activeClusterScans = new Set<string>();
const scanIdToClusterId = new Map<string, string>();

/** Per-scan accumulated findings — Main-side cache persistence */
const scanAccumulatedFindings = new Map<string, any[]>();

// ============================================
// Input validation helpers
// ============================================

/** Kubernetes resource name / context / namespace pattern: alphanumeric + hyphen + dot + underscore + colon */
const SAFE_K8S_NAME = /^[a-zA-Z0-9._:@\/-]+$/;

function validateK8sName(value: string, label: string): void {
  if (!value || !SAFE_K8S_NAME.test(value)) {
    throw new Error(`Invalid ${label}: contains disallowed characters`);
  }
}

// ============================================
// Namespace list helper
// ============================================

/** Fetch cluster namespace names via kubectl. Returns null on failure (triggers full-scan fallback). */
async function getClusterNamespaces(kubeconfigPath: string, contextName: string): Promise<string[] | null> {
  return new Promise((resolve) => {
    const { execFile } = require("child_process") as typeof import("child_process");
    execFile(
      "kubectl",
      [
        "get",
        "namespaces",
        "--kubeconfig",
        kubeconfigPath,
        "--context",
        contextName,
        "-o",
        "jsonpath={.items[*].metadata.name}",
      ],
      { timeout: 10_000 },
      (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null);
          return;
        }
        const namespaces = stdout.trim().split(/\s+/).filter(Boolean);
        resolve(namespaces.length > 0 ? namespaces : null);
      },
    );
  });
}

// ============================================
// CVE findings imageUri enrichment
// trivy k8s --report all 결과에는 실제 컨테이너 이미지 URI가 없음.
// Result.Target은 바이너리 내부 경로(app/cmd/controller 등)를 반환.
// kubectl get {kind} {name} -n {ns} → spec.template.spec.containers[].image 로 매핑.
// ============================================

async function enrichFindingsWithImageUri(
  findings: any[],
  kubeconfigPath: string,
  contextName: string,
): Promise<any[]> {
  const { execFile } = require("child_process") as typeof import("child_process");

  // 1. CVE findings 중 imageUri 없는 것만 대상 (kind !== "Image" 필터링은 이미 isValidImageTarget에서 처리)
  const cveFindingsToEnrich = findings.filter(
    (f) => f.type === "CVE" && !f.imageUri && f.resource?.kind && f.resource?.name && f.resource?.namespace,
  );

  if (cveFindingsToEnrich.length === 0) return findings;

  // 2. workload key별 그룹화 — {kind/ns/name}
  const workloadMap = new Map<string, { kind: string; namespace: string; name: string }>();
  for (const f of cveFindingsToEnrich) {
    const { kind, name, namespace } = f.resource;
    if (!namespace) continue;
    // 스캔 가능한 워크로드만 (Deployment, DaemonSet, StatefulSet, CronJob)
    const k = kind.toLowerCase();
    if (!["deployment", "daemonset", "statefulset", "job", "cronjob"].includes(k)) continue;
    const key = `${kind}/${namespace}/${name}`;
    if (!workloadMap.has(key)) workloadMap.set(key, { kind, namespace, name });
  }

  if (workloadMap.size === 0) return findings;

  // 3. kubectl get으로 실제 이미지 URI 조회 (병렬 최대 10개)
  // Map: workloadKey → Map<containerName, imageUri>
  const imageMapByWorkload = new Map<string, Map<string, string>>();

  const workloadEntries = [...workloadMap.entries()];

  // 10개씩 병렬 처리
  const CONCURRENCY = 10;
  for (let i = 0; i < workloadEntries.length; i += CONCURRENCY) {
    const batch = workloadEntries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ([key, { kind, namespace, name }]) => {
        return new Promise<void>((resolve) => {
          execFile(
            "kubectl",
            [
              "get",
              kind,
              name,
              "-n",
              namespace,
              "--kubeconfig",
              kubeconfigPath,
              "--context",
              contextName,
              "-o",
              "jsonpath={range .spec.template.spec.containers[*]}{.name}={.image}\n{end}",
            ],
            { timeout: 10_000 },
            (error, stdout) => {
              if (!error && stdout.trim()) {
                const containerMap = new Map<string, string>();
                for (const line of stdout.trim().split("\n")) {
                  const eqIdx = line.indexOf("=");
                  if (eqIdx === -1) continue;
                  const containerName = line.slice(0, eqIdx).trim();
                  const imageUri = line.slice(eqIdx + 1).trim();
                  if (containerName && imageUri) containerMap.set(containerName, imageUri);
                }
                if (containerMap.size > 0) imageMapByWorkload.set(key, containerMap);
              }
              resolve();
            },
          );
        });
      }),
    );
  }

  // 4. findings에 imageUri 적용
  const enriched = findings.map((f) => {
    if (f.type !== "CVE" || f.imageUri) return f;
    const { kind, name, namespace } = f.resource ?? {};
    if (!kind || !name || !namespace) return f;
    const key = `${kind}/${namespace}/${name}`;
    const containerMap = imageMapByWorkload.get(key);
    if (!containerMap || containerMap.size === 0) return f;

    // container 이름 매칭: rawLog._containerName → 정확 매칭, 없으면 첫 번째 container 이미지
    const containerName: string | undefined = f.rawLog?._containerName as string | undefined;
    let imageUri: string | undefined;
    if (containerName && containerMap.has(containerName)) {
      imageUri = containerMap.get(containerName);
    } else {
      // container 이름 없거나 매칭 안 되면 첫 번째 container 이미지 사용
      imageUri = containerMap.values().next().value;
    }

    if (!imageUri) return f;
    return { ...f, imageUri };
  });

  return enriched;
}

// ============================================
// get-status handler
// ============================================

const securityGetScannerStatusHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-get-scanner-status-handler",
  channel: securityGetScannerStatusChannel,
  getHandler: (di) => {
    const trivyBinaryPath = di.inject(bundledBinaryPathInjectable, "trivy");
    const kubescapeBinaryPath = di.inject(bundledBinaryPathInjectable, "kubescape");

    return async ({ scannerName }: GetScannerStatusRequest): Promise<ScannerStatus> => {
      if (scannerName === "trivy") {
        const scanner = new TrivyScanner(trivyBinaryPath);
        return scanner.getStatus();
      }
      const scanner = new KubescapeScanner(kubescapeBinaryPath);
      return scanner.getStatus();
    };
  },
});

// ============================================
// run-scan handler
// ============================================

const securityRunScanHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-run-scan-handler",
  channel: securityRunScanChannel,
  getHandler: (di) => {
    const broadcastMessage: BroadcastMessage = di.inject(broadcastMessageInjectable);
    const logger: Logger = di.inject(loggerInjectionToken);
    const trivyBinaryPath = di.inject(bundledBinaryPathInjectable, "trivy");
    const kubescapeBinaryPath = di.inject(bundledBinaryPathInjectable, "kubescape");

    return async (request: RunScanRequest): Promise<RunScanResponse> => {
      const {
        clusterId,
        contextName,
        kubeconfigPath,
        scanner,
        namespaces,
        timeoutMs,
        scanMode = "sequential",
        retryNamespaces,
      } = request;

      // Input validation
      try {
        validateK8sName(clusterId, "clusterId");
        validateK8sName(contextName, "contextName");
        if (namespaces) namespaces.forEach((ns) => validateK8sName(ns, "namespace"));
        if (retryNamespaces) retryNamespaces.forEach((ns) => validateK8sName(ns, "retryNamespace"));
        if (!["trivy", "kubescape", "all"].includes(scanner)) {
          throw new Error(`Invalid scanner: ${scanner}`);
        }
      } catch (err) {
        logger.warn(`[SECURITY] Scan rejected — invalid input: ${err}`);
        return { success: false, scanId: "", error: String(err) };
      }

      // Guard: reject concurrent scans for the same cluster
      if (activeClusterScans.has(clusterId)) {
        logger.warn(`[SECURITY] Scan rejected — already scanning cluster=${clusterId}`);
        return { success: false, scanId: "", error: "A scan is already running for this cluster" };
      }
      activeClusterScans.add(clusterId);

      const scanId = crypto.randomUUID();
      scanIdToClusterId.set(scanId, clusterId);

      const scannerNames: Array<"trivy" | "kubescape"> = scanner === "all" ? ["trivy", "kubescape"] : [scanner];

      logger.info(`[SECURITY] Starting scan: scanId=${scanId}, scanner=${scanner}, cluster=${clusterId}`);

      // Run scan asynchronously — IPC returns scanId immediately
      void (async () => {
        const controller = new AbortController();
        activeScanControllers.set(scanId, controller);

        // ─────────────────────────────────────────────────────────────────
        // Single scanner run helper — used for kubescape and trivy full-scan fallback
        // ─────────────────────────────────────────────────────────────────
        const runOne = async (
          name: "trivy" | "kubescape",
          overrideNamespaces?: string[],
          overrideTimeout?: number,
        ): Promise<void> => {
          if (controller.signal.aborted) return;

          const scannerInstance =
            name === "trivy"
              ? new TrivyScanner(trivyBinaryPath, logger)
              : new KubescapeScanner(kubescapeBinaryPath, logger);

          const result = await scannerInstance.run({
            clusterId,
            contextName,
            kubeconfigPath,
            namespaces: overrideNamespaces ?? namespaces,
            timeoutMs: overrideTimeout ?? timeoutMs,
            signal: controller.signal,
            onProgress: ({ percent, message, findingsSoFar }) => {
              const payload: ScanProgressPayload = {
                scanId,
                clusterId,
                percent,
                message,
                findingsSoFar,
                scanner: name,
              };
              void broadcastMessage(securityScanProgressChannel.id, payload);
            },
          });

          if (result.success) {
            const complete = result.result;
            // kubectl get으로 실제 컨테이너 이미지 URI 매핑
            const enrichedFindings =
              name === "trivy"
                ? await enrichFindingsWithImageUri(complete.findings, kubeconfigPath, contextName).catch(
                    () => complete.findings,
                  )
                : complete.findings;
            const payload: ScanCompletePayload = {
              scanId,
              clusterId,
              findings: enrichedFindings,
              scannedAt: complete.scannedAt,
              scanner: name,
            };
            logger.info(
              `[SECURITY] Scan complete: scanId=${scanId}, scanner=${name}, findings=${complete.findings.length} (enriched=${enrichedFindings.length})`,
            );
            void broadcastMessage(securityScanCompleteChannel.id, payload);
            // Accumulate findings for Main-side cache persistence
            const accumulated = scanAccumulatedFindings.get(scanId) ?? [];
            accumulated.push(...enrichedFindings);
            scanAccumulatedFindings.set(scanId, accumulated);
          } else {
            const err = result.error;
            const payload: ScanErrorPayload = {
              scanId,
              clusterId,
              errorType: err.type,
              message: err.message,
              scanner: name,
            };
            logger.warn(`[SECURITY] Scan error: scanId=${scanId}, scanner=${name}, type=${err.type}: ${err.message}`);
            void broadcastMessage(securityScanErrorChannel.id, payload);
          }
        };

        // ─────────────────────────────────────────────────────────────────
        // Trivy namespace-split scan
        // Sequential per-ns execution (200s each) — timed-out ns recorded, remaining results preserved
        // ─────────────────────────────────────────────────────────────────
        const NS_TIMEOUT_MS = 200_000; // 200s per namespace (first scan)
        const timedOutNamespaces: string[] = [];
        let trivyTotalFindings = 0;

        const runTrivyByNamespace = async (): Promise<void> => {
          // Retry mode: if retryNamespaces provided, only re-scan those namespaces
          const targetNamespaces = retryNamespaces ?? (await getClusterNamespaces(kubeconfigPath, contextName));

          if (!targetNamespaces || targetNamespaces.length === 0) {
            // Namespace list unavailable — fall back to full cluster scan
            logger.warn(`[SECURITY][Trivy] Namespace list unavailable — falling back to full scan: scanId=${scanId}`);
            await runOne("trivy");
            return;
          }

          const isRetry = !!retryNamespaces;
          // Retry: 1h timeout — production large ns (kube-system) can take 20~30 min
          const nsTimeout = isRetry ? 7_200_000 : NS_TIMEOUT_MS;

          logger.info(
            `[SECURITY][Trivy] NS split scan: ${targetNamespaces.length} namespaces, ${nsTimeout / 1000}s each (retry=${isRetry}): scanId=${scanId}`,
          );

          for (let i = 0; i < targetNamespaces.length; i++) {
            if (controller.signal.aborted) break;
            const ns = targetNamespaces[i];
            const progressBase = Math.round((i / targetNamespaces.length) * 80); // 0~80%

            void broadcastMessage(securityScanProgressChannel.id, {
              scanId,
              clusterId,
              percent: progressBase + 5,
              message: `Trivy: scanning namespace ${ns} (${i + 1}/${targetNamespaces.length})`,
              findingsSoFar: trivyTotalFindings,
              scanner: "trivy",
              timedOutNamespaces: [...timedOutNamespaces],
            } satisfies ScanProgressPayload);

            const nsScanner = new TrivyScanner(trivyBinaryPath, logger);
            const result = await nsScanner.run({
              clusterId,
              contextName,
              kubeconfigPath,
              namespaces: [ns],
              timeoutMs: nsTimeout,
              signal: controller.signal,
              onProgress: () => {
                // No-op: trivyTotalFindings is updated after ns completes (result.result.findings.length).
                // Do NOT accumulate fSoFar here — it is trivy-internal per-ns partial count
                // and would double-count with the post-completion increment below.
              },
            });

            if (result.success) {
              // kubectl get으로 실제 컨테이너 이미지 URI 매핑
              const nsEnrichedFindings = await enrichFindingsWithImageUri(
                result.result.findings,
                kubeconfigPath,
                contextName,
              ).catch(() => result.result.findings);
              trivyTotalFindings += nsEnrichedFindings.length;
              logger.info(
                `[SECURITY][Trivy] NS scan complete: ns=${ns}, findings=${nsEnrichedFindings.length}, scanId=${scanId}`,
              );
              // partial=true: merge findings without advancing scan state machine
              void broadcastMessage(securityScanCompleteChannel.id, {
                scanId,
                clusterId,
                findings: nsEnrichedFindings,
                scannedAt: result.result.scannedAt,
                scanner: "trivy",
                partial: true,
              } satisfies ScanCompletePayload);
              // Accumulate trivy NS findings for Main-side cache persistence
              const accumulated = scanAccumulatedFindings.get(scanId) ?? [];
              accumulated.push(...nsEnrichedFindings);
              scanAccumulatedFindings.set(scanId, accumulated);
            } else {
              const isNsTimeout = result.error.type === "TIMEOUT";
              if (isNsTimeout) {
                timedOutNamespaces.push(ns);
                logger.warn(`[SECURITY][Trivy] NS timeout: ns=${ns}, scanId=${scanId}`);
              } else {
                logger.warn(`[SECURITY][Trivy] NS error: ns=${ns}, type=${result.error.type}, scanId=${scanId}`);
              }
              // Timeout or error: skip this ns and continue to the next
            }
          }

          // Broadcast final timedOutNamespaces state after all namespaces processed
          void broadcastMessage(securityScanProgressChannel.id, {
            scanId,
            clusterId,
            percent: 95,
            message:
              timedOutNamespaces.length > 0
                ? `Trivy scan complete. ${timedOutNamespaces.length} namespace(s) timed out: ${timedOutNamespaces.join(", ")}`
                : "Trivy scan complete",
            findingsSoFar: trivyTotalFindings,
            scanner: "trivy",
            timedOutNamespaces: [...timedOutNamespaces],
          } satisfies ScanProgressPayload);

          // Signal trivy completion in scanner=all mode so handleComplete adds to completedScanners
          // Findings already sent per-ns above; empty array here — dedup/merge logic handles accumulation
          void broadcastMessage(securityScanCompleteChannel.id, {
            scanId,
            clusterId,
            findings: [],
            scannedAt: new Date().toISOString(),
            scanner: "trivy",
          } satisfies ScanCompletePayload);
        };

        try {
          if (scanMode === "parallel" && scannerNames.length > 1) {
            // Parallel mode: Trivy runs ns-split, Kubescape runs as-is
            logger.info(`[SECURITY] Running scanners in parallel mode: scanId=${scanId}`);
            await Promise.all(scannerNames.map((name) => (name === "trivy" ? runTrivyByNamespace() : runOne(name))));
          } else {
            // Sequential mode (default)
            logger.info(`[SECURITY] Running scanners in sequential mode: scanId=${scanId}`);
            for (const name of scannerNames) {
              if (controller.signal.aborted) break;
              if (name === "trivy") {
                await runTrivyByNamespace();
              } else {
                await runOne(name);
              }
            }
          }
          // ─────────────────────────────────────────────────────────────
          // Main-side cache persistence
          // Save scan results directly from Main process so cache is always written
          // regardless of renderer frame state, cluster tab switches, or restoreFromCache timing.
          // ─────────────────────────────────────────────────────────────
          if (!controller.signal.aborted) {
            const accumulated = scanAccumulatedFindings.get(scanId) ?? [];

            // For retry scans, merge with existing cache findings to prevent data loss
            let baseFindings: any[] = [];
            if (retryNamespaces && retryNamespaces.length > 0) {
              try {
                const existingPath = getCacheFilePath(clusterId);
                if (fs.existsSync(existingPath)) {
                  const existingRaw = fs.readFileSync(existingPath, "utf-8");
                  const existingData = JSON.parse(existingRaw) as { findings: any[] };
                  baseFindings = existingData.findings ?? [];
                  logger.info(
                    `[security-cache] Main-side: loaded ${baseFindings.length} existing findings for retry merge`,
                  );
                }
              } catch {
                // If existing cache can't be read, proceed with accumulated only
              }
            }

            const allFindings = [...baseFindings, ...accumulated];
            // Dedup findings by id
            const seen = new Set<string>();
            const deduped = allFindings.filter((f: any) => {
              const id = f.id;
              if (!id || seen.has(id)) return false;
              seen.add(id);
              return true;
            });

            const scanState = {
              scanId,
              status: "complete" as const,
              progress: 100,
              currentClusterId: clusterId,
              message: "Scan complete",
              completedScanners: [...scannerNames],
              findingsSoFar: deduped.length,
              scannedAt: new Date().toISOString(),
              lastError: null,
              scannerMode: scanner === "all" ? "all" : scanner,
              timedOutScanners: [],
              _clusterId: clusterId,
              _timedOutNamespaces: [...timedOutNamespaces],
            };

            try {
              const filePath = getCacheFilePath(clusterId);
              const data = JSON.stringify({ scanState, findings: deduped });
              fs.writeFileSync(filePath, data, "utf-8");
              logger.info(
                `[security-cache] Main-side: saved ${deduped.length} findings (${(data.length / 1024 / 1024).toFixed(1)}MB) for cluster ${clusterId}`,
              );
            } catch (cacheErr) {
              logger.error(`[security-cache] Main-side: failed to save cache for cluster ${clusterId}:`, cacheErr);
            }
          }
        } finally {
          activeScanControllers.delete(scanId);
          activeClusterScans.delete(clusterId);
          scanIdToClusterId.delete(scanId); // cleanup to prevent memory leak
          scanAccumulatedFindings.delete(scanId);
        }
      })();

      return { success: true, scanId };
    };
  },
});

// ============================================
// cancel-scan handler
// ============================================

const securityCancelScanHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-cancel-scan-handler",
  channel: securityCancelScanChannel,
  getHandler: () => {
    return async ({ scanId }: CancelScanRequest): Promise<CancelScanResponse> => {
      const controller = activeScanControllers.get(scanId);
      if (controller) {
        controller.abort();
        activeScanControllers.delete(scanId);
        const cid = scanIdToClusterId.get(scanId);
        if (cid) {
          activeClusterScans.delete(cid);
          scanIdToClusterId.delete(scanId);
        }
        return { success: true };
      }
      return { success: false };
    };
  },
});

// ============================================
// Cache handlers — persist scan results to userData JSON file
// ============================================

function getCacheDir(): string {
  const userData = app.getPath("userData");
  const cacheDir = path.join(userData, "security-cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  return cacheDir;
}

function getCacheFilePath(clusterId: string): string {
  const safeName = clusterId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(getCacheDir(), `${safeName}.json`);
}

/** Returns the most recently modified cache file path, or null if none exist. */
function getLatestCacheFilePath(): string | null {
  const cacheDir = getCacheDir();
  const files = fs.readdirSync(cacheDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) return null;
  const sorted = files
    .map((f) => ({ f, mtime: fs.statSync(path.join(cacheDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return path.join(cacheDir, sorted[0].f);
}

const securitySaveScanCacheHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-save-scan-cache-handler",
  channel: securitySaveScanCacheChannel,
  getHandler: () => {
    return async (req: SaveScanCacheRequest): Promise<SaveScanCacheResponse> => {
      try {
        const filePath = getCacheFilePath(req.clusterId);
        const data = JSON.stringify({ scanState: req.scanState, findings: req.findings });
        fs.writeFileSync(filePath, data, "utf-8");
        console.log(`[security-cache] Saved ${data.length} bytes to ${filePath}`);
        return { success: true };
      } catch (err) {
        console.error(`[security-cache] Failed to save cache for cluster ${req.clusterId}:`, err);
        return { success: false };
      }
    };
  },
});

const securityLoadScanCacheHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-load-scan-cache-handler",
  channel: securityLoadScanCacheChannel,
  getHandler: () => {
    return async (req: LoadScanCacheRequest): Promise<LoadScanCacheResponse> => {
      try {
        // If no clusterId provided, load the most recently modified cache file
        const filePath = req.clusterId ? getCacheFilePath(req.clusterId) : getLatestCacheFilePath();
        if (!filePath || !fs.existsSync(filePath)) return { found: false };
        const raw = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(raw) as { scanState: Record<string, unknown>; findings: unknown[] };
        return { found: true, scanState: data.scanState, findings: data.findings };
      } catch {
        return { found: false };
      }
    };
  },
});

const securityClearScanCacheHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-clear-scan-cache-handler",
  channel: securityClearScanCacheChannel,
  getHandler: () => {
    return async (req: ClearScanCacheRequest): Promise<SaveScanCacheResponse> => {
      try {
        const filePath = getCacheFilePath(req.clusterId);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return { success: true };
      } catch {
        return { success: false };
      }
    };
  },
});

// 캐시 TTL 무제한 — 스캔 결과는 영구 보존 (오래된 결과는 renderer에서 알러트로 안내)
const CACHE_TTL_MS = Infinity;

const securityLoadAllScanCachesHandlerInjectable = getRequestChannelListenerInjectable({
  id: "security-load-all-scan-caches-handler",
  channel: securityLoadAllScanCachesChannel,
  getHandler: () => {
    return async (req: LoadAllScanCachesRequest): Promise<LoadAllScanCachesResponse> => {
      try {
        const cacheDir = getCacheDir();
        const files = fs.readdirSync(cacheDir).filter((f) => f.endsWith(".json"));
        const ttl = req.ttlMs ?? CACHE_TTL_MS;
        const now = Date.now();
        const caches: CachedClusterEntry[] = [];
        for (const file of files) {
          const filePath = path.join(cacheDir, file);
          try {
            const stat = fs.statSync(filePath);
            // Skip files older than TTL
            if (now - stat.mtimeMs > ttl) continue;
            const raw = fs.readFileSync(filePath, "utf-8");
            const data = JSON.parse(raw) as { scanState: Record<string, unknown>; findings: unknown[] };
            const clusterId = data.scanState?.["_clusterId"] as string | undefined;
            if (!clusterId) continue;
            // Load cache regardless of status — always restore the latest result per cluster
            caches.push({
              clusterId,
              findings: data.findings ?? [],
              scanState: data.scanState,
              mtime: stat.mtimeMs,
            });
          } catch {
            // Skip corrupted or unreadable files
          }
        }
        return { caches };
      } catch {
        return { caches: [] };
      }
    };
  },
});

export {
  securityGetScannerStatusHandlerInjectable,
  securityRunScanHandlerInjectable,
  securityCancelScanHandlerInjectable,
  securitySaveScanCacheHandlerInjectable,
  securityLoadScanCacheHandlerInjectable,
  securityClearScanCacheHandlerInjectable,
  securityLoadAllScanCachesHandlerInjectable,
};
