/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./runtime-classes-details-tolerations.scss";

// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";
import { DrawerParamToggler } from "../drawer";
import { RuntimeClassTolerations } from "./runtime-classes-tolerations";

import type { KubeObject, Toleration } from "@skuberplus/kube-object";

export interface KubeObjectWithTolerations extends KubeObject {
  getTolerations(): Toleration[];
}

export interface RuntimeClassDetailsTolerationsProps {
  runtimeClass: KubeObjectWithTolerations;
}

export function RuntimeClassDetailsTolerations({ runtimeClass: runtimeClass }: RuntimeClassDetailsTolerationsProps) {
  const tolerations = runtimeClass.getTolerations();

  if (!tolerations.length) return null;

  // 🎯 shadcn DetailPanelField로 마이그레이션 완료
  return (
    <DetailPanelField label="Tolerations" className="RuntimeClassDetailsTolerations">
      <DrawerParamToggler label={tolerations.length}>
        <RuntimeClassTolerations tolerations={tolerations} />
      </DrawerParamToggler>
    </DetailPanelField>
  );
}
