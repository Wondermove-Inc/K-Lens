/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./vpa-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import {
  ContainerScalingMode,
  ControlledValues,
  ResourceName,
  UpdateMode,
  VerticalPodAutoscaler,
} from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { cssNames } from "@skuberplus/utilities";
import startCase from "lodash/startCase";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";

import type { PodResourcePolicy, PodUpdatePolicy, VerticalPodAutoscalerStatus } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface VpaDetailsProps extends KubeObjectDetailsProps<VerticalPodAutoscaler> {}

interface Dependencies {
  apiManager: ApiManager;
  getDetailsUrl: GetDetailsUrl;
  logger: Logger;
}

class NonInjectedVpaDetails extends Component<VpaDetailsProps & Dependencies> {
  // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
  renderStatus(status: VerticalPodAutoscalerStatus) {
    const { recommendation } = status;
    const { object: vpa } = this.props;

    return (
      <div>
        <DetailPanelSection title="Status">
          <DetailPanelField label="Status">
            <div className="flex flex-wrap gap-1">
              {vpa.getReadyConditions().map(({ type, tooltip, isReady }) => (
                <Badge key={type} variant="outline" title={tooltip} className={cssNames({ [type]: isReady })}>
                  {type}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        </DetailPanelSection>

        {recommendation?.containerRecommendations &&
          recommendation.containerRecommendations.map(
            ({ containerName, target, lowerBound, upperBound, uncappedTarget }) => (
              <DetailPanelSection
                key={containerName}
                title={`Container Recommendation for ${containerName ?? "<unknown>"}`}
              >
                <DetailPanelField label="target">
                  {Object.entries(target).map(([name, value]) => (
                    <DetailPanelField key={name} label={startCase(name)}>
                      {value}
                    </DetailPanelField>
                  ))}
                </DetailPanelField>
                {lowerBound && (
                  <DetailPanelField label="lowerBound">
                    {Object.entries(lowerBound).map(([name, value]) => (
                      <DetailPanelField key={name} label={startCase(name)}>
                        {value}
                      </DetailPanelField>
                    ))}
                  </DetailPanelField>
                )}
                {upperBound && (
                  <DetailPanelField label="upperBound">
                    {Object.entries(upperBound).map(([name, value]) => (
                      <DetailPanelField key={name} label={startCase(name)}>
                        {value}
                      </DetailPanelField>
                    ))}
                  </DetailPanelField>
                )}
                {uncappedTarget && (
                  <DetailPanelField label="uncappedTarget">
                    {Object.entries(uncappedTarget).map(([name, value]) => (
                      <DetailPanelField key={name} label={startCase(name)}>
                        {value}
                      </DetailPanelField>
                    ))}
                  </DetailPanelField>
                )}
              </DetailPanelSection>
            ),
          )}
      </div>
    );
  }

  renderUpdatePolicy(updatePolicy: PodUpdatePolicy) {
    return (
      <DetailPanelSection title="Update Policy">
        <DetailPanelField label="updateMode">{updatePolicy?.updateMode ?? UpdateMode.UpdateModeAuto}</DetailPanelField>
        <DetailPanelField label="minReplicas">{updatePolicy?.minReplicas}</DetailPanelField>
      </DetailPanelSection>
    );
  }

  renderResourcePolicy(resourcePolicy: PodResourcePolicy) {
    return (
      <div>
        {resourcePolicy.containerPolicies && (
          <div>
            {resourcePolicy.containerPolicies.map(
              ({ containerName, mode, minAllowed, maxAllowed, controlledResources, controlledValues }) => {
                return (
                  <DetailPanelSection
                    key={containerName}
                    title={`Container Policy for ${containerName ?? "<unknown>"}`}
                  >
                    <DetailPanelField label="mode">
                      {mode ?? ContainerScalingMode.ContainerScalingModeAuto}
                    </DetailPanelField>
                    {minAllowed && (
                      <DetailPanelField label="minAllowed">
                        {Object.entries(minAllowed).map(([name, value]) => (
                          <DetailPanelField key={name} label={startCase(name)}>
                            {value}
                          </DetailPanelField>
                        ))}
                      </DetailPanelField>
                    )}
                    {maxAllowed && (
                      <DetailPanelField label="maxAllowed">
                        {Object.entries(maxAllowed).map(([name, value]) => (
                          <DetailPanelField key={name} label={startCase(name)}>
                            {value}
                          </DetailPanelField>
                        ))}
                      </DetailPanelField>
                    )}
                    <DetailPanelField label="controlledResources">
                      {controlledResources?.length
                        ? controlledResources.join(", ")
                        : `${ResourceName.ResourceCPU}, ${ResourceName.ResourceMemory}`}
                    </DetailPanelField>
                    <DetailPanelField label="controlledValues">
                      {controlledValues ?? ControlledValues.ControlledValueRequestsAndLimits}
                    </DetailPanelField>
                  </DetailPanelSection>
                );
              },
            )}
          </div>
        )}
      </div>
    );
  }

  render() {
    const { object: vpa, apiManager, getDetailsUrl, logger } = this.props;

    if (!vpa) {
      return null;
    }

    if (!(vpa instanceof VerticalPodAutoscaler)) {
      logger.error("[VpaDetails]: passed object that is not an instanceof VerticalPodAutoscaler", vpa);

      return null;
    }

    const { targetRef, recommenders, resourcePolicy, updatePolicy } = vpa.spec;

    return (
      <div className="VpaDetails">
        <DetailPanelField label="Reference">
          {targetRef && (
            <Link to={getDetailsUrl(apiManager.lookupApiLink(targetRef, vpa))} className="text-primary hover:underline">
              {targetRef.kind}/{targetRef.name}
            </Link>
          )}
        </DetailPanelField>

        <DetailPanelField label="Recommender">
          {
            /* according to the spec there can be 0 or 1 recommenders, only */
            recommenders?.length ? recommenders[0].name : "default"
          }
        </DetailPanelField>

        {vpa.status && this.renderStatus(vpa.status)}
        {updatePolicy && this.renderUpdatePolicy(updatePolicy)}
        {resourcePolicy && this.renderResourcePolicy(resourcePolicy)}

        <DetailPanelSection title="CRD details">
          <span />
        </DetailPanelSection>
      </div>
    );
  }
}

export const VpaDetails = withInjectables<Dependencies, VpaDetailsProps>(observer(NonInjectedVpaDetails), {
  getProps: (di, props) => ({
    ...props,
    apiManager: di.inject(apiManagerInjectable),
    getDetailsUrl: di.inject(getDetailsUrlInjectable),
    logger: di.inject(loggerInjectionToken),
  }),
});
