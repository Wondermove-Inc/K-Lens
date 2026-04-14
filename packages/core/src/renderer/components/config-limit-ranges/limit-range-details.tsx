/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./limit-range-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { LimitPart, LimitRange, Resource } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";

import type { LimitRangeItem } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface LimitRangeDetailsProps extends KubeObjectDetailsProps<LimitRange> {}

function renderLimit(limit: LimitRangeItem, part: LimitPart, resource: Resource) {
  const resourceLimit = limit[part]?.[resource];

  if (!resourceLimit) {
    return null;
  }

  return <Badge variant="outline">{`${part}:${resourceLimit}`}</Badge>;
}

function renderResourceLimits(limit: LimitRangeItem, resource: Resource) {
  return (
    <React.Fragment key={limit.type + resource}>
      {renderLimit(limit, LimitPart.MIN, resource)}
      {renderLimit(limit, LimitPart.MAX, resource)}
      {renderLimit(limit, LimitPart.DEFAULT, resource)}
      {renderLimit(limit, LimitPart.DEFAULT_REQUEST, resource)}
      {renderLimit(limit, LimitPart.MAX_LIMIT_REQUEST_RATIO, resource)}
    </React.Fragment>
  );
}

function renderLimitDetails(limits: LimitRangeItem[], resources: Resource[]) {
  return resources.map((resource) => (
    <DetailPanelField key={resource} label={resource}>
      <div className="flex flex-wrap gap-1">{limits.map((limit) => renderResourceLimits(limit, resource))}</div>
    </DetailPanelField>
  ));
}

interface Dependencies {
  logger: Logger;
}

class NonInjectedLimitRangeDetails extends Component<LimitRangeDetailsProps & Dependencies> {
  render() {
    const { object: limitRange, logger } = this.props;

    if (!limitRange) {
      return null;
    }

    if (!(limitRange instanceof LimitRange)) {
      logger.error("[LimitRangeDetails]: passed object that is not an instanceof LimitRange", limitRange);

      return null;
    }

    const containerLimits = limitRange.getContainerLimits();
    const podLimits = limitRange.getPodLimits();
    const pvcLimits = limitRange.getPVCLimits();

    // 🎯 shadcn DetailPanelField로 마이그레이션 완료
    return (
      <div className="LimitRangeDetails">
        {containerLimits.length > 0 && (
          <DetailPanelField label="Container Limits">
            <div className="flex flex-wrap gap-1">
              {renderLimitDetails(containerLimits, [Resource.CPU, Resource.MEMORY, Resource.EPHEMERAL_STORAGE])}
            </div>
          </DetailPanelField>
        )}
        {podLimits.length > 0 && (
          <DetailPanelField label="Pod Limits">
            <div className="flex flex-wrap gap-1">
              {renderLimitDetails(podLimits, [Resource.CPU, Resource.MEMORY, Resource.EPHEMERAL_STORAGE])}
            </div>
          </DetailPanelField>
        )}
        {pvcLimits.length > 0 && (
          <DetailPanelField label="Persistent Volume Claim Limits">
            <div className="flex flex-wrap gap-1">{renderLimitDetails(pvcLimits, [Resource.STORAGE])}</div>
          </DetailPanelField>
        )}
      </div>
    );
  }
}

export const LimitRangeDetails = withInjectables<Dependencies, LimitRangeDetailsProps>(
  observer(NonInjectedLimitRangeDetails),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
