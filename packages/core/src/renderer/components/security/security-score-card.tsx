/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: Security score card component
 * Security score card component (0–100, grade, color)
 * UX improvements
 *
 *  Key features:
 * - Visualizes SecurityScore (score, grade, breakdown) as a card
 * - Grade colors: A(blue)/B(green)/C(amber)/D(orange)/F(red)
 * - UI branches by status: idle/scanning/complete/error
 * - Rescan button + Last scanned time in CardHeader
 * - Compliance Overview rendered inline below score
 * - Platform/Workload score click navigation
 * - Confirmation dialogs for all scan triggers
 * - Score Calculation Weighting Method modal
 *
 * @packageDocumentation
 */

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@skuberplus/storybook-shadcn/src/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skuberplus/storybook-shadcn/src/components/ui/table";
import { observer } from "mobx-react";
import React, { useMemo, useState } from "react";
import {
  type AnySecurityFinding,
  FindingType,
  ScannerSource,
  Severity,
} from "../../../common/security/security-finding";
import { SecurityGrade, type SecurityScore } from "../../../common/security/security-score";
import { type ScanStatus } from "../../../features/security/renderer/security-scan-store";
import { ConfirmScanDialog } from "./confirm-scan-dialog";
import { ScoreWeightingModal } from "./score-weighting-modal";

// ============================================
//  Grade color mapping
// ============================================

// Grade color scheme improvement
const GRADE_COLOR: Record<SecurityGrade, string> = {
  [SecurityGrade.A]: "text-blue-600 dark:text-blue-400",
  [SecurityGrade.B]: "text-green-600 dark:text-green-400",
  [SecurityGrade.C]: "text-amber-600 dark:text-amber-500",
  [SecurityGrade.D]: "text-orange-500 dark:text-orange-400",
  [SecurityGrade.F]: "text-red-600 dark:text-red-400",
};

const GRADE_BG: Record<SecurityGrade, string> = {
  [SecurityGrade.A]: "bg-blue-50 dark:bg-blue-900/30",
  [SecurityGrade.B]: "bg-green-50 dark:bg-green-900/30",
  [SecurityGrade.C]: "bg-amber-50 dark:bg-amber-900/30",
  [SecurityGrade.D]: "bg-orange-50 dark:bg-orange-900/25",
  [SecurityGrade.F]: "bg-red-50 dark:bg-red-900/30",
};

const GRADE_HIGHLIGHT_BORDER: Record<SecurityGrade, string> = {
  [SecurityGrade.A]: "border-l-4 border-l-blue-500 dark:border-l-blue-400",
  [SecurityGrade.B]: "border-l-4 border-l-green-500 dark:border-l-green-400",
  [SecurityGrade.C]: "border-l-4 border-l-amber-500 dark:border-l-amber-400",
  [SecurityGrade.D]: "border-l-4 border-l-orange-500 dark:border-l-orange-400",
  [SecurityGrade.F]: "border-l-4 border-l-red-700 dark:border-l-red-500",
};

// Score threshold and description per grade
const GRADE_CRITERIA: Record<SecurityGrade, { range: string; label: string; desc: string }> = {
  [SecurityGrade.A]: { range: "100", label: "Perfect", desc: "No security findings detected" },
  [SecurityGrade.B]: { range: "85~99.9", label: "Needs Attention", desc: "Some findings require your attention." },
  [SecurityGrade.C]: { range: "70~84", label: "Moderate Risk", desc: "Moderate risks present" },
  [SecurityGrade.D]: { range: "50~69", label: "High Risk", desc: "Immediate action recommended" },
  [SecurityGrade.F]: { range: "0~49", label: "Critical Risk", desc: "Severe vulnerabilities present" },
};

const SEVERITY_COLOR: Record<Severity, string> = {
  [Severity.Critical]: "bg-red-400 text-black dark:bg-red-800/55 dark:text-red-100",
  [Severity.High]: "bg-orange-400 text-black dark:bg-orange-700/50 dark:text-orange-100",
  [Severity.Medium]: "bg-amber-400 text-black dark:bg-amber-600/55 dark:text-amber-100/90",
  [Severity.Low]: "bg-green-500 text-black dark:bg-green-800/55 dark:text-green-100/90",
  [Severity.Unknown]: "bg-zinc-400 text-black dark:bg-zinc-600/45 dark:text-zinc-200/80",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  [Severity.Critical]: "Critical",
  [Severity.High]: "High",
  [Severity.Medium]: "Medium",
  [Severity.Low]: "Low",
  [Severity.Unknown]: "Unknown",
};

