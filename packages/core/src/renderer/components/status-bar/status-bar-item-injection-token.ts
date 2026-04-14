/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectionToken } from "@ogre-tools/injectable";

import type { IComputedValue } from "mobx";
import type React from "react";

import type { StatusBarItemProps } from "./status-bar-registration";

export type StatusBarItemState = "default" | "warning" | "error";

export interface StatusBarItem {
  origin?: string;
  component: React.ComponentType<StatusBarItemProps>;
  position: "left" | "right";
  visible: IComputedValue<boolean>;
  priority?: number;
  state?: IComputedValue<StatusBarItemState>;
  badge?: IComputedValue<number | string | null>;
  tooltip?: IComputedValue<React.ReactNode>;
  onClick?: () => void;
}

export const statusBarItemInjectionToken = getInjectionToken<StatusBarItem>({
  id: "status-bar-item",
});
