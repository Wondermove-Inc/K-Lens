/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Icon } from "@skuberplus/icon";
import React from "react";
import { FilterType } from "./page-filters/store";

import type { IconProps } from "@skuberplus/icon";

export interface FilterIconProps extends Partial<IconProps> {
  type: FilterType;
}

export function FilterIcon(props: FilterIconProps) {
  const { type, ...iconProps } = props;

  switch (type) {
    case FilterType.SEARCH:
      return <Icon small material="search" {...iconProps} />;

    default:
      return <Icon small material="filter_list" {...iconProps} />;
  }
}
