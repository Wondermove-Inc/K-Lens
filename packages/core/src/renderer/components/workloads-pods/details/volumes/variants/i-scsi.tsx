/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const IScsi: VolumeVariantComponent<"iscsi"> = ({
  variant: { targetPortal, iqn, lun, fsType = "ext4", readOnly = false, chapAuthDiscovery, chapAuthSession, secretRef },
}) => (
  <>
    <DetailPanelField label="Target Address">{targetPortal}</DetailPanelField>
    <DetailPanelField label="iSCSI qualified name">{iqn}</DetailPanelField>
    <DetailPanelField label="Logical Unit Number">{lun.toString()}</DetailPanelField>
    <DetailPanelField label="Filesystem Type">{fsType}</DetailPanelField>
    <DetailPanelField label="Readonly">{readOnly.toString()}</DetailPanelField>
    {chapAuthDiscovery && (
      <DetailPanelField label="CHAP Discovery Authentication">{chapAuthDiscovery.toString()}</DetailPanelField>
    )}
    {chapAuthSession && (
      <DetailPanelField label="CHAP Session Authentication">{chapAuthSession.toString()}</DetailPanelField>
    )}
    {secretRef && <DetailPanelField label="CHAP Secret">{secretRef.name}</DetailPanelField>}
  </>
);