const SEVERITY_SHORT: Record<Severity, string> = {
  [Severity.Critical]: "C",
  [Severity.High]: "H",
  [Severity.Medium]: "M",
  [Severity.Low]: "L",
  [Severity.Unknown]: "U",
};

const SEVERITY_ORDER_ARR = [Severity.Critical, Severity.High, Severity.Medium, Severity.Low, Severity.Unknown] as const;

// ============================================
// Dialog state type
// ============================================

type DialogCase = "rescan" | "timeout" | "error" | null;

// ============================================
// Helper: format scannedAt
// ============================================

function formatScannedAt(isoString: string): string {
  try {
    const d = new Date(isoString);
    const date = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${date} ${time}`;
  } catch {
    return isoString;
  }
}

// ============================================
//  Props
// ============================================

export interface SecurityScoreCardProps {
  /** Current scan status */
  status: ScanStatus;
  /** Overall combined score (valid only when status=complete) */
  score: SecurityScore | null;
  /** Platform score — Kubescape (Misconfig + RBAC) */
  platformScore?: SecurityScore | null;
  /** Workload score — Trivy (CVE) */
  workloadScore?: SecurityScore | null;
  /** Scan progress 0–100 (displayed when status=scanning) */
  progress?: number;
  /** Error message (displayed when status=error) */
  errorMessage?: string;
  /** Called on SeverityBreakdown bar click — syncs FindingsTable severity filter */
  onSeverityClick?: (severity: Severity) => void;
  /** Timed-out scanners — for UI warning display */
  timedOutScanners?: Array<"trivy" | "kubescape">;
  /** Timed-out namespaces from Trivy ns-split scan */
  timedOutNamespaces?: string[];
  /** Called when user confirms retry for incomplete namespaces */
  onRetryNamespaces?: () => void;
  /** Called when user confirms a full rescan */
  onRescan?: () => void;
  /** ISO string of last completed scan time */
  scannedAt?: string | null;
  /** Called on Platform score click — scroll+highlight RBAC panel */
  onPlatformScoreClick?: () => void;
  /** Called on Workload score click — scroll+highlight CVE chart */
  onWorkloadScoreClick?: () => void;
  /** All findings for inline Compliance Overview */
  findings?: AnySecurityFinding[];
  /** Compliance type click callback — syncs FindingsTable type filter */
  onComplianceTypeClick?: (type: FindingType | null) => void;
  /** Called when user clicks AI Auto Fix button */
  onAiFix?: (findings: AnySecurityFinding[]) => void;
}

// ============================================
//  SecurityScoreCard component
// ============================================

export const SecurityScoreCard: React.FC<SecurityScoreCardProps> = observer(
  ({
    status,
    score,
    platformScore,
    workloadScore,
    progress = 0,
    errorMessage,
    onSeverityClick,
    timedOutScanners = [],
    timedOutNamespaces = [],
    onRetryNamespaces,
    onRescan,
    scannedAt,
    onAiFix,
    onPlatformScoreClick,
    onWorkloadScoreClick,
    findings = [],
    onComplianceTypeClick,
  }) => {
    const [dialogCase, setDialogCase] = useState<DialogCase>(null);
    const [weightingOpen, setWeightingOpen] = useState(false);

    const isScanning = status === "scanning";
    const isError = status === "error";
    const showHeaderActions = (status === "complete" || isError || !!scannedAt) && !isScanning;

    const handleDialogConfirm = () => {
      if (dialogCase === "rescan" || dialogCase === "error") onRescan?.();
      else if (dialogCase === "timeout") onRetryNamespaces?.();
      setDialogCase(null);
    };

    const dialogConfigs: Record<
      Exclude<DialogCase, null>,
      { title: string; description: string; detail?: string; confirmLabel: string }
    > = {
      rescan: {
        title: "Rescan Cluster?",
        description: "This will clear current results and start a fresh scan. It may take a few minutes.",
        confirmLabel: "Confirm Rescan",
      },
      timeout: {
        title: "Retry Incomplete Namespaces?",
        description: "Some namespaces timed out during the scan. Retry scanning only the failed namespaces?",
        detail: timedOutNamespaces.length > 0 ? timedOutNamespaces.join(", ") : undefined,
        confirmLabel: "Retry Failed Namespaces",
      },
      error: {
        title: "Retry Scan?",
        description: "Previous scan encountered an error. Would you like to retry?",
        confirmLabel: "Retry",
      },
    };

    return (
      <>
        <Card className="w-full h-full flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Left: icon + title + ℹ weighting button */}
              <div className="flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-blue-500/70 shrink-0" />
                <svg
                  className="h-5 w-5 text-blue-500/70"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <CardTitle className="text-base font-semibold">Security Score</CardTitle>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer"
                  onClick={() => setWeightingOpen(true)}
                  aria-label="Score calculation weighting method"
                  title="Score Calculation Weighting Method"
                >
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Score Info</span>
                </button>
              </div>
              {/* Right: Last scanned + Rescan */}
              {showHeaderActions && (
                <div className="flex items-center gap-2 flex-wrap">
                  {scannedAt && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Last scanned: {formatScannedAt(scannedAt)}
                    </span>
                  )}
                  {onAiFix && (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-500/85 text-white"
                      onClick={() => onAiFix([])}
                      aria-label="AI Assistant"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <rect x="3" y="11" width="18" height="10" rx="2" />
                        <circle cx="12" cy="5" r="2" />
                        <path d="M12 7v4" />
                        <line x1="8" y1="16" x2="8" y2="16" />
                        <line x1="16" y1="16" x2="16" y2="16" />
                      </svg>
                      AI Assistant
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    className="flex items-center gap-1.5"
                    onClick={() => setDialogCase(isError ? "error" : "rescan")}
                    aria-label="Rescan"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M23 4v6h-6" />
                      <path d="M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                    </svg>
                    Rescan
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {status === "idle" && <IdleState />}
            {status === "scanning" && <ScanningState progress={progress} />}
            {(status === "complete" || status === "error") && score && (
              <CompleteState
                score={score}
                platformScore={platformScore ?? null}
                workloadScore={workloadScore ?? null}
                onSeverityClick={onSeverityClick}
                onPlatformScoreClick={onPlatformScoreClick}
                onWorkloadScoreClick={onWorkloadScoreClick}
                findings={findings}
                onComplianceTypeClick={onComplianceTypeClick}
                timedOutNamespaces={timedOutNamespaces}
                onRetryNamespaces={onRetryNamespaces ? () => setDialogCase("timeout") : undefined}
              />
            )}
            {/* U-3: Timeout warning moved inside CompleteState (below grade criteria) */}
            {/* timedOutScanners warning for scanner-level timeout (no specific namespaces) */}
            {(status === "complete" || status === "error") &&
              timedOutScanners.includes("trivy") &&
              timedOutNamespaces.length === 0 && (
                <div className="flex items-start gap-1.5 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 px-2.5 py-1.5 text-xs text-orange-700 dark:text-orange-400">
                  <svg
                    className="h-3.5 w-3.5 mt-0.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Trivy scan timed out — container vulnerability results may be incomplete.</span>
                </div>
              )}
            {status === "error" && !score && <ErrorState message={errorMessage} />}
          </CardContent>
        </Card>

        {/* Confirmation dialog */}
        {dialogCase && (
          <ConfirmScanDialog
            open={true}
            {...dialogConfigs[dialogCase]}
            onConfirm={handleDialogConfirm}
            onCancel={() => setDialogCase(null)}
          />
        )}

        {/* Score weighting modal */}
        <ScoreWeightingModal open={weightingOpen} onClose={() => setWeightingOpen(false)} />
      </>
    );
  },
);

SecurityScoreCard.displayName = "SecurityScoreCard";

// ============================================
//  Status-based sub-components
// ============================================

const IdleState: React.FC = () => (
  <div className="flex flex-col items-center py-6 text-muted-foreground">
    <span className="text-4xl font-bold text-muted-foreground/40">--</span>
    <span className="mt-2 text-sm">Run a scan to get started</span>
  </div>
);

const ScanningState: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="flex flex-col items-center py-6 gap-3">
    <span className="text-2xl font-bold text-muted-foreground animate-pulse">Scanning...</span>
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className="bg-primary h-2 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
    <span className="text-sm text-muted-foreground">{progress}%</span>
  </div>
);

interface CompleteStateProps {
  score: SecurityScore;
  platformScore: SecurityScore | null;
  workloadScore: SecurityScore | null;
  onSeverityClick?: (severity: Severity) => void;
  onPlatformScoreClick?: () => void;
  onWorkloadScoreClick?: () => void;
  findings: AnySecurityFinding[];
  onComplianceTypeClick?: (type: FindingType | null) => void;
  /** U-3: Timed-out namespaces for inline alert below grade criteria */
  timedOutNamespaces?: string[];
  /** U-3: Retry handler */
  onRetryNamespaces?: () => void;
}

const CompleteState: React.FC<CompleteStateProps> = ({
  score,
  platformScore,
  workloadScore,
  onSeverityClick,
  onPlatformScoreClick,
  onWorkloadScoreClick,
  findings,
  onComplianceTypeClick,
  timedOutNamespaces = [],
  onRetryNamespaces,
}) => {
  const gradeColorClass = GRADE_COLOR[score.grade];
  const gradeBgClass = GRADE_BG[score.grade];

  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* Overall score & grade */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
            Overall
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-5xl font-bold tabular-nums ${gradeColorClass}`}>{score.score}</span>
            <span className="text-muted-foreground text-sm">/ 100</span>
          </div>
        </div>
        <div className={`flex items-center justify-center w-12 h-12 rounded-full ${gradeBgClass}`}>
          <span className={`text-2xl font-bold ${gradeColorClass}`}>{score.grade}</span>
        </div>
      </div>

      {/* Platform / Workload split scores (clickable) */}
      <div className="grid grid-cols-2 gap-2">
        <ScoreBreakdownItem
          label="Platform"
          sublabel="Kubescape"
          score={platformScore}
          onClick={onPlatformScoreClick}
        />
        <ScoreBreakdownItem label="Workload" sublabel="Trivy" score={workloadScore} onClick={onWorkloadScoreClick} />
      </div>

      {/* Total finding count */}
      <div className="text-sm text-muted-foreground">{score.totalFindings} vulnerabilities found</div>

      {/* Severity distribution bar */}
      {score.totalFindings > 0 && (
        <SeverityBreakdown breakdown={score.breakdown} total={score.totalFindings} onSeverityClick={onSeverityClick} />
      )}

      {/* Grade reference table */}
      <GradeCriteriaTable currentGrade={score.grade} />

      {/* U-3: Incomplete NS alert — below grade criteria, above compliance overview */}
      {timedOutNamespaces.length > 0 && (
        <div className="flex items-start gap-1.5 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 px-2.5 py-1.5 text-xs text-orange-700 dark:text-orange-400">
          <svg
            className="h-3.5 w-3.5 mt-0.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="flex flex-col gap-1">
            <span>
              <span className="font-semibold">
                {timedOutNamespaces.length} namespace{timedOutNamespaces.length > 1 ? "s" : ""} scan incomplete
              </span>
              {" — vulnerabilities in "}
              <span className="font-mono">{timedOutNamespaces.join(", ")}</span>
              {" may be missing."}
            </span>
            {onRetryNamespaces && (
              <button
                className="self-start text-[10px] font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
                onClick={onRetryNamespaces}
              >
                Retry incomplete namespaces →
              </button>
            )}
          </span>
        </div>
      )}

      {/* Inline Compliance Overview */}
      <InlineComplianceOverview findings={findings} onTypeClick={onComplianceTypeClick} />
    </div>
  );
};

