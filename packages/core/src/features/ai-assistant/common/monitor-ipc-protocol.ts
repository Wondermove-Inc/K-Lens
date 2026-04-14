/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { MonitorAlert, MonitorConfig, MonitorRule, MonitorStatus } from "./monitor-types";

/**
 * 목적: Main -> Worker 제어 명령 타입
 */
export type MonitorCommand =
  | { type: "configure"; config: MonitorConfig }
  | { type: "stop" }
  | { type: "check-now"; clusterId: string }
  | { type: "add-rule"; clusterId: string; rule: MonitorRule };

/**
 * 목적: Worker -> Main 이벤트 타입
 */
export type MonitorEvent =
  | { type: "ready" }
  | { type: "alert"; alert: MonitorAlert }
  | { type: "status"; status: MonitorStatus }
  | { type: "check-complete"; clusterId: string; findingCount: number }
  | { type: "rule-added"; clusterId: string; rule: MonitorRule }
  | { type: "error"; error: string; clusterId?: string };
