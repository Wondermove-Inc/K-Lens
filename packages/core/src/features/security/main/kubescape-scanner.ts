/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Kubescape binary execution + JSON parsing implementation
 * Kubescape binary execution + JSON parsing
 *
 * Key content:
 * - `KubescapeScanner` class — implements SecurityScannerEngine interface
 * - Kubescape `scan framework allcontrols -o json` execution
 * - stdout JSON parsing → results delegated to kubescape-normalizer
 * - Timeout / cancellation (AbortSignal) handling
 * - Progress callback (onProgress)
 *
 * Kubescape JSON output structure:
 * ```json
 * {
 *   "summaryDetails": { ... },
 *   "results": [
 *     {
 *       "resourceID": "...",
 *       "controls": [
 *         {
 *           "controlID": "C-0002",
 *           "status": { "status": "failed" },
 *           "rules": [ { "name": "...", "failedPaths": [...] } ]
 *         }
 *       ]
 *     }
 *   ],
 *   "resources": [ { "resourceID": "...", "object": { "kind": "...", ... } } ]
 * }
 * ```
 *
 * @packageDocumentation
 */

import { spawn } from "child_process";
import { ScannerErrorType } from "../common/scanner-engine";
import { parseJsonAsync } from "./json-parse-worker";
import { normalizeKubescapeReport } from "./kubescape-normalizer";
import { StderrProgressTracker } from "./progress-parser";

import type { AnySecurityFinding } from "../../../common/security/security-finding";
import type {
  ScannerRunOptions,
  ScannerRunResult,
  ScannerStatus,
  SecurityScannerEngine,
} from "../common/scanner-engine";

// ============================================
// KubescapeScanner implementation
// ============================================

export class KubescapeScanner implements SecurityScannerEngine {
  readonly name = "kubescape";

  constructor(
    private readonly binaryPath: string,
    private readonly logger?: { warn: (msg: string) => void },
  ) {}

  // ——————————————————————————————
  // getStatus
  // ——————————————————————————————

  async getStatus(): Promise<ScannerStatus> {
    return new Promise((resolve) => {
      const proc = spawn(this.binaryPath, ["version"]);
      let stdout = "";

      proc.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          resolve({ name: this.name, available: false, binaryPath: this.binaryPath });
          return;
        }
        // kubescape version output example: "Kubescape version: v3.0.5"
        const versionMatch = stdout.match(/v?\d+\.\d+\.\d+/);
        resolve({
          name: this.name,
          available: true,
          version: versionMatch?.[0],
          binaryPath: this.binaryPath,
        });
      });

      proc.on("error", () => {
        resolve({ name: this.name, available: false, binaryPath: this.binaryPath });
      });
    });
  }

  // ——————————————————————————————
  // run
  // ——————————————————————————————

  async run(options: ScannerRunOptions): Promise<ScannerRunResult> {
    const { clusterId, kubeconfigPath, timeoutMs = 300_000, signal, onProgress, namespaces } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    signal?.addEventListener("abort", () => controller.abort());

    // Real-time stderr parsing to infer step-by-step progress
    const progressTracker = new StderrProgressTracker("kubescape", 5);
    onProgress?.({ percent: 5, message: "Starting Kubescape scan..." });

    // Timer-based automatic progress: +5% every 2 seconds (max 75%)
    let timerStopped = false; // Prevent callback re-entry after clearInterval
    const progressInterval = setInterval(() => {
      if (timerStopped) return;
      const next = progressTracker.advance(progressTracker.percent + 5);
      if (next !== null) {
        onProgress?.({ percent: next, message: "Kubescape scan in progress..." });
      }
    }, 2_000);

    // Kubescape NSA + MITRE framework scan
    // --format json: JSON output
    // --kubeconfig: cluster access
    // --verbose: include detailed resource information
    const args: string[] = [
      "scan",
      "framework",
      "nsa,mitre",
      "--format",
      "json",
      "--kubeconfig",
      kubeconfigPath,
      "--verbose",
    ];

    // Namespace filter (Kubescape supports --include-namespaces)
    if (namespaces && namespaces.length > 0) {
      args.push("--include-namespaces", namespaces.join(","));
    }

    return new Promise((resolve) => {
      const proc = spawn(this.binaryPath, args, {
        env: { ...process.env, KUBECONFIG: kubeconfigPath },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
        // stdout received = scan results arrived → lift tracker to 50 if below 50
        if (progressTracker.percent < 50) {
          progressTracker.process("Collecting results");
          onProgress?.({ percent: Math.max(progressTracker.percent, 50), message: "Collecting Kubescape results..." });
        }
      });

      proc.stderr.on("data", (d: Buffer) => {
        const chunk = d.toString();
        stderr += chunk;
        // Real-time parsing of stderr chunks to update monotonic progress
        const update = progressTracker.process(chunk);
        if (update) {
          onProgress?.({ percent: update.percent, message: update.message });
        }
      });

      proc.on("close", async (code) => {
        clearTimeout(timer);
        timerStopped = true;
        clearInterval(progressInterval);

        if (controller.signal.aborted) {
          resolve({
            success: false,
            error: {
              type: signal?.aborted ? ScannerErrorType.CANCELLED : ScannerErrorType.TIMEOUT,
              message: signal?.aborted ? "Scan cancelled." : `Scan timed out (${timeoutMs}ms)`,
            },
          });
          return;
        }

        // Kubescape may return exit code != 0 if vulnerabilities found
        // Attempt parsing if stdout is available
        if (!stdout && code !== 0) {
          resolve({
            success: false,
            error: {
              type: ScannerErrorType.EXECUTION_ERROR,
              message: stderr || `Kubescape process exited with code ${code}.`,
            },
          });
          return;
        }

        onProgress?.({ percent: 80, message: "Parsing Kubescape results..." });

        let raw: unknown;
        try {
          // parseJsonAsync — Worker Thread for parsing >10MB (Event Loop protection)
          raw = await parseJsonAsync(stdout, this.logger, "Kubescape");
        } catch (err) {
          resolve({
            success: false,
            error: {
              type: ScannerErrorType.PARSE_ERROR,
              message: "Failed to parse Kubescape JSON output.",
              cause: err,
            },
          });
          return;
        }

        const findings = this.normalize(raw, clusterId);

        onProgress?.({ percent: 100, message: "Scan complete", findingsSoFar: findings.length });

        resolve({
          success: true,
          result: {
            clusterId,
            findings,
            scannedAt: new Date().toISOString(),
            scannerVersion: undefined,
          },
        });
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: {
            type: ScannerErrorType.BINARY_NOT_FOUND,
            message: `Kubescape binary execution error: ${err.message}`,
            cause: err,
          },
        });
      });

      controller.signal.addEventListener("abort", () => {
        proc.kill("SIGTERM");
      });
    });
  }

  // ——————————————————————————————
  // normalize
  // ——————————————————————————————

  normalize(raw: unknown, clusterId: string): AnySecurityFinding[] {
    return normalizeKubescapeReport(raw, clusterId);
  }
}
