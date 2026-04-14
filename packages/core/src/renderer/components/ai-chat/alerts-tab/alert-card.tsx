/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import React from "react";
import { Card, CardContent, CardHeader } from "../../shadcn-ui/card";
import { AlertFindingItem } from "./alert-finding-item";

import type { MonitorAlert, MonitorFinding } from "../../../../features/ai-assistant/common/monitor-types";

interface AlertCardProps {
  alert: MonitorAlert;
  onAnalyze: (finding: MonitorFinding & { clusterId: string }) => void;
  onApplyCommand: (command: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

const AlertCard = observer(({ alert, onAnalyze, onApplyCommand }: AlertCardProps) => {
  return (
    <Card className="mb-3 overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="font-medium truncate">{alert.clusterName}</span>
            <span className="text-muted-foreground text-xs shrink-0">· {formatRelativeTime(alert.timestamp)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 break-words">{alert.summary}</p>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <div className="space-y-2 min-w-0">
          {(alert.findings ?? []).map((finding) => (
            <AlertFindingItem
              key={finding.id}
              finding={finding}
              clusterId={alert.clusterId}
              onAnalyze={onAnalyze}
              onApplyCommand={onApplyCommand}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

export { AlertCard };
