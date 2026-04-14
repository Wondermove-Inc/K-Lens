/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const VsphereVolume: VolumeVariantComponent<"vsphereVolume"> = ({
  variant: { volumePath, fsType = "ext4", storagePolicyName, storagePolicyID },
}) => (
  <>
    <DetailPanelField label="Virtual Machine Disk Volume">{volumePath}</DetailPanelField>
    <DetailPanelField label="Filesystem type">{fsType}</DetailPanelField>
    {storagePolicyName && (
      <DetailPanelField label="Storage Policy Based Management Profile Name">{storagePolicyName}</DetailPanelField>
    )}
    {storagePolicyID && (
      <DetailPanelField label="Storage Policy Based Management Profile ID">{storagePolicyID}</DetailPanelField>
    )}
  </>
);
