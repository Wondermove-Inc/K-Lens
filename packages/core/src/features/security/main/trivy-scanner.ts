/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Trivy binary execution + JSON parsing implementation
 * Trivy binary execution + JSON parsing
 *
 * Key content:
 * - `TrivyScanner` class — SecurityScannerEngine interface implementation
 * - Trivy `k8s --all-namespaces -o json` execution
 * - stdout JSON parsing → AnySecurityFinding conversion (normalize)
 * - timeout / cancel(AbortSignal) handling
 * - Progress callback (onProgress)
 *
 * Trivy k8s JSON output structure:
 * ```json
 * {
 *   "Results": [
 *     {
 *       "Target": "pod/my-pod (container: my-container)",
 *       "Type": "debian",
 *       "Vulnerabilities": [ { "VulnerabilityID": "CVE-...", ... } ],
 *       "Misconfigurations": [ { "ID": "KSV001", ... } ]
 *     }
 *   ]
 * }
 * ```
 *
 * @packageDocumentation
 */

import { spawn } from "child_process";
import { ScannerErrorType } from "../common/scanner-engine";
import { parseJsonAsync } from "./json-parse-worker";
import { StderrProgressTracker } from "./progress-parser";
import { normalizeTrivyReport } from "./trivy-normalizer";

import type { AnySecurityFinding } from "../../../common/security/security-finding";
import type {
  ScannerRunOptions,
  ScannerRunResult,
  ScannerStatus,
  SecurityScannerEngine,
} from "../common/scanner-engine";

// ============================================
// TrivyScanner implementation
// ============================================

export class TrivyScanner implements SecurityScannerEngine {
  readonly name = "trivy";

  constructor(
    private readonly binaryPath: string,
    private readonly logger?: { warn: (msg: string) => void },
  ) {}

  // ——————————————————————————————
  // getStatus
  // ——————————————————————————————

  async getStatus(): Promise<ScannerStatus> {
    return new Promise((resolve) => {
      const proc = spawn(this.binaryPath, ["version", "--format", "json"]);
      let stdout = "";

      proc.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          resolve({ name: this.name, available: false, binaryPath: this.binaryPath });
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as { Version?: string };
          resolve({
            name: this.name,
            available: true,
            version: parsed.Version,
            binaryPath: this.binaryPath,
          });
        } catch {
          resolve({ name: this.name, available: true, binaryPath: this.binaryPath });
        }
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
    const { clusterId, contextName, kubeconfigPath, timeoutMs = 600_000, signal, onProgress, namespaces } = options;

    // Create controller cancellable via AbortSignal or timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Link external signal
    signal?.addEventListener("abort", () => controller.abort());

    // infer step-by-step progress from real-time stderr parsing
    const progressTracker = new StderrProgressTracker("trivy", 5);
    onProgress?.({ percent: 5, message: "Starting Trivy scan..." });

    // Timer-based auto-increment: +5% every 2s (max 75%)
    // Shows progress to user even when no stderr patterns match
    let timerStopped = false; // Prevent callback re-entry after clearInterval
    const progressInterval = setInterval(() => {
      if (timerStopped) return;
      const next = progressTracker.advance(progressTracker.percent + 5);
      if (next !== null) {
        onProgress?.({ percent: next, message: "Trivy scan in progress..." });
      }
    }, 2_000);

    // trivy k8s [CONTEXT] --format json --report all
    // context uses contextName from kubeconfig (actual k8s context name)
    const args: string[] = [
      "k8s",
      contextName,
      "--format",
      "json",
      "--report",
      "all",
      "--timeout",
      `${Math.floor(timeoutMs / 1000)}s`,
      "--kubeconfig",
      kubeconfigPath,
      // node-collector Job often fails with BackoffLimitExceeded on arm64 clusters
      // (aquasec/node-collector image may be amd64-only, insufficient RBAC, etc.)
      // node-collector failure causes trivy to abort the entire scan, so disable it
      "--disable-node-collector",
    ];

    // Scan specific namespaces only
    if (namespaces && namespaces.length > 0) {
      args.push("--include-namespaces", namespaces.join(","));
    }

    return new Promise((resolve) => {
      const proc = spawn(this.binaryPath, args, {
        env: {
          ...process.env,
          KUBECONFIG: kubeconfigPath,
          // In environments without docker-credential-desktop in PATH (e.g. Docker Desktop not running)
          // Use empty DOCKER_CONFIG to prevent "error getting credentials"
          // trivy attempts anonymous scan without credential helper when DOCKER_CONFIG is empty
          DOCKER_CONFIG: "",
        },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
        // stdout received = scan result arrived → bump tracker to 50 if below
        if (progressTracker.percent < 50) {
          progressTracker.process("Collecting results");
          onProgress?.({ percent: Math.max(progressTracker.percent, 50), message: "Collecting scan results..." });
        }
      });

      proc.stderr.on("data", (d: Buffer) => {
        const chunk = d.toString();
        stderr += chunk;
        // parse stderr chunks in real-time for monotonically increasing progress
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

        if (code !== 0 && !stdout) {
          resolve({
            success: false,
            error: {
              type: ScannerErrorType.EXECUTION_ERROR,
              message: stderr || `Trivy process exited with code ${code}.`,
            },
          });
          return;
        }

        onProgress?.({ percent: 80, message: "Parsing scan results..." });

        let raw: unknown;
        try {
          // parseJsonAsync — offload to Worker Thread when >= 10MB (protect Event Loop)
          raw = await parseJsonAsync(stdout, this.logger, "Trivy");
        } catch (err) {
          resolve({
            success: false,
            error: {
              type: ScannerErrorType.PARSE_ERROR,
              message: "Failed to parse Trivy JSON output.",
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
            message: `Trivy binary execution error: ${err.message}`,
            cause: err,
          },
        });
      });

      // cancel handling
      controller.signal.addEventListener("abort", () => {
        proc.kill("SIGTERM");
      });
    });
  }

  // ——————————————————————————————
  // normalize
  // ——————————————————————————————

  normalize(raw: unknown, clusterId: string): AnySecurityFinding[] {
    return normalizeTrivyReport(raw, clusterId);
  }
}
