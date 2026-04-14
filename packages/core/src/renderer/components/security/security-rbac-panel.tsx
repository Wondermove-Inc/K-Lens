/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: RBAC Risks panel
 * RBAC Risks panel implementation
 *
 *  Key features:
 * - Groups RbacFinding[] by subject
 * - Displays riskyPermissions list per subject
 * - Shows severity badge + resource
 * - Handles pre/post-scan status UI
 *
 * @packageDocumentation
 */

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@skuberplus/storybook-shadcn/src/components/ui/card";
import { ShieldAlert } from "lucide-react";
import React, { useMemo } from "react";
import {
  type AnySecurityFinding,
  FindingType,
  type RbacFinding,
  Severity,
} from "../../../common/security/security-finding";

import type { ScanStatus } from "../../../features/security/renderer/security-scan-store";

// ============================================
//  Constants
// ============================================

const SEVERITY_COLOR: Record<Severity, string> = {
  [Severity.Critical]: "bg-red-400 text-black dark:bg-red-800/55 dark:text-red-100",
  [Severity.High]: "bg-orange-400 text-black dark:bg-orange-700/50 dark:text-orange-100",
  [Severity.Medium]: "bg-amber-400 text-black dark:bg-amber-600/55 dark:text-amber-100/90",
  [Severity.Low]: "bg-green-400 text-black dark:bg-green-700/55 dark:text-green-100/90",
  [Severity.Unknown]: "bg-zinc-400 text-black dark:bg-zinc-600/45 dark:text-zinc-200/80",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  [Severity.Critical]: "Critical",
  [Severity.High]: "High",
  [Severity.Medium]: "Medium",
  [Severity.Low]: "Low",
  [Severity.Unknown]: "Unknown",
};

const SEVERITY_ORDER: Record<Severity, number> = {
  [Severity.Critical]: 5,
  [Severity.High]: 4,
  [Severity.Medium]: 3,
  [Severity.Low]: 2,
  [Severity.Unknown]: 1,
};

// ============================================
//  Grouping types
// ============================================

interface SubjectGroup {
  subject: string;
  findings: RbacFinding[];
  maxSeverity: Severity;
}

// ============================================
//  Props
// ============================================

export interface SecurityRbacPanelProps {
  /** scan status */
  status: ScanStatus;
  /** Full finding list (filtered to RBAC only) */
  findings: AnySecurityFinding[];
  /**
   * Callback called when an RBAC risk item is clicked.
   * Used to sync with the resource search filter in the findings table.
   * @param resourceName The name of the clicked resource
   */
  onResourceClick?: (resourceName: string) => void;
}

// ============================================
//  Util: extract RbacFindings + group by subject
// ============================================

function groupBySubject(findings: AnySecurityFinding[]): SubjectGroup[] {
  const rbacFindings = findings.filter((f): f is RbacFinding => f.type === FindingType.RBAC);

  const map = new Map<string, RbacFinding[]>();
  for (const f of rbacFindings) {
    const list = map.get(f.subject) ?? [];
    list.push(f);
    map.set(f.subject, list);
  }

  return (
    [...map.entries()]
      .map(([subject, list]) => {
        const maxSeverity = list.reduce<Severity>(
          (max, f) => (SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[max] ? f.severity : max),
          Severity.Unknown,
        );
        return { subject, findings: list, maxSeverity };
      })
      // Highest severity subjects first
      .sort((a, b) => SEVERITY_ORDER[b.maxSeverity] - SEVERITY_ORDER[a.maxSeverity])
  );
}

// ============================================
//  SecurityRbacPanel component
// ============================================

