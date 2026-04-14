/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React from "react";
import { PodDetailsContainer } from "../../pod-details-container";

import type { Pod } from "@skuberplus/kube-object";

interface PodDetailsContainersProps {
  pod: Pod;
}

const PodDetailsInitContainers = observer(({ pod }: PodDetailsContainersProps) => {
  const initContainers = pod.getInitContainersWithType();

  if (initContainers.length === 0) {
    return null;
  }

  return (
    <DetailPanelSection title="Init Containers">
      {initContainers.map((container) => (
        <PodDetailsContainer key={container.name} pod={pod} container={container} />
      ))}
    </DetailPanelSection>
  );
});

export { PodDetailsInitContainers };
