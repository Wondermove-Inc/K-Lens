/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Infer progress from scanner stderr log
 * infer step-by-step progress via stderr regex parsing
 *
 * Key content:
 * - Trivy stderr log pattern → progress mapping
 * - Kubescape stderr log pattern → progress mapping
 * - monotonic increase guaranteed (values lower than previous are ignored)
 * - 0~100 range clamping
 *
 * @packageDocumentation
 */

// ============================================
// Trivy stderr pattern → progress mapping
// ============================================

/** Trivy stderr pattern progress rules */
const TRIVY_STDERR_RULES: Array<{ pattern: RegExp; percent: number; message: string }> = [
  // initialization / setting
  { pattern: /Fetching|Loading|Initializing|Preparing/i, percent: 10, message: "Initializing Trivy..." },
  // Cluster connection
  { pattern: /Scanning cluster|Connecting|cluster/i, percent: 15, message: "Connecting to cluster..." },
  // Namespace/resource enumeration
  { pattern: /namespace|resource|Listing|Enumerating/i, percent: 25, message: "Enumerating resources..." },
  // Image pull/scan start
  { pattern: /Pulling|Downloading|image|container/i, percent: 35, message: "Preparing image scan..." },
  // Vulnerability DB update
  { pattern: /vuln|CVE|database|DB/i, percent: 45, message: "Checking vulnerability DB..." },
  // scan progress
  { pattern: /Scanning|Analyzing|Processing/i, percent: 55, message: "Scanning for vulnerabilities..." },
  // Result aggregation
  { pattern: /Aggregating|Collecting|Summarizing/i, percent: 65, message: "Aggregating results..." },
  // Just before output
  { pattern: /Writing|Generating|Output|Report/i, percent: 72, message: "Generating report..." },
];

// ============================================
// Kubescape stderr pattern → progress mapping
// ============================================

/** Kubescape stderr pattern progress rules */
const KUBESCAPE_STDERR_RULES: Array<{ pattern: RegExp; percent: number; message: string }> = [
  // initialization
  { pattern: /Initializing|Loading|Preparing|Starting/i, percent: 10, message: "Initializing Kubescape..." },
  // Framework load
  { pattern: /framework|control|policy|rule/i, percent: 20, message: "Loading security framework..." },
  // cluster scan start
  { pattern: /Scanning|cluster|resource/i, percent: 30, message: "Scanning cluster resources..." },
  // Per-resource check
  { pattern: /Checking|Validating|Evaluating/i, percent: 45, message: "Evaluating security policies..." },
  // RBAC analysis
  { pattern: /RBAC|permission|access|role/i, percent: 55, message: "Analyzing RBAC rules..." },
  // Network policy
  { pattern: /network|policy|ingress|egress/i, percent: 62, message: "Checking network policies..." },
  // Result calculation
  { pattern: /Calculating|Score|Result|Summary/i, percent: 70, message: "Calculating security score..." },
];

// ============================================
// ProgressTracker — monotonic increase guarantee
// ============================================

/**
 * Tracks progress by parsing the stderr stream in real-time.
 * Monotonic increase guaranteed: progress values lower than the current are ignored.
 */
export class StderrProgressTracker {
  private _percent: number;
  private readonly rules: Array<{ pattern: RegExp; percent: number; message: string }>;

  constructor(scannerName: "trivy" | "kubescape", initialPercent = 5) {
    this._percent = initialPercent;
    this.rules = scannerName === "trivy" ? TRIVY_STDERR_RULES : KUBESCAPE_STDERR_RULES;
  }

  /** Current progress */
  get percent(): number {
    return this._percent;
  }

  /**
   * Used to force-advance progress from external sources (e.g. timer).
   * Monotonic increase: ignored if lower than current.
   */
  advance(percent: number): number | null {
    const clamped = Math.min(Math.max(percent, 0), 79);
    if (clamped > this._percent) {
      this._percent = clamped;
      return clamped;
    }
    return null;
  }

  /**
   * Handles a stderr data chunk and returns progress and message.
   * Returns null if no pattern matches or monotonic increase condition not met.
   *
   * @param chunk - stderr data chunk
   * @returns progress update info or null
   */
  process(chunk: string): { percent: number; message: string } | null {
    for (const rule of this.rules) {
      if (rule.pattern.test(chunk)) {
        const clamped = Math.min(Math.max(rule.percent, 0), 79); // max 79% (80% is reserved for parsing stage)
        if (clamped > this._percent) {
          this._percent = clamped;
          return { percent: clamped, message: rule.message };
        }
        // Pattern matched but monotonic increase not satisfied → null
        return null;
      }
    }
    return null;
  }
}
