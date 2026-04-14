/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Bell } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { monitorState } from "../../../../features/ai-assistant/renderer/monitor-ui/monitor-state";
import { Button } from "../../shadcn-ui/button";
import { Separator } from "../../shadcn-ui/separator";
import { ToggleGroup, ToggleGroupItem } from "../../shadcn-ui/toggle-group";
import { AlertCard } from "./alert-card";

import type { MonitorFinding } from "../../../../features/ai-assistant/common/monitor-types";
import type { SeverityFilter } from "../../../../features/ai-assistant/renderer/monitor-ui/monitor-state";
import type { AIChatPanelStore } from "../ai-chat-panel-store";

interface AlertsTabContentProps {
  store: AIChatPanelStore;
}

const AlertsTabContent = observer(({ store }: AlertsTabContentProps) => {
  const alerts = monitorState.filteredAlerts;

  const handleAnalyze = (finding: MonitorFinding & { clusterId: string }) => {
    store.sendMonitorAnalysis(finding);
  };

  const handleApplyCommand = (command: string) => {
    store.selectTab("chat");
    store.sendMessage(`Please execute the following command: \`${command}\``);
  };

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
      <div className="flex items-center justify-between px-1 py-2 shrink-0">
        <ToggleGroup
          type="single"
          value={monitorState.severityFilter}
          onValueChange={(value) => {
            if (value) monitorState.setSeverityFilter(value as SeverityFilter);
          }}
          className="gap-0.5"
        >
          <ToggleGroupItem value="all" className="h-6 px-2 text-xs">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="critical" className="h-6 px-2 text-xs">
            Critical
          </ToggleGroupItem>
          <ToggleGroupItem value="warning" className="h-6 px-2 text-xs">
            Warning
          </ToggleGroupItem>
          <ToggleGroupItem value="info" className="h-6 px-2 text-xs">
            Info
          </ToggleGroupItem>
        </ToggleGroup>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={() => monitorState.clearAll()}
          disabled={alerts.length === 0}
        >
          Clear All
        </Button>
      </div>

      <Separator />

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="p-2">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No alerts</p>
            </div>
          ) : (
            alerts.map((alert, index) => (
              <AlertCard
                key={`${alert.clusterId}-${alert.timestamp}-${index}`}
                alert={alert}
                onAnalyze={handleAnalyze}
                onApplyCommand={handleApplyCommand}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
});

export { AlertsTabContent };