export const SecurityRbacPanel: React.FC<SecurityRbacPanelProps> = ({ status, findings, onResourceClick }) => {
  const groups = useMemo(() => groupBySubject(findings), [findings]);
  const isReady = status === "complete" || status === "error";
  const rbacCount = groups.reduce((sum, g) => sum + g.findings.length, 0);

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-orange-500/70 shrink-0" />
            <ShieldAlert className="h-5 w-5 text-orange-500/70" />
            <CardTitle className="text-base font-semibold">RBAC Risks</CardTitle>
          </div>
          {isReady && rbacCount > 0 && (
            <span className="text-xs text-muted-foreground">{rbacCount.toLocaleString()}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {status === "idle" && <PanelPlaceholder message="Run a scan to see RBAC risks" />}
        {status === "scanning" && <PanelPlaceholder message="Scanning..." pulse />}
        {status === "error" && <PanelPlaceholder message="An error occurred during scanning" />}
        {isReady && rbacCount === 0 && <PanelPlaceholder message="No RBAC risks found" />}
        {isReady && rbacCount > 0 && (
          <div className="divide-y max-h-96 overflow-y-auto">
            {groups.map((group) => (
              <SubjectGroupRow key={group.subject} group={group} onResourceClick={onResourceClick} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

SecurityRbacPanel.displayName = "SecurityRbacPanel";

// ============================================
//  Placeholder
// ============================================

interface PanelPlaceholderProps {
  message: string;
  pulse?: boolean;
}

const PanelPlaceholder: React.FC<PanelPlaceholderProps> = ({ message, pulse }) => (
  <div
    className={`flex items-center justify-center h-24 text-sm text-muted-foreground px-4 text-center ${
      pulse ? "animate-pulse" : ""
    }`}
  >
    {message}
  </div>
);

// ============================================
//  Subject Group row
// ============================================

interface SubjectGroupRowProps {
  group: SubjectGroup;
  onResourceClick?: (resourceName: string, type: FindingType) => void;
}

const SubjectGroupRow: React.FC<SubjectGroupRowProps> = ({ group, onResourceClick }) => {
  // Deduplicated permissions list
  const uniquePermissions = [...new Set(group.findings.flatMap((f) => f.riskyPermissions))];
  const resourceLabel = group.findings[0]
    ? `${group.findings[0].resource.kind}/${group.findings[0].resource.name}`
    : "";
  const resourceName = group.findings[0]?.resource.name ?? "";

  const handleClick =
    onResourceClick && resourceName ? () => onResourceClick(resourceName, FindingType.RBAC) : undefined;

  return (
    <div
      className={`px-4 py-3 transition-colors${handleClick ? " cursor-pointer hover:bg-accent/50 hover:ring-1 hover:ring-inset hover:ring-border" : " hover:bg-accent/30"}`}
      onClick={handleClick}
      title={handleClick ? `Filter findings by ${resourceName}` : undefined}
    >
      {/* Subject + severity badge */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
            SEVERITY_COLOR[group.maxSeverity]
          }`}
        >
          {SEVERITY_LABEL[group.maxSeverity]}
        </span>
        <span className="text-sm font-medium truncate">{group.subject}</span>
        {group.findings.length > 1 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 shrink-0">
            {group.findings.length}
          </Badge>
        )}
      </div>

      {/* resource */}
      {resourceLabel && <div className="text-xs text-muted-foreground mb-1.5 pl-0.5">{resourceLabel}</div>}

      {/* Risky permissions list */}
      <div className="flex flex-wrap gap-1">
        {uniquePermissions.slice(0, 6).map((perm) => (
          <Badge
            key={perm}
            variant="outline"
            className="text-xs px-1.5 py-0 h-5 text-orange-300/70 border-orange-700/40 dark:text-orange-300/60 dark:border-orange-700/35"
          >
            {perm}
          </Badge>
        ))}
        {uniquePermissions.length > 6 && (
          <Badge
            variant="outline"
            className="text-xs px-1.5 py-0 h-5 text-orange-300/70 border-orange-700/40 dark:text-orange-300/60 dark:border-orange-700/35"
          >
            +{uniquePermissions.length - 6}
          </Badge>
        )}
      </div>
    </div>
  );
};
