/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: NSA·MITRE Compliance Overview map
 * NSA·MITRE compliance map implementation
 *
 *  Key features:
 * - Aggregates findings by source: Trivy (CVE) / Kubescape (Misconfig·RBAC)
 * - Displays severity distribution progress bar per source
 * - Calculates pass rate (%): (total - Critical·High) / total × 100
 * - Handles pre/post-scan status UI
 *
 *  Compliance framework classification:
 * - NSA/MITRE framework info is not included in findings
 *   → Replaced with per-source aggregation: Trivy (container vulns) / Kubescape (Config Compliance)
 *
 * @packageDocumentation
 */

import { Card, CardContent, CardHeader, CardTitle } from "@skuberplus/storybook-shadcn/src/components/ui/card";
import { ShieldCheck } from "lucide-react";
import React, { useMemo } from "react";
import {
  type AnySecurityFinding,
  FindingType,
  ScannerSource,
  Severity,
} from "../../../common/security/security-finding";

import type { ScanStatus } from "../../../features/security/renderer/security-scan-store";

// ============================================
//  Constants
// ============================================

const SEVERITY_COLOR_CLASS: Record<Severity, string> = {
  [Severity.Critical]: "bg-red-400 text-black dark:bg-red-800/55 dark:text-red-100",
  [Severity.High]: "bg-orange-400 text-black dark:bg-orange-700/50 dark:text-orange-100",
  [Severity.Medium]: "bg-amber-400 text-black dark:bg-amber-600/55 dark:text-amber-100/90",
  [Severity.Low]: "bg-green-400 text-black dark:bg-green-700/55 dark:text-green-100/90",
  [Severity.Unknown]: "bg-zinc-400 text-black dark:bg-zinc-600/45 dark:text-zinc-200/80",
};

const SEVERITY_ORDER: Severity[] = [Severity.Critical, Severity.High, Severity.Medium, Severity.Low, Severity.Unknown];

const SEVERITY_LABEL: Record<Severity, string> = {
  [Severity.Critical]: "C",
  [Severity.High]: "H",
  [Severity.Medium]: "M",
  [Severity.Low]: "L",
  [Severity.Unknown]: "U",
};

// ============================================
//  Per-source aggregation types
// ============================================

interface SourceSummary {
  label: string;
  description: string;
  total: number;
  bySeverity: Record<Severity, number>;
  passRate: number; // 0~100
}

// ============================================
//  Props
// ============================================

export interface SecurityComplianceMapProps {
  /** scan status */
  status: ScanStatus;
  /** Full finding list */
  findings: AnySecurityFinding[];
  /** Called on section click — syncs FindingsTable type filter (null = clear filter) */
  onTypeClick?: (type: FindingType | null) => void;
}

// ============================================
//  Aggregation helper
// ============================================

function summarizeBySource(findings: AnySecurityFinding[]): SourceSummary[] {
  const trivyFindings = findings.filter((f) => f.source === ScannerSource.Trivy);
  const kubescapeFindings = findings.filter((f) => f.source === ScannerSource.Kubescape);

  const makeSummary = (label: string, description: string, list: AnySecurityFinding[]): SourceSummary => {
    const bySeverity = Object.fromEntries(SEVERITY_ORDER.map((sev) => [sev, 0])) as Record<Severity, number>;

    for (const f of list) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }

    const criticalAndHigh = (bySeverity[Severity.Critical] ?? 0) + (bySeverity[Severity.High] ?? 0);
    const passRate = list.length === 0 ? 100 : Math.round(((list.length - criticalAndHigh) / list.length) * 100);

    return { label, description, total: list.length, bySeverity, passRate };
  };

  return [
    makeSummary("Container Security", "Trivy — CVE Vulnerabilities", trivyFindings),
    makeSummary("Configuration Compliance", "Kubescape — NSA·MITRE Based", kubescapeFindings),
  ];
}

// ============================================
//  SecurityComplianceMap component
// ============================================

export const SecurityComplianceMap: React.FC<SecurityComplianceMapProps> = ({ status, findings, onTypeClick }) => {
  const summaries = useMemo(() => summarizeBySource(findings), [findings]);
  // Trivy = CVE, Kubescape = MISCONFIGURATION+RBAC → click sets type filter
  const SOURCE_TYPE_MAP: Record<string, FindingType | null> = {
    "Container Security": FindingType.CVE,
    "Configuration Compliance": FindingType.Misconfiguration,
  };
  const isReady = status === "complete";

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-slate-500/75" />
          <CardTitle className="text-base font-semibold">Compliance Overview</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {status === "idle" && <CompliancePlaceholder message="Run a scan to see compliance status" />}
        {status === "scanning" && <CompliancePlaceholder message="Analyzing..." pulse />}
        {status === "error" && <CompliancePlaceholder message="An error occurred during scanning" />}
        {isReady && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {summaries.map((summary) => (
              <SourceCard
                key={summary.label}
                summary={summary}
                onClick={onTypeClick ? () => onTypeClick(SOURCE_TYPE_MAP[summary.label] ?? null) : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

SecurityComplianceMap.displayName = "SecurityComplianceMap";

// ============================================
//  Placeholder
// ============================================

interface CompliancePlaceholderProps {
  message: string;
  pulse?: boolean;
}

const CompliancePlaceholder: React.FC<CompliancePlaceholderProps> = ({ message, pulse }) => (
  <div
    className={`flex items-center justify-center h-24 text-sm text-muted-foreground text-center ${
      pulse ? "animate-pulse" : ""
    }`}
  >
    {message}
  </div>
);

// ============================================
//  Per-source card
// ============================================

interface SourceCardProps {
  summary: SourceSummary;
  onClick?: () => void;
}

const SourceCard: React.FC<SourceCardProps> = ({ summary, onClick }) => {
  const { label, description, total, bySeverity, passRate } = summary;

  // Pass rate color
  const passColor =
    passRate >= 80
      ? "text-green-600 dark:text-green-400"
      : passRate >= 60
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-2${onClick ? " cursor-pointer hover:bg-accent/40 hover:ring-1 hover:ring-border transition-colors" : ""}`}
      onClick={onClick}
      title={onClick ? `Filter findings by ${label}` : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <div className={`text-xl font-bold tabular-nums ${passColor}`}>{passRate}%</div>
      </div>

      {/* Progress bar: severity ratio */}
      {total > 0 ? (
        <>
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            {SEVERITY_ORDER.map((sev) => {
              const count = bySeverity[sev] ?? 0;
              const pct = (count / total) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={sev}
                  className={`${SEVERITY_COLOR_CLASS[sev]} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${SEVERITY_LABEL[sev]}: ${count}`}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {SEVERITY_ORDER.map((sev) => {
              const count = bySeverity[sev] ?? 0;
              if (count === 0) return null;
              return (
                <span key={sev} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className={`inline-block h-2 w-2 rounded-sm ${SEVERITY_COLOR_CLASS[sev]}`} />
                  {SEVERITY_LABEL[sev]} {count}
                </span>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-xs text-emerald-700/80 dark:text-emerald-600/75">No vulnerabilities</div>
      )}

      {/* Total count */}
      <div className="text-xs text-muted-foreground text-right">{total.toLocaleString()} total</div>
    </div>
  );
};
