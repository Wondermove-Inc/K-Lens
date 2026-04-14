/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DockTabStore } from "../dock-tab-store/dock-tab.store";
import { logTabDataValidator } from "./log-tab-data.validator";

import type { TabId } from "../dock/store";
import type { DockTabStoreDependencies } from "../dock-tab-store/dock-tab.store";
import type { LogLevel } from "./log-utils";

export const ALL_CONTAINERS = "__ALL_CONTAINERS__";

export function isAllContainersSelected(data: LogTabData): boolean {
  return data.selectedContainer === ALL_CONTAINERS;
}

export interface LogTabOwnerRef {
  /**
   * The uid of the owner
   */
  uid: string;
  /**
   * The name of the owner
   */
  name: string;
  /**
   * The kind of the owner
   */
  kind: string;
}

export type TimestampFormat = "iso" | "short" | "relative";

export interface LogTabData {
  /**
   * The owning workload for this logging tab
   */
  owner?: LogTabOwnerRef;

  /**
   * The uid of the currently selected pod
   */
  selectedPodId: string;

  /**
   * The namespace of the pods/workload
   */
  namespace: string;

  /**
   * The name of the currently selected container within the currently selected
   * pod
   */
  selectedContainer: string;

  /**
   * Whether to show timestamps in the logs
   */
  showTimestamps: boolean;

  /**
   * Whether to show the logs of the previous container instance
   */
  showPrevious: boolean;

  /**
   * Timestamp display format
   * - iso: Full ISO format (2026-02-03T10:35:42.123Z)
   * - short: Time only (10:35:42.123)
   * - relative: Relative time (2 minutes ago)
   */
  timestampFormat?: TimestampFormat;

  /**
   * Visible log levels for filtering
   * If undefined or empty, all levels are shown
   */
  visibleLevels?: LogLevel[];
}

export class LogTabStore extends DockTabStore<LogTabData> {
  constructor(dependencies: DockTabStoreDependencies) {
    super(dependencies, {
      storageKey: "pod_logs",
    });
  }

  /**
   * Returns true if the data for `tabId` is valid
   */
  isDataValid(tabId: TabId): boolean {
    if (!this.getData(tabId)) {
      return true;
    }

    return !logTabDataValidator.validate(this.getData(tabId)).error;
  }
}
