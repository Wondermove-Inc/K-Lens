/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: Security dashboard empty data/error status UI component
 * Empty data/error status UI
 *
 *  Key features:
 * - Pre-scan (idle): Start Scan guidance + immediate Start Scan button
 * - Scan complete + 0 findings (clean): cluster safety notice
 * - Error: error message + retry button
 * - Cancelled: cancel notice + Rescan button
 * - No cluster selected: cluster selection guidance
 *
 *  Pattern: follows Empty component pattern from cluster-overview.tsx
 *
 * @packageDocumentation
 */

import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@skuberplus/storybook-shadcn/src/components/ui/empty";
import { Loader2, ScanLine, ServerOff, ShieldCheck, ShieldX } from "lucide-react";
import React from "react";

// ============================================
//  Props
// ============================================

export type SecurityEmptyVariant =
  | "idle" // pre-scan
  | "clean" // scan complete, 0 findings
  | "error" // scan error
  | "no-cluster"; // no cluster selected

export interface SecurityEmptyStateProps {
  /** Empty state variant to display */
  variant: SecurityEmptyVariant;
  /** Error message (when variant=error) */
  errorMessage?: string;
  /** Start Scan callback (shown for idle, error) */
  onStartScan?: () => void;
  /** Disable action button while cache is loading */
  actionDisabled?: boolean;
  /** Container height in px (default 360) */
  height?: number;
}

// ============================================
//  Per-status content definition
// ============================================

interface StateContent {
  Icon: React.FC<{ className?: string }>;
  iconClass: string;
  title: string;
  description: string;
  actionLabel?: string;
}

const STATE_CONTENT: Record<SecurityEmptyVariant, StateContent> = {
  idle: {
    Icon: ScanLine,
    iconClass: "text-muted-foreground",
    title: "Start a Security Scan",
    description: "Detect CVEs, misconfigurations, and RBAC threats in your cluster using Trivy and Kubescape.",
    actionLabel: "Start Scan",
  },
  clean: {
    Icon: ShieldCheck,
    iconClass: "text-green-500",
    title: "Your cluster is secure",
    description: "Scan complete: no vulnerabilities found. Run regular scans to stay secure.",
    actionLabel: "Rescan",
  },
  error: {
    Icon: ShieldX,
    iconClass: "text-destructive",
    title: "Scan Failed",
    description: "An error occurred during scanning. Check your cluster connection and try again.",
    actionLabel: "Retry",
  },
  "no-cluster": {
    Icon: ServerOff,
    iconClass: "text-muted-foreground",
    title: "Select a Cluster",
    description: "Select a cluster from the sidebar to run a security scan.",
  },
};

// ============================================
//  SecurityEmptyState component
// ============================================

export const SecurityEmptyState: React.FC<SecurityEmptyStateProps> = ({
  variant,
  errorMessage,
  onStartScan,
  actionDisabled = false,
  height = 360,
}) => {
  const content = STATE_CONTENT[variant];
  const { Icon, iconClass, title, actionLabel } = content;

  // Use errorMessage if error state, otherwise use default description
  const description = variant === "error" && errorMessage ? errorMessage : content.description;

  const showAction = !!actionLabel && !!onStartScan;

  return (
    <Empty style={{ height }} className="flex flex-col items-center justify-center">
      <EmptyHeader className="flex flex-col items-center gap-3 text-center">
        <Icon className={`h-12 w-12 ${iconClass}`} />
        <EmptyTitle className="text-lg font-semibold">{title}</EmptyTitle>
        <EmptyDescription className="text-sm text-muted-foreground max-w-sm">{description}</EmptyDescription>
      </EmptyHeader>
      {showAction && !actionDisabled && (
        <div className="mt-6">
          <Button variant={variant === "error" ? "destructive" : "default"} size="sm" onClick={onStartScan}>
            {actionLabel}
          </Button>
        </div>
      )}
      {actionDisabled && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading scan results...</span>
        </div>
      )}
    </Empty>
  );
};

SecurityEmptyState.displayName = "SecurityEmptyState";
