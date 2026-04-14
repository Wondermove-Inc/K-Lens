/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const AzureFile: VolumeVariantComponent<"azureFile"> = ({
  variant: { readOnly = false, secretName, shareName, secretNamespace = "default" },
}) => (
  <>
    <DetailPanelField label="Secret Name">{secretName}</DetailPanelField>
    <DetailPanelField label="Share Name">{shareName}</DetailPanelField>
    <DetailPanelField label="Namespace of Secret">{secretNamespace}</DetailPanelField>
    <DetailPanelField label="Readonly">{readOnly.toString()}</DetailPanelField>
  </>
);
