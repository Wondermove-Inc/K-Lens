/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerItemLabels 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { dump } from "js-yaml";
import React from "react";

import type { VolumeVariantComponent } from "../variant-helpers";

export const Ephemeral: VolumeVariantComponent<"ephemeral"> = ({
  pod,
  volumeName,
  variant: {
    volumeClaimTemplate: { metadata = {}, spec },
  },
}) => (
  <>
    <DetailPanelField label="PVC Template Name">{`${pod.getName()}-${volumeName}`}</DetailPanelField>
    {metadata.labels && Object.keys(metadata.labels).length > 0 && (
      <DetailPanelField label="Template Labels">
        <div className="flex flex-wrap gap-1">
          {Object.entries(metadata.labels).map(([key, value]) => (
            <Badge key={key} variant="outline">{`${key}=${value}`}</Badge>
          ))}
        </div>
      </DetailPanelField>
    )}
    {metadata.annotations && Object.keys(metadata.annotations).length > 0 && (
      <DetailPanelField label="Template Annotations">
        <div className="flex flex-wrap gap-1">
          {Object.entries(metadata.annotations).map(([key, value]) => (
            <Badge key={key} variant="outline">{`${key}=${value}`}</Badge>
          ))}
        </div>
      </DetailPanelField>
    )}
    <DetailPanelField label="Template PVC Spec">{dump(spec)}</DetailPanelField>
  </>
);
