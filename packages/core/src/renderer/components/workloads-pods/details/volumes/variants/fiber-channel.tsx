/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const FiberChannel: VolumeVariantComponent<"fc"> = ({
  variant: { targetWWNs, lun, fsType = "ext4", readOnly = false },
}) => (
  <>
    <DetailPanelField label="Target World Wide Names">
      <ul>
        {targetWWNs.map((targetWWN) => (
          <li key={targetWWN}>{targetWWN}</li>
        ))}
      </ul>
    </DetailPanelField>
    <DetailPanelField label="Logical Unit Number">{lun.toString()}</DetailPanelField>
    <DetailPanelField label="Filesystem Type">{fsType}</DetailPanelField>
    <DetailPanelField label="Readonly">{readOnly.toString()}</DetailPanelField>
  </>
);
