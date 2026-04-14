/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Icon } from "@skuberplus/icon";
import { observer } from "mobx-react";
import React from "react";
import { Button } from "../../shadcn-ui/button";
import { Checkbox } from "../../shadcn-ui/checkbox";
import { Label } from "../../shadcn-ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../shadcn-ui/select";
import { ToggleGroup, ToggleGroupItem } from "../../shadcn-ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../shadcn-ui/tooltip";
import styles from "./controls.module.scss";
import { DownloadLogsDropdown } from "./download-logs-dropdown";
import { FILTERABLE_LOG_LEVELS, LOG_LEVEL_LABELS } from "./log-utils";

import type { LogLevel } from "./log-utils";
import type { LogTabViewModel } from "./logs-view-model";
import type { TimestampFormat } from "./tab-store";

export interface LogControlsProps {
  model: LogTabViewModel;
  /** Callback to detach logs to a separate window. If not provided, detach button is hidden. */
  onDetach?: () => void;
}

const TIMESTAMP_FORMAT_OPTIONS: { value: TimestampFormat; label: string }[] = [
  { value: "iso", label: "ISO (Full)" },
  { value: "short", label: "Short (HH:mm:ss)" },
  { value: "relative", label: "Relative" },
];

export const LogControls = observer(({ model, onDetach }: LogControlsProps) => {
  const tabData = model.logTabData.get();
  const pod = model.pod.get();

  if (!tabData || !pod) {
    return null;
  }

  const logs = model.timestampSplitLogs.get();
  const { showTimestamps, showPrevious: previous, timestampFormat = "iso", visibleLevels = [] } = tabData;
  const since = logs.length ? logs[0][0] : null;
  /**
   * 🎯 목적: Logs from 텍스트 색상을 로그 테마로 강제 적용
   * ⚠️ 중요: 다른 전역 스타일의 !important 오버라이드를 방지하기 위해 setProperty 사용
   */
  const applyLogTextStyle = (element: HTMLElement | null) => {
    if (!element) return;

    element.style.setProperty("color", "var(--logsForeground)", "important");
  };

  const toggleTimestamps = () => {
    model.updateLogTabData({ showTimestamps: !showTimestamps });
  };

  const togglePrevious = () => {
    model.updateLogTabData({ showPrevious: !previous });
    model.reloadLogs();
  };

  const handleTimestampFormatChange = (value: string) => {
    model.updateLogTabData({ timestampFormat: value as TimestampFormat });
  };

  const handleLogLevelFilterChange = (values: string[]) => {
    model.updateLogTabData({ visibleLevels: values as LogLevel[] });
  };

  return (
    <div className={styles.controls} data-testid="log-controls">
      <div>
        {since && (
          <span ref={applyLogTextStyle}>
            Logs from <b ref={applyLogTextStyle}>{new Date(since).toLocaleString()}</b>
          </span>
        )}
      </div>
      <div className="flex gaps align-center">
        <ToggleGroup
          type="multiple"
          value={visibleLevels}
          onValueChange={handleLogLevelFilterChange}
          size="sm"
          variant="outline"
          className="PodLogsDropdownContent"
        >
          {FILTERABLE_LOG_LEVELS.map((level) => (
            <ToggleGroupItem
              key={level}
              value={level}
              aria-label={`Filter ${level} logs`}
              className="text-xs px-2 h-7 border-0"
              style={
                visibleLevels.includes(level)
                  ? {
                      color: `var(--log-level-${level})`,
                      backgroundColor: "var(--log-level-button-active-bg)",
                    }
                  : undefined
              }
            >
              {LOG_LEVEL_LABELS[level]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex gaps align-center">
          <Checkbox id="show-timestamps" checked={showTimestamps} onCheckedChange={toggleTimestamps} />
          <Label htmlFor="show-timestamps">Show timestamps</Label>
        </div>

        {showTimestamps && (
          <Select value={timestampFormat} onValueChange={handleTimestampFormatChange}>
            <SelectTrigger className="PodLogsDropdownContent w-[140px] h-7" size="sm">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent className="PodLogsDropdownContent">
              {TIMESTAMP_FORMAT_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex gaps align-center">
          <Checkbox id="show-previous" checked={previous} onCheckedChange={togglePrevious} />
          <Label htmlFor="show-previous">Show previous terminated container</Label>
        </div>

        <DownloadLogsDropdown
          disabled={logs.length === 0}
          downloadVisibleLogs={model.downloadLogs}
          downloadAllLogs={model.downloadAllLogs}
        />

        {onDetach && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onDetach}
                className="h-7 px-2"
                data-testid="detach-log-window"
              >
                <Icon material="open_in_new" smallest />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in new window</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
});
