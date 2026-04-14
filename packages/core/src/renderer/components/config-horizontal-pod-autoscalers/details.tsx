/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { HorizontalPodAutoscaler } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
// 🎯 shadcn Table 컴포넌트로 마이그레이션 (화이트 테마 지원)
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skuberplus/storybook-shadcn/src/components/ui/table";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { getMetricName } from "./get-metric-name";
import getHorizontalPodAutoscalerMetrics from "./get-metrics.injectable";

import type { HorizontalPodAutoscalerMetricSpec, HorizontalPodAutoscalerMetricTarget } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface HpaDetailsProps extends KubeObjectDetailsProps<HorizontalPodAutoscaler> {}

interface Dependencies {
  apiManager: ApiManager;
  logger: Logger;
  getDetailsUrl: GetDetailsUrl;
  getMetrics: (hpa: HorizontalPodAutoscaler) => string[];
}

class NonInjectedHorizontalPodAutoscalerDetails extends Component<HpaDetailsProps & Dependencies> {
  private renderTargetLink(target: HorizontalPodAutoscalerMetricTarget | undefined) {
    if (!target) {
      return null;
    }

    const { object: hpa, apiManager, getDetailsUrl } = this.props;
    const { kind, name } = target;
    const objectUrl = getDetailsUrl(apiManager.lookupApiLink(target, hpa));

    return (
      <>
        on
        <Link to={objectUrl}>{`${kind}/${name}`}</Link>
      </>
    );
  }

  renderMetrics() {
    const { object: hpa } = this.props;

    const renderName = (metric: HorizontalPodAutoscalerMetricSpec) => {
      const metricName = getMetricName(metric);

      switch (metric?.type) {
        case "ContainerResource":

        // fallthrough
        case "Resource": {
          const metricSpec = metric.resource ?? metric.containerResource;

          return `Resource ${metricSpec.name} on Pods`;
        }
        case "Pods":
          return `${metricName ?? ""} on Pods`;

        case "Object": {
          return (
            <>
              {metricName} {this.renderTargetLink(metric.object?.describedObject)}
            </>
          );
        }
        case "External":
          return `${metricName ?? ""} on ${JSON.stringify(metric.external.metricSelector ?? metric.external.metric?.selector)}`;
        default:
          return hpa.spec?.targetCPUUtilizationPercentage ? "CPU Utilization percentage" : "unknown";
      }
    };

    // 🎯 shadcn Table 컴포넌트 (화이트 테마 지원)
    return (
      <Table data-testid="hpa-metrics">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead>Current / Target</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {this.props.getMetrics(hpa).map((metrics, index) => (
            <TableRow key={index}>
              <TableCell>{renderName(hpa.getMetrics()[index])}</TableCell>
              <TableCell>{metrics}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  render() {
    const { object: hpa, apiManager, getDetailsUrl, logger } = this.props;

    if (!hpa) {
      return null;
    }

    if (!(hpa instanceof HorizontalPodAutoscaler)) {
      logger.error("[HpaDetails]: passed object that is not an instanceof HorizontalPodAutoscaler", hpa);

      return null;
    }

    const { scaleTargetRef } = hpa.spec;

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="HpaDetails">
        <DetailPanelField label="Reference">
          {scaleTargetRef && (
            <Link
              to={getDetailsUrl(apiManager.lookupApiLink(scaleTargetRef, hpa))}
              className="text-primary hover:underline"
            >
              {scaleTargetRef.kind}/{scaleTargetRef.name}
            </Link>
          )}
        </DetailPanelField>

        <DetailPanelField label="Min Pods">{hpa.getMinPods()}</DetailPanelField>
        <DetailPanelField label="Max Pods">{hpa.getMaxPods()}</DetailPanelField>
        <DetailPanelField label="Replicas">{hpa.getReplicas()}</DetailPanelField>
        <KubeObjectConditionsDrawer object={hpa} />

        {(hpa.getMetrics().length !== 0 || hpa.spec?.targetCPUUtilizationPercentage) && (
          <DetailPanelSection title="Metrics">
            <div className="metrics">{this.renderMetrics()}</div>
          </DetailPanelSection>
        )}
      </div>
    );
  }
}

export const HorizontalPodAutoscalerDetails = withInjectables<Dependencies, HpaDetailsProps>(
  observer(NonInjectedHorizontalPodAutoscalerDetails),
  {
    getProps: (di, props) => ({
      ...props,
      apiManager: di.inject(apiManagerInjectable),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      logger: di.inject(loggerInjectionToken),
      getMetrics: di.inject(getHorizontalPodAutoscalerMetrics),
    }),
  },
);
