/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const AzureDisk: VolumeVariantComponent<"azureDisk"> = ({
  variant: { diskName, diskURI, kind = "Shared", cachingMode = "None", fsType = "ext4", readonly = false },
}) => (
  <>
    <DetailPanelField label={kind === "Managed" ? "Disk Name" : "VHD blob Name"}>{diskName}</DetailPanelField>
    <DetailPanelField label={kind === "Managed" ? "Resource ID" : "Disk URI"}>{diskURI}</DetailPanelField>
    <DetailPanelField label="Kind">{kind}</DetailPanelField>
    <DetailPanelField label="Caching Mode">{cachingMode}</DetailPanelField>
    <DetailPanelField label="Filesystem Type">{fsType}</DetailPanelField>
    <DetailPanelField label="Readonly">{readonly.toString()}</DetailPanelField>
  </>
);
