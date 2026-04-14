/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  DetailPanelField,
  DetailPanelFieldGroup,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const HostPath: VolumeVariantComponent<"hostPath"> = ({ variant: { path, type } }) => (
  <DetailPanelFieldGroup>
    <DetailPanelField label="Node's Host Filesystem Path">{path}</DetailPanelField>
    <DetailPanelField label="Check Behaviour">{type || "-- none --"}</DetailPanelField>
  </DetailPanelFieldGroup>
);
