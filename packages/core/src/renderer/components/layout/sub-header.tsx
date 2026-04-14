/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./sub-header.scss";

import { cssNames } from "@skuberplus/utilities";
import React, { Component } from "react";

import type { StrictReactNode } from "@skuberplus/utilities";

export interface SubHeaderProps {
  className?: string;
  withLine?: boolean; // add bottom line
  compact?: boolean; // no extra padding around content
  children: StrictReactNode;
}

export class SubHeader extends Component<SubHeaderProps> {
  render() {
    const { withLine, compact, children } = this.props;
    let { className } = this.props;

    className = cssNames(
      "SubHeader",
      {
        withLine,
        compact,
      },
      className,
    );

    return <div className={className}>{children}</div>;
  }
}
