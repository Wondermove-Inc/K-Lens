/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ChevronDown, ChevronRight } from "lucide-react";
import { observer } from "mobx-react";
import React, { useState } from "react";
import { monitorState } from "../../../../features/ai-assistant/renderer/monitor-ui/monitor-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../shadcn-ui/alert-dialog";
import { Button } from "../../shadcn-ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../shadcn-ui/collapsible";

import type { MonitorFinding } from "../../../../features/ai-assistant/common/monitor-types";

interface AlertFindingItemProps {
  finding: MonitorFinding;
  clusterId: string;
  onAnalyze: (finding: MonitorFinding & { clusterId: string }) => void;
  onApplyCommand: (command: string) => void;
}

const AlertFindingItem = observer(({ finding, clusterId, onAnalyze, onApplyCommand }: AlertFindingItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const isAcknowledged = monitorState.acknowledgedFindingIds.has(finding.id);

  const severityColor =
    finding.severity === "critical"
      ? "text-red-500"
      : finding.severity === "warning"
        ? "text-yellow-500"
        : "text-blue-500";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`rounded-md border p-2 min-w-0 overflow-hidden ${isAcknowledged ? "opacity-50" : ""}`}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left text-sm cursor-pointer hover:bg-accent/50 rounded p-1 -m-1 min-w-0"
          >
            {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
            <span className={`font-medium ${severityColor} ${isOpen ? "break-words" : "truncate"}`}>
              {finding.title}
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 space-y-2 pl-5 min-w-0">
            <p className="text-xs text-muted-foreground break-words">{finding.description}</p>

            {(finding.suggestedCommands ?? []).length > 0 && (
              <div className="overflow-x-auto">
                <code className="block text-xs bg-muted rounded p-1.5 font-mono whitespace-nowrap">
                  {finding.suggestedCommands?.[0]}
                </code>
              </div>
            )}

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onAnalyze({ ...finding, clusterId })}
              >
                Analyze
              </Button>

              {(finding.suggestedCommands ?? []).length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                      Apply
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Command Execution</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to execute the following command?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-2">
                      {(finding.suggestedCommands ?? []).map((cmd, i) => (
                        <code key={i} className="block text-xs bg-muted rounded p-1.5 font-mono mb-1 break-all">
                          {cmd}
                        </code>
                      ))}
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (finding.suggestedCommands?.[0]) onApplyCommand(finding.suggestedCommands[0]);
                        }}
                      >
                        Execute
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <Button
                variant="ghost"
                size="sm"
                className={`h-6 px-2 text-xs ${isAcknowledged ? "text-green-600" : ""}`}
                onClick={() => monitorState.acknowledgeFinding(finding.id)}
                disabled={isAcknowledged}
              >
                {isAcknowledged ? "Acked" : "Ack"}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

export { AlertFindingItem };
