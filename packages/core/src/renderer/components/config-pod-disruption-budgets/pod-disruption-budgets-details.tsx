/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./pod-disruption-budgets-details.scss";

import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React from "react";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";

import type { PodDisruptionBudget } from "@skuberplus/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface PodDisruptionBudgetDetailsProps extends KubeObjectDetailsProps<PodDisruptionBudget> {}

export const PodDisruptionBudgetDetails = observer((props: PodDisruptionBudgetDetailsProps) => {
  const { object: pdb } = props;

  if (!pdb) {
    return null;
  }

  const selectors = pdb.getSelectors();

  // 🎯 shadcn DetailPanelField로 마이그레이션 완료
  return (
    <div className="PdbDetails">
      {selectors.length > 0 && (
        <DetailPanelField label="Selector">
          <div className="flex flex-wrap gap-1">
            {selectors.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        </DetailPanelField>
      )}

      <DetailPanelField label="Min Available">{pdb.getMinAvailable()}</DetailPanelField>
      <DetailPanelField label="Max Unavailable">{pdb.getMaxUnavailable()}</DetailPanelField>
      <DetailPanelField label="Current Healthy">{pdb.getCurrentHealthy()}</DetailPanelField>
      <DetailPanelField label="Desired Healthy">{pdb.getDesiredHealthy()}</DetailPanelField>
      <KubeObjectConditionsDrawer object={pdb} />
    </div>
  );
});
