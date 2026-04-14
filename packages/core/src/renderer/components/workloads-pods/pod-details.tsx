/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Pod 리소스 상세 정보 패널 컴포넌트
 *
 * @remarks
 * - shadcn Badge로 마이그레이션 완료
 * - Status, Pod IPs, Node Selector를 shadcn Badge로 표시
 *
 * 🔄 변경이력:
 * - 2025-11-12: 레거시 Badge → shadcn Badge 마이그레이션
 */

import "./pod-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Pod } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { formatDuration } from "@skuberplus/utilities";
import kebabCase from "lodash/kebabCase";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { LinkToNode, LinkToPriorityClass, LinkToRuntimeClass, LinkToServiceAccount } from "../kube-object-link";
import { PodDetailsContainers } from "./details/containers/pod-details-containers";
import { PodDetailsEphemeralContainers } from "./details/containers/pod-details-ephemeral-containers";
import { PodDetailsInitContainers } from "./details/containers/pod-details-init-containers";
import { PodVolumes } from "./details/volumes/view";
import { PodDetailsAffinities } from "./pod-details-affinities";
import { PodDetailsSecrets } from "./pod-details-secrets";
import { PodDetailsTolerations } from "./pod-details-tolerations";

import type { Logger } from "@skuberplus/logger";

import type { KubeObjectDetailsProps } from "../kube-object-details";

/**
 * 🎯 목적: Pod 상태에 따른 Badge variant 결정
 */
function getPodStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const lowerStatus = status.toLowerCase();

  if (lowerStatus.includes("running") || lowerStatus.includes("succeeded")) {
    return "secondary";
  }
  if (lowerStatus.includes("failed") || lowerStatus.includes("error")) {
    return "destructive";
  }
  if (lowerStatus.includes("pending") || lowerStatus.includes("unknown")) {
    return "outline";
  }

  return "default";
}

export interface PodDetailsProps extends KubeObjectDetailsProps<Pod> {}

interface Dependencies {
  logger: Logger;
}

class NonInjectedPodDetails extends Component<PodDetailsProps & Dependencies> {
  render() {
    const { object: pod, logger } = this.props;

    if (!pod) {
      return null;
    }

    if (!(pod instanceof Pod)) {
      logger.error("[PodDetails]: passed object that is not an instanceof Pod", pod);

      return null;
    }

    const { status, spec } = pod;
    const { podIP } = status ?? {};
    const podIPs = pod.getIPs();
    const { nodeName } = spec ?? {};
    const nodeSelector = pod.getNodeSelectors();

    const namespace = pod.getNs();
    const priorityClassName = pod.getPriorityClassName();
    const runtimeClassName = pod.getRuntimeClassName();
    const serviceAccountName = pod.getServiceAccountName();

    // 🎯 Pod 상태 메시지 및 variant
    const statusMessage = pod.getStatusMessage();
    const statusVariant = getPodStatusVariant(statusMessage);

    return (
      <div className="PodDetails">
        <DetailPanelField label="Status">
          <Badge variant={statusVariant} className={kebabCase(statusMessage)}>
            {statusMessage}
          </Badge>
        </DetailPanelField>
        {nodeName && (
          <DetailPanelField label="Node">
            <LinkToNode name={nodeName} />
          </DetailPanelField>
        )}
        <DetailPanelField label="Pod IP">{podIP}</DetailPanelField>
        {podIPs.length > 0 && (
          <DetailPanelField label="Pod IPs">
            <div className="flex gap-1 flex-wrap">
              {podIPs.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}
        <DetailPanelField label="Service Account">
          <LinkToServiceAccount name={serviceAccountName} namespace={namespace} />
        </DetailPanelField>
        {priorityClassName && (
          <DetailPanelField label="Priority Class">
            <LinkToPriorityClass name={priorityClassName} />
          </DetailPanelField>
        )}
        <DetailPanelField label="QoS Class">{pod.getQosClass()}</DetailPanelField>
        {runtimeClassName && (
          <DetailPanelField label="Runtime Class">
            <LinkToRuntimeClass name={runtimeClassName} />
          </DetailPanelField>
        )}
        <DetailPanelField label="Termination Grace Period">
          {formatDuration((pod.spec.terminationGracePeriodSeconds ?? 30) * 1000, false)}
        </DetailPanelField>

        {nodeSelector.length > 0 && (
          <DetailPanelField label="Node Selector">
            <div className="flex gap-1 flex-wrap">
              {nodeSelector.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}

        <PodDetailsTolerations workload={pod} />
        <PodDetailsAffinities workload={pod} />

        {pod.getSecrets().length > 0 && (
          <DetailPanelField label="Secrets">
            <PodDetailsSecrets pod={pod} />
          </DetailPanelField>
        )}

        <KubeObjectConditionsDrawer object={pod} />

        <PodDetailsInitContainers pod={pod} />

        <PodDetailsContainers pod={pod} />

        <PodDetailsEphemeralContainers pod={pod} />

        <PodVolumes pod={pod} />
      </div>
    );
  }
}

export const PodDetails = withInjectables<Dependencies, PodDetailsProps>(observer(NonInjectedPodDetails), {
  getProps: (di, props) => ({
    ...props,
    logger: di.inject(loggerInjectionToken),
  }),
});
