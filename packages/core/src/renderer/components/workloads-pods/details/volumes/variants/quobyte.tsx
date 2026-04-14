/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const Quobyte: VolumeVariantComponent<"quobyte"> = ({
  variant: { registry, volume, readOnly = false, user = "serviceaccount", group, tenant },
}) => (
  <>
    <DetailPanelField label="Registry">{registry}</DetailPanelField>
    <DetailPanelField label="Volume">{volume}</DetailPanelField>
    <DetailPanelField label="Readonly">{readOnly.toString()}</DetailPanelField>
    <DetailPanelField label="User">{user}</DetailPanelField>
    <DetailPanelField label="Group">{group ?? "-- no group --"}</DetailPanelField>
    {tenant && <DetailPanelField label="Tenant">{tenant}</DetailPanelField>}
  </>
);
