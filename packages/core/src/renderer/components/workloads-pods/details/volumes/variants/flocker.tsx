/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const Flocker: VolumeVariantComponent<"flocker"> = ({ variant: { datasetName } }) => (
  <DetailPanelField label="Dataset Name">{datasetName}</DetailPanelField>
);
