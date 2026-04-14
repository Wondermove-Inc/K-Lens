/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { bytesToUnits, unitsToBytes } from "@skuberplus/utilities";
import React from "react";
import { WithTooltip } from "../with-tooltip";

import type { Node } from "@skuberplus/kube-object";

export interface NodeDetailsResourcesProps {
  node: Node;
  type: "allocatable" | "capacity";
}

export function NodeDetailsResources({ type, node: { status = {} } }: NodeDetailsResourcesProps) {
  const resourceStatus = status[type];

  if (!resourceStatus) {
    return null;
  }

  // 🎯 shadcn DetailPanelField로 마이그레이션 완료
  return (
    <div className="NodeDetailsResources">
      {Object.entries(resourceStatus).map(([key, value]) => {
        let tooltip = null;
        if (value === undefined) return null;
        if (value === null) return null;
        if (key === "ephemeral-storage" || key === "memory") {
          const newValue = bytesToUnits(unitsToBytes(value));
          if (newValue !== "N/A") {
            tooltip = value;
            value = newValue;
          }
        }
        return (
          <DetailPanelField key={key} label={key}>
            <WithTooltip tooltip={tooltip}>{value}</WithTooltip>
          </DetailPanelField>
        );
      })}
    </div>
  );
}
