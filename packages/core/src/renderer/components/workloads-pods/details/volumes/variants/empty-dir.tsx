/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const EmptyDir: VolumeVariantComponent<"emptyDir"> = ({ variant: { medium, sizeLimit } }) => (
  <>
    <DetailPanelField label="Medium">{medium || "<node's default medium>"}</DetailPanelField>
    {sizeLimit && <DetailPanelField label="Size Limit">{sizeLimit}</DetailPanelField>}
  </>
);
