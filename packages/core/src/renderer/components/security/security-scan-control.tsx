/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: Scan execution button & progress status display component
 * Scan execution button & progress status display
 *
 *  Key features:
 * - Start Scan/cancel buttons (connects SecurityScanStore.startScan/cancelScan)
 * - Progress bar + message display
 * - Shows last scan complete time
 * - Switches to cancel button during scanning
 *
 * @packageDocumentation
 */

import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { Card, CardContent } from "@skuberplus/storybook-shadcn/src/components/ui/card";
import { Play, RefreshCw, Square } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";

import type { RunScanRequest } from "../../../features/security/common/security-ipc-channels";
import type { SecurityScanStore } from "../../../features/security/renderer/security-scan-store";

// ============================================
//  Props
// ============================================

export interface SecurityScanControlProps {
  /** SecurityScanStore instance (MobX DI injected) */
  store: SecurityScanStore;
  /** Current cluster ID */
  clusterId: string;
  /** kubeconfig context name (trivy k8s CONTEXT arg) */
  contextName: string;
  /** kubeconfig path */
  kubeconfigPath: string;
  /**
   * Scanner concurrency mode
   * @default 'sequential'
   */
  scanMode?: "sequential" | "parallel";
}

// ============================================
//  SecurityScanControl component
// ============================================

export const SecurityScanControl: React.FC<SecurityScanControlProps> = observer(
  ({ store, clusterId, contextName, kubeconfigPath, scanMode = "sequential" }) => {
    const { scanState } = store;
    const isScanning = store.isScanning;
    // Check if the current cluster has actual findings — scanState is global (not per-cluster)
    // so status=complete from another cluster must not affect this cluster's UI
    const hasClusterFindings = store.getFindingsForCluster(clusterId).length > 0;
    const isComplete = scanState.status === "complete" && hasClusterFindings;
    const isError = scanState.status === "error";

    const handleStart = () => {
      const request: RunScanRequest = {
        clusterId,
        contextName,
        kubeconfigPath,
        scanner: "all",
        scanMode,
      };
      void store.startScan(request);
    };

    const handleCancel = () => {
      void store.cancelScan();
    };

    return (
      <Card className="w-full">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3">
            {/* Button row */}
            <div className="flex items-center gap-3 min-w-0">
              {isScanning ? (
                <Button variant="destructive" size="sm" onClick={handleCancel} className="flex items-center gap-1.5">
                  <Square className="h-3.5 w-3.5" />
                  Cancel Scan
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={handleStart} className="flex items-center gap-1.5">
                  {isComplete || isError ? <RefreshCw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {isComplete || isError ? "Rescan" : "Start Scan"}
                </Button>
              )}

              {/* status message */}
              {isScanning && (
                <span className="text-sm text-muted-foreground animate-pulse truncate">
                  {scanState.message || "Scanning..."}
                </span>
              )}
              {isError && <span className="text-sm text-destructive">{scanState.message || "Scan Failed"}</span>}
              {isComplete && scanState.scannedAt && (
                <span className="text-xs text-muted-foreground">Completed: {formatScannedAt(scanState.scannedAt)}</span>
              )}
            </div>

            {/* Progress bar (shown during scanning only) */}
            {isScanning && <ProgressBar progress={scanState.progress} findingsSoFar={scanState.findingsSoFar} />}
          </div>
        </CardContent>
      </Card>
    );
  },
);

SecurityScanControl.displayName = "SecurityScanControl";

// ============================================
//  Sub-components
// ============================================

interface ProgressBarProps {
  progress: number;
  findingsSoFar: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, findingsSoFar }) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{clampedProgress}%</span>
        {findingsSoFar > 0 && <span>{findingsSoFar} vulnerabilities found</span>}
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
          role="progressbar"
          aria-valuenow={clampedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};

// ============================================
//  Helpers
// ============================================

function formatScannedAt(isoString: string): string {
  try {
    const d = new Date(isoString);
    const date = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return `${date} ${time}`;
  } catch {
    return isoString;
  }
}
