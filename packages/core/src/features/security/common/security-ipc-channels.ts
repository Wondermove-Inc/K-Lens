/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Security feature IPC channel constants and payload type definitions
 * IPC channel definition
 *
 * Channel design:
 * - RequestChannel (getRequestChannel): Renderer → Main request/response (invoke/handle)
 * - MessageChannel (getMessageChannel): Main → Renderer unidirectional push (broadcastMessage)
 *
 * Naming convention: `security:<domain>:<action>`
 *
 * @packageDocumentation
 */

import { getMessageChannel, getRequestChannel } from "@skuberplus/messaging";

import type { AnySecurityFinding } from "../../../common/security/security-finding";
import type { ScannerStatus } from "./scanner-engine";

// ============================================
// Payload types
// ============================================

/** `securityGetScannerStatusChannel` request payload */
export interface GetScannerStatusRequest {
  /** Name of scanner to query */
  scannerName: "trivy" | "kubescape";
}

/** `securityRunScanChannel` request payload */
export interface RunScanRequest {
  /** Cluster ID to scan */
  clusterId: string;
  /** kubeconfig context name (used as trivy k8s CONTEXT argument) */
  contextName: string;
  /** kubeconfig file path */
  kubeconfigPath: string;
  /** Scanner to use */
  scanner: "trivy" | "kubescape" | "all";
  /** List of namespaces to scan (all if empty) */
  namespaces?: string[];
  /** Scan timeout ms (default: 300_000) */
  timeoutMs?: number;
  /**
   * Used when retrying only timed out namespaces.
   * When specified, only those ns are rescanned with trivy + merged with existing findings.
   * timeoutMs is automatically doubled.
   */
  retryNamespaces?: string[];
  /**
   * Scanner concurrent execution mode (applies only when scanner='all')
   * - sequential: Sequential execution (default, safe for low-spec PCs)
   * - parallel:   Parallel execution (prioritizes speed for high-spec PCs)
   * @default 'sequential'
   */
  scanMode?: "sequential" | "parallel";
}

/** `securityRunScanChannel` response payload */
export interface RunScanResponse {
  success: boolean;
  /** Scan execution ID (used for cancellation) */
  scanId: string;
  /** Error message on failure */
  error?: string;
}

/** `securityCancelScanChannel` request payload */
export interface CancelScanRequest {
  /** Scan execution ID to cancel */
  scanId: string;
}

/** `securityCancelScanChannel` response payload */
export interface CancelScanResponse {
  success: boolean;
}

/** `securityScanProgressChannel` push payload */
export interface ScanProgressPayload {
  scanId: string;
  clusterId: string;
  /** Progress percentage 0~100 */
  percent: number;
  /** Human-readable status message */
  message: string;
  /** Number of findings discovered so far */
  findingsSoFar?: number;
  scanner: "trivy" | "kubescape";
  /** List of namespaces timed out so far (updated during Trivy namespace split scan) */
  timedOutNamespaces?: string[];
}

/** `securityScanCompleteChannel` push payload */
export interface ScanCompletePayload {
  scanId: string;
  clusterId: string;
  findings: AnySecurityFinding[];
  scannedAt: string;
  scanner: "trivy" | "kubescape";
  /**
   * When true, this is a partial findings update (e.g. per-namespace Trivy result).
   * The store merges findings but does NOT change scan status or completedScanners.
   * Only the final complete event (partial=false/undefined) advances the state machine.
   */
  partial?: boolean;
}

/** `securityScanErrorChannel` push payload */
export interface ScanErrorPayload {
  scanId: string;
  clusterId: string;
  errorType: string;
  message: string;
  scanner: "trivy" | "kubescape";
  /** Timed out namespace (recorded during Trivy namespace split scan) */
  namespace?: string;
}

// ============================================
// RequestChannel — Pull (invoke/handle)
// ============================================

/** Query scanner status */
export const securityGetScannerStatusChannel = getRequestChannel<GetScannerStatusRequest, ScannerStatus>(
  "security:scanner:get-status",
);

/** Request to run security scan */
export const securityRunScanChannel = getRequestChannel<RunScanRequest, RunScanResponse>("security:scan:run");

/** Request to cancel scan */
export const securityCancelScanChannel = getRequestChannel<CancelScanRequest, CancelScanResponse>(
  "security:scan:cancel",
);

// ============================================
// MessageChannel — Push (Main → Renderer)
// ============================================

/** Scan progress status update */
export const securityScanProgressChannel = getMessageChannel<ScanProgressPayload>("security:scan:progress");

/** Scan complete (with results) */
export const securityScanCompleteChannel = getMessageChannel<ScanCompletePayload>("security:scan:complete");

/** Scan error */
export const securityScanErrorChannel = getMessageChannel<ScanErrorPayload>("security:scan:error");

// ============================================
// Cache channels — persist scan results across app restarts
// ============================================

/** Payload to save scan results to disk */
export interface SaveScanCacheRequest {
  clusterId: string;
  scanState: Record<string, unknown>;
  findings: unknown[];
}

/** Response from save */
export interface SaveScanCacheResponse {
  success: boolean;
}

/** Request to load cached scan results.
 * If clusterId is omitted, the most recently modified cache file is loaded. */
export interface LoadScanCacheRequest {
  clusterId?: string;
}

/** Cached data returned from disk */
export interface LoadScanCacheResponse {
  found: boolean;
  scanState?: Record<string, unknown>;
  findings?: unknown[];
}

/** Save scan results to main process file cache */
export const securitySaveScanCacheChannel = getRequestChannel<SaveScanCacheRequest, SaveScanCacheResponse>(
  "security:scan:save-cache",
);

/** Load cached scan results from main process */
export const securityLoadScanCacheChannel = getRequestChannel<LoadScanCacheRequest, LoadScanCacheResponse>(
  "security:scan:load-cache",
);

/** Request to clear a specific cluster's scan cache (clusterId required) */
export interface ClearScanCacheRequest {
  clusterId: string;
}

/** Clear scan cache */
export const securityClearScanCacheChannel = getRequestChannel<ClearScanCacheRequest, SaveScanCacheResponse>(
  "security:scan:clear-cache",
);

// ============================================
// Load all cluster caches — for multi-cluster restore on startup
// ============================================

/** One restored cache entry per cluster */
export interface CachedClusterEntry {
  clusterId: string;
  findings: unknown[];
  scanState: Record<string, unknown>;
  /** mtime of cache file in ms — used to pick most-recent scanState */
  mtime: number;
}

export interface LoadAllScanCachesRequest {
  /** TTL in ms — cache files older than this are skipped. Default: 7 days */
  ttlMs?: number;
}

export interface LoadAllScanCachesResponse {
  caches: CachedClusterEntry[];
}

/** Load all cluster scan caches from disk (multi-cluster restore on startup) */
export const securityLoadAllScanCachesChannel = getRequestChannel<LoadAllScanCachesRequest, LoadAllScanCachesResponse>(
  "security:scan:load-all-caches",
);
