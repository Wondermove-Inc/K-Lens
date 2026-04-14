/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const DownwardAPI: VolumeVariantComponent<"downwardAPI"> = ({ variant: { items } }) => (
  <DetailPanelField label="Items">
    <ul>
      {items.map((item) => (
        <li key={item.path}>{item.path}</li>
      ))}
    </ul>
  </DetailPanelField>
);