// ============================================
// Inline Compliance Overview
// ============================================

const InlineComplianceOverview: React.FC<{
  findings: AnySecurityFinding[];
  onTypeClick?: (type: FindingType | null) => void;
}> = ({ findings, onTypeClick }) => {
  const trivyFindings = useMemo(() => findings.filter((f) => f.source === ScannerSource.Trivy), [findings]);
  const kubeFindings = useMemo(() => findings.filter((f) => f.source === ScannerSource.Kubescape), [findings]);

  if (trivyFindings.length === 0 && kubeFindings.length === 0) return null;

  const makeRate = (list: AnySecurityFinding[]) => {
    if (list.length === 0) return 100;
    const ch = list.filter((f) => f.severity === Severity.Critical || f.severity === Severity.High).length;
    return Math.round(((list.length - ch) / list.length) * 100);
  };

  const rateColor = (r: number) =>
    r >= 80
      ? "text-green-600 dark:text-green-400"
      : r >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  const renderBar = (list: AnySecurityFinding[]) => {
    const total = list.length;
    if (total === 0)
      return <div className="text-[10px] text-emerald-700/80 dark:text-emerald-600/75">No vulnerabilities</div>;
    const counts = Object.fromEntries(SEVERITY_ORDER_ARR.map((s) => [s, 0])) as Record<Severity, number>;
    list.forEach((f) => {
      counts[f.severity] += 1;
    });
    return (
      <>
        <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
          {SEVERITY_ORDER_ARR.map((sev) => {
            const pct = (counts[sev] / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={sev}
                className={SEVERITY_COLOR[sev]}
                style={{ width: `${pct}%` }}
                title={`${SEVERITY_SHORT[sev]}: ${counts[sev]}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
          {SEVERITY_ORDER_ARR.map((sev) => {
            const c = counts[sev];
            if (!c) return null;
            return (
              <span key={sev} className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <span className={`inline-block h-1.5 w-1.5 rounded-sm ${SEVERITY_COLOR[sev]}`} />
                {SEVERITY_SHORT[sev]} {c}
              </span>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="border-t pt-3 mt-1">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        Compliance Overview
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div
          className={`rounded-md border p-2 flex flex-col gap-1.5${onTypeClick ? " cursor-pointer hover:bg-accent/40 transition-colors" : ""}`}
          onClick={onTypeClick ? () => onTypeClick(FindingType.CVE) : undefined}
        >
          <div className="flex items-start justify-between gap-1">
            <div>
              <div className="text-xs font-semibold">Container Security</div>
              <div className="text-[10px] text-muted-foreground">Trivy — CVE</div>
            </div>
            <span className={`text-sm font-bold tabular-nums ${rateColor(makeRate(trivyFindings))}`}>
              {makeRate(trivyFindings)}%
            </span>
          </div>
          {renderBar(trivyFindings)}
        </div>
        <div
          className={`rounded-md border p-2 flex flex-col gap-1.5${onTypeClick ? " cursor-pointer hover:bg-accent/40 transition-colors" : ""}`}
          onClick={onTypeClick ? () => onTypeClick(FindingType.Misconfiguration) : undefined}
        >
          <div className="flex items-start justify-between gap-1">
            <div>
              <div className="text-xs font-semibold">Config Compliance</div>
              <div className="text-[10px] text-muted-foreground">Kubescape — NSA/MITRE</div>
            </div>
            <span className={`text-sm font-bold tabular-nums ${rateColor(makeRate(kubeFindings))}`}>
              {makeRate(kubeFindings)}%
            </span>
          </div>
          {renderBar(kubeFindings)}
        </div>
      </div>
    </div>
  );
};

// ============================================
// ScoreBreakdownItem (onClick added)
// ============================================

interface ScoreBreakdownItemProps {
  label: string;
  sublabel: string;
  score: SecurityScore | null;
  onClick?: () => void;
}

const ScoreBreakdownItem: React.FC<ScoreBreakdownItemProps> = ({ label, sublabel, score, onClick }) => {
  if (!score)
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{sublabel}</span>
        <span className="text-lg font-bold text-muted-foreground">—</span>
      </div>
    );

  const colorClass = GRADE_COLOR[score.grade];
  const bgClass = GRADE_BG[score.grade];

  return (
    <div
      className={`rounded-md border px-3 py-2 flex flex-col gap-0.5 ${bgClass}${onClick ? " cursor-pointer hover:ring-1 hover:ring-primary/50 transition-shadow" : ""}`}
      onClick={onClick}
      title={onClick ? `Click to scroll to ${label} section` : undefined}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
          <div className="text-xs text-muted-foreground">{sublabel}</div>
        </div>
        <span className={`text-sm font-bold ${colorClass}`}>{score.grade}</span>
      </div>
      <span className={`text-2xl font-bold tabular-nums ${colorClass}`}>{score.score}</span>
      <span className="text-xs text-muted-foreground">{score.totalFindings} findings</span>
    </div>
  );
};

interface SeverityBreakdownProps {
  breakdown: Record<Severity, number>;
  total: number;
  onSeverityClick?: (severity: Severity) => void;
}

const SeverityBreakdown: React.FC<SeverityBreakdownProps> = ({ breakdown, total, onSeverityClick }) => {
  const severities = [Severity.Critical, Severity.High, Severity.Medium, Severity.Low, Severity.Unknown] as const;

  return (
    <div className="flex flex-col gap-2">
      {/* Distribution bar — click syncs severity filter */}
      <div className="flex h-2 w-full rounded-full overflow-hidden gap-0.5">
        {severities.map((sev) => {
          const count = breakdown[sev] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={sev}
              className={`${SEVERITY_COLOR[sev]} h-full${onSeverityClick ? " cursor-pointer" : ""}`}
              style={{ width: `${pct}%` }}
              title={`${SEVERITY_LABEL[sev]}: ${count}${onSeverityClick ? " (click to filter)" : ""}`}
              onClick={onSeverityClick ? () => onSeverityClick(sev) : undefined}
            />
          );
        })}
      </div>

      {/* Legend — click syncs severity filter */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {severities.map((sev) => {
          const count = breakdown[sev] ?? 0;
          if (count === 0) return null;
          return (
            <div
              key={sev}
              className={`flex items-center gap-1 text-xs text-muted-foreground${onSeverityClick ? " cursor-pointer hover:text-foreground transition-colors" : ""}`}
              onClick={onSeverityClick ? () => onSeverityClick(sev) : undefined}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${SEVERITY_COLOR[sev]}`} />
              <span>{SEVERITY_LABEL[sev]}</span>
              <Badge variant="secondary" className="px-1 py-0 text-xs h-4">
                {count}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ErrorState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center py-6 gap-2 text-destructive">
    <span className="text-sm font-medium">Scan Failed</span>
    {message && <span className="text-xs text-muted-foreground text-center max-w-xs">{message}</span>}
  </div>
);

// ============================================
// Grade reference table
// ============================================

interface GradeCriteriaTableProps {
  currentGrade: SecurityGrade;
}

const GradeCriteriaTable: React.FC<GradeCriteriaTableProps> = ({ currentGrade }) => {
  const grades = [SecurityGrade.A, SecurityGrade.B, SecurityGrade.C, SecurityGrade.D, SecurityGrade.F];

  return (
    <div className="mt-1">
      <details className="group">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          View grade criteria
        </summary>
        <div className="mt-2 rounded-md border overflow-hidden">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="px-2 py-1 h-auto text-muted-foreground w-8">Grade</TableHead>
                <TableHead className="px-2 py-1 h-auto text-muted-foreground w-16">Score</TableHead>
                <TableHead className="px-2 py-1 h-auto text-muted-foreground w-12">Rating</TableHead>
                <TableHead className="px-2 py-1 h-auto text-muted-foreground">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) => {
                const c = GRADE_CRITERIA[g];
                const isCurrentGrade = g === currentGrade;
                return (
                  <TableRow
                    key={g}
                    className={`transition-colors ${
                      isCurrentGrade
                        ? `bg-muted/50 ${GRADE_HIGHLIGHT_BORDER[g]}`
                        : "border-l-4 border-l-transparent hover:bg-muted/30"
                    }`}
                  >
                    <TableCell
                      className={`px-2 py-1.5 font-bold ${GRADE_COLOR[g]} ${isCurrentGrade ? "font-extrabold" : ""}`}
                    >
                      {g}
                    </TableCell>
                    <TableCell
                      className={`px-2 py-1.5 font-mono text-muted-foreground ${isCurrentGrade ? "font-semibold text-foreground" : ""}`}
                    >
                      {c.range}
                    </TableCell>
                    <TableCell
                      className={`px-2 py-1.5 font-medium ${GRADE_COLOR[g]} ${isCurrentGrade ? "font-bold" : ""}`}
                    >
                      {c.label}
                    </TableCell>
                    <TableCell
                      className={`px-2 py-1.5 text-muted-foreground ${isCurrentGrade ? "font-medium text-foreground" : ""}`}
                    >
                      {c.desc}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
};
