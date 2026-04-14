/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Security scanner engine abstraction interface
 * Scan engine abstraction interface design
 *
 * Key content:
 * - `SecurityScanner` abstract interface — Common contract for Trivy·Kubescape
 * - `ScannerRunOptions` — Scan execution options
 * - `ScannerRunResult` — Scan execution result (success/failure union)
 * - `ScannerStatus` — Scanner readiness state
 * - `ScanProgressCallback` — Real-time progress callback type
 *
 * Design principles:
 * - Strategy pattern — Scanner implementation can be swapped at runtime
 * - Result type — Explicit success/failure return instead of throwing
 * - Cancellable (AbortSignal) — UX improvement for long-running scans
 *
 * @packageDocumentation
 */

import type { AnySecurityFinding, ScanResult } from "../../../common/security/security-finding";

// ============================================
// Scan execution options
// ============================================

export interface ScannerRunOptions {
  /** Target cluster ID for scan */
  clusterId: string;

  /** kubeconfig context name (used as trivy k8s CONTEXT argument) */
  contextName: string;

  /** kubeconfig file path */
  kubeconfigPath: string;

  /** Scan timeout (ms, default: 300_000) */
  timeoutMs?: number;

  /** Scan cancellation signal */
  signal?: AbortSignal;

  /** Real-time progress callback */
  onProgress?: ScanProgressCallback;

  /** Target namespaces to scan (all if unspecified) */
  namespaces?: string[];

  /**
   * Scanner concurrent execution mode (applies only when scanner='all')
   * - sequential: Trivy → Kubescape executed sequentially (default, safe for low-spec PCs)
   * - parallel:   Promise.all parallel execution (fast for high-spec PCs)
   * @default 'sequential'
   */
  scanMode?: "sequential" | "parallel";
}

// ============================================
// Progress callback
// ============================================

export type ScanProgressCallback = (progress: ScanProgress) => void;

export interface ScanProgress {
  /** Progress percentage 0 ~ 100 */
  percent: number;

  /** Current step message */
  message: string;

  /** Number of findings discovered so far */
  findingsSoFar?: number;
}

// ============================================
// Scan execution result (Result type)
// ============================================

export type ScannerRunResult = ScannerRunSuccess | ScannerRunFailure;

export interface ScannerRunSuccess {
  success: true;
  result: ScanResult;
}

export interface ScannerRunFailure {
  success: false;
  error: ScannerError;
}

// ============================================
// Scanner error type
// ============================================

export interface ScannerError {
  /** Error type */
  type: ScannerErrorType;

  /** Human-readable message */
  message: string;

  /** Original error (optional) */
  cause?: unknown;
}

export enum ScannerErrorType {
  /** Binary not found */
  BINARY_NOT_FOUND = "BINARY_NOT_FOUND",

  /** Process error during scan execution */
  EXECUTION_ERROR = "EXECUTION_ERROR",

  /** Failed to parse scan results */
  PARSE_ERROR = "PARSE_ERROR",

  /** Timeout */
  TIMEOUT = "TIMEOUT",

  /** Cancelled by user */
  CANCELLED = "CANCELLED",

  /** kubeconfig access error */
  KUBECONFIG_ERROR = "KUBECONFIG_ERROR",

  /** Unknown error */
  UNKNOWN = "UNKNOWN",
}

// ============================================
// Scanner status
// ============================================

export interface ScannerStatus {
  /** Scanner name */
  name: string;

  /** Binary availability */
  available: boolean;

  /** Binary version (if available) */
  version?: string;

  /** Binary path */
  binaryPath?: string;
}

// ============================================
// Scanner engine abstraction interface (Strategy pattern)
// ============================================

/**
 * Common interface that all security scanners must implement.
 *
 * Trivy (`TrivyScanner`) and Kubescape (`KubescapeScanner`) implement this interface.
 *
 * @example
 * ```ts
 * const scanner: SecurityScannerEngine = new TrivyScanner();
 * const result = await scanner.run({ clusterId, kubeconfigPath });
 *
 * if (result.success) {
 *   console.log(result.result.findings);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export interface SecurityScannerEngine {
  /**
   * Scanner unique name (e.g., "trivy", "kubescape")
   */
  readonly name: string;

  /**
   * Check scanner binary readiness status.
   */
  getStatus(): Promise<ScannerStatus>;

  /**
   * Execute cluster security scan.
   *
   * @param options - Scan options
   * @returns Result type containing `ScanResult` on success or `ScannerError` on failure
   */
  run(options: ScannerRunOptions): Promise<ScannerRunResult>;

  /**
   * Normalize findings list to unified `AnySecurityFinding` format.
   * Converts each scanner's raw JSON output to common type.
   *
   * @param raw - Parsed scanner raw JSON result
   * @param clusterId - Target cluster ID for scan
   */
  normalize(raw: unknown, clusterId: string): AnySecurityFinding[];
}

// ============================================
// Type guards
// ============================================

export const isScannerSuccess = (result: ScannerRunResult): result is ScannerRunSuccess => result.success === true;

export const isScannerFailure = (result: ScannerRunResult): result is ScannerRunFailure => result.success === false;
