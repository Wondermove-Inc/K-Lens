/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./endpoint-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Endpoints } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerTitle 대체
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { EndpointSubsetList } from "./endpoint-subset-list";

import type { Logger } from "@skuberplus/logger";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface EndpointsDetailsProps extends KubeObjectDetailsProps<Endpoints> {}

interface Dependencies {
  logger: Logger;
}

class NonInjectedEndpointsDetails extends Component<EndpointsDetailsProps & Dependencies> {
  render() {
    const { object: endpoint } = this.props;

    if (!endpoint) {
      return null;
    }

    if (!(endpoint instanceof Endpoints)) {
      this.props.logger.error("[EndpointDetails]: passed object that is not an instanceof Endpoint", endpoint);

      return null;
    }

    // 🎯 shadcn DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="EndpointDetails">
        <DetailPanelSection title="Subsets">
          {endpoint.getEndpointSubsets().map((subset) => (
            <EndpointSubsetList key={subset.toString()} subset={subset} endpoint={endpoint} />
          ))}
        </DetailPanelSection>
      </div>
    );
  }
}

export const EndpointsDetails = withInjectables<Dependencies, EndpointsDetailsProps>(
  observer(NonInjectedEndpointsDetails),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
