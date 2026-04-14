/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { cssNames } from "@skuberplus/utilities";
import React from "react";
import styles from "./gutter.module.scss";

interface GutterProps {
  size?: "xs" | "sm" | "md" | "xl";
}

export const Gutter = ({ size = "md" }: GutterProps) => {
  const classNames = cssNames(styles[`size-${size}`]);

  return <div className={classNames} />;
};
