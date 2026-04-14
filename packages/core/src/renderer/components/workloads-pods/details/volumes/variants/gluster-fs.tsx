/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const GlusterFs: VolumeVariantComponent<"glusterfs"> = ({ variant: { endpoints, path, readOnly = false } }) => (
  <>
    <DetailPanelField label="Endpoints object name">{endpoints}</DetailPanelField>
    <DetailPanelField label="Glusterfs volume name">{path}</DetailPanelField>
    <DetailPanelField label="Readonly Mountpoint">{readOnly.toString()}</DetailPanelField>
  </>
);
