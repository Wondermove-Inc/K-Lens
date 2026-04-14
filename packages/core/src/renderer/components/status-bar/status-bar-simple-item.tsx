/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { cn } from "../../lib/utils";
import styles from "./status-bar.module.scss";

import type { LucideIcon } from "lucide-react";

export interface StatusBarSimpleItemProps {
  icon: LucideIcon;
  label: string;
  muted?: boolean;
}

export const StatusBarSimpleItem: React.FC<StatusBarSimpleItemProps> = ({ icon: Icon, label, muted }) => (
  <div className={cn(styles.content, muted && styles.muted)}>
    <Icon className={styles.icon} aria-hidden />
    <span className={styles.label}>{label}</span>
  </div>
);
