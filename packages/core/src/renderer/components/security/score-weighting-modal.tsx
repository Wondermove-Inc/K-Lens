/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
/**
 * Purpose: Score Calculation Weighting Method modal
 * @packageDocumentation
 */
import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ScoreWeightingModalProps {
  open: boolean;
  onClose: () => void;
}

const SEVERITY_WEIGHTS = [
  { severity: "Critical", weight: 10, barColor: "bg-red-400 dark:bg-red-800/55" },
  { severity: "High", weight: 5, barColor: "bg-orange-400 dark:bg-orange-700/50" },
  { severity: "Medium", weight: 2, barColor: "bg-amber-400 dark:bg-amber-600/55" },
  { severity: "Low", weight: 1, barColor: "bg-green-500 dark:bg-green-400/70" },
  { severity: "Unknown", weight: 0.5, barColor: "bg-zinc-400 dark:bg-zinc-600/45" },
];

const SEV_COLOR: Record<string, string> = {
  Critical: "text-red-600 dark:text-red-400",
  High: "text-orange-500 dark:text-orange-400",
  Medium: "text-amber-500 dark:text-amber-400",
  Low: "text-green-600 dark:text-green-400",
  Unknown: "text-zinc-500 dark:text-zinc-400",
};

export const ScoreWeightingModal: React.FC<ScoreWeightingModalProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-lg border bg-background shadow-xl mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">Score Calculation Weighting Method</h2>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
          {/* Part 1 */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Overall Score Weighting
            </h3>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Component</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Scanner</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-3 py-2 font-medium">Platform Security</td>
                    <td className="px-3 py-2 text-muted-foreground">Kubescape</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-600 dark:text-blue-400">60%</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2 font-medium">Workload Security</td>
                    <td className="px-3 py-2 text-muted-foreground">Trivy</td>
                    <td className="px-3 py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">40%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <svg
                className="h-3.5 w-3.5 mt-0.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                Industry research consistently shows misconfiguration as a leading cause of cloud security incidents.{" "}
                <a
                  href="https://www.cybersecurity-insiders.com/wp-content/uploads/2021/06/2021-Cloud-Security-Report-Fortinet-Final-1-90309555.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  View Report ↗
                </a>
              </span>
            </div>
          </div>
          {/* Part 2 */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Severity Score Weighting
            </h3>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Severity</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Weight</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {SEVERITY_WEIGHTS.map(({ severity, weight, barColor }, i) => (
                    <tr key={severity} className={i > 0 ? "border-t" : ""}>
                      <td className={`px-3 py-2 font-semibold ${SEV_COLOR[severity]}`}>{severity}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{weight}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end">
                          <div
                            className={`h-1.5 rounded-full ${barColor}`}
                            style={{ width: `${(weight / 10) * 80}px` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Based on CVSS v3 severity classification standards.{" "}
              <a
                href="https://www.first.org/cvss/v3.1/specification-document"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                View Spec ↗
              </a>
              <br />
              Score formula: <span className="font-mono text-[11px]">1 − (Σ weight×count) / (max_weight × total)</span>
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
ScoreWeightingModal.displayName = "ScoreWeightingModal";
