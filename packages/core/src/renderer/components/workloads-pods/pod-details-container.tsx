/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./pod-details-container.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { podDetailsContainerMetricsInjectionToken } from "@skuberplus/metrics";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelFieldGroup,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { cssNames, isDefined } from "@skuberplus/utilities";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import { ClusterMetricsResourceType } from "../../../common/cluster-types";
import enabledMetricsInjectable from "../../api/catalog/entity/metrics-enabled.injectable";
import portForwardStoreInjectable from "../../port-forward/port-forward-store/port-forward-store.injectable";
import { DurationAbsoluteTimestamp } from "../events";
import { StatusBrick } from "../status-brick";
import { containerStatusClassName } from "./container-status-class-name";
import { ContainerEnvironment } from "./pod-container-env";
import { PodContainerPort } from "./pod-container-port";

import type { ContainerWithType, EphemeralContainerWithType, Pod, PodContainerStatus } from "@skuberplus/kube-object";
import type { PodDetailsContainerMetricsComponent } from "@skuberplus/metrics";

import type { IComputedValue } from "mobx";

import type { PortForwardStore } from "../../port-forward";

export interface PodDetailsContainerProps {
  pod: Pod;
  container: ContainerWithType | EphemeralContainerWithType;
}

interface Dependencies {
  portForwardStore: PortForwardStore;
  containerMetricsVisible: IComputedValue<boolean>;
  containerMetrics: PodDetailsContainerMetricsComponent[];
}

class NonInjectedPodDetailsContainer extends Component<PodDetailsContainerProps & Dependencies> {
  componentDidMount() {
    disposeOnUnmount(this, [this.props.portForwardStore.watch()]);
  }

  renderStatus(container: ContainerWithType | EphemeralContainerWithType, status?: PodContainerStatus) {
    const state = status ? Object.keys(status?.state ?? {})[0] : "unknown";
    const terminated = status?.state ? (status?.state.terminated ?? "") : "";

    return (
      <span className={cssNames("status", containerStatusClassName(container, status))}>
        {state}
        {container.type === "initContainers" ? ", init" : ""}
        {container.type === "ephemeralContainers" ? ", ephemeral" : ""}
        {status?.restartCount ? ", restarted" : ""}
        {status?.ready ? ", ready" : ""}
        {terminated ? ` - ${terminated.reason} (exit code: ${terminated.exitCode})` : ""}
      </span>
    );
  }

  renderLastState(lastState: string, status: PodContainerStatus | null | undefined) {
    const { lastState: lastContainerState = {} } = status ?? {};
    const { terminated } = lastContainerState;

    if (terminated) {
      return (
        <span>
          {lastState}
          <br />
          {`Reason: ${terminated.reason} - exit code: ${terminated.exitCode}`}
          <br />
          {"Started: "}
          {<DurationAbsoluteTimestamp timestamp={terminated.startedAt} />}
          <br />
          {"Finished: "}
          {<DurationAbsoluteTimestamp timestamp={terminated.finishedAt} />}
          <br />
        </span>
      );
    }

    return null;
  }

  render() {
    const { pod, container, containerMetricsVisible, containerMetrics } = this.props;

    if (!pod || !container) return null;
    const { name, image, imagePullPolicy, ports, volumeMounts, command, args, resources } = container;
    const id = `pod-container-id-${pod}-${name}`;
    const targetContainerName = "targetContainerName" in container ? container.targetContainerName : undefined;
    const status = pod.getContainerStatuses().find((status) => status.name === container.name);
    const lastState = status ? Object.keys(status?.lastState ?? {})[0] : "";
    const imageId = status ? status.imageID : "";
    const liveness = pod.getLivenessProbe(container);
    const readiness = pod.getReadinessProbe(container);
    const startup = pod.getStartupProbe(container);
    const containersType = container.type;
    const isMetricVisible = containerMetricsVisible.get();
    const requests = Object.entries(resources?.requests ?? {});
    const limits = Object.entries(resources?.limits ?? {});

    return (
      <div className="PodDetailsContainer">
        <div className="pod-container-title" id={id}>
          <StatusBrick className={containerStatusClassName(container, status)} />
          {name}
        </div>
        {isMetricVisible && containersType === "containers" && (
          <>
            {containerMetrics.map((ContainerMetrics) => (
              <ContainerMetrics.Component key={ContainerMetrics.id} container={container} pod={pod} />
            ))}
          </>
        )}
        <DetailPanelFieldGroup>
          {targetContainerName && (
            <DetailPanelField label="Target Container">
              <a href={`#pod-container-id-${pod.getName()}-${targetContainerName}`}>{targetContainerName}</a>
            </DetailPanelField>
          )}
          {status && <DetailPanelField label="Status">{this.renderStatus(container, status)}</DetailPanelField>}
          {lastState && (
            <DetailPanelField label="Last Status">{this.renderLastState(lastState, status)}</DetailPanelField>
          )}
          <DetailPanelField label="Image">
            <Badge variant="secondary" title={imageId}>
              {image}
            </Badge>
          </DetailPanelField>
          {imagePullPolicy && imagePullPolicy !== "IfNotPresent" && (
            <DetailPanelField label="ImagePullPolicy">{imagePullPolicy}</DetailPanelField>
          )}
          {ports && ports.length > 0 && (
            <DetailPanelField label="Ports">
              {ports.filter(isDefined).map((port) => (
                <PodContainerPort
                  pod={pod}
                  port={port}
                  key={`${container.name}-port-${port.containerPort}-${port.protocol}`}
                />
              ))}
            </DetailPanelField>
          )}
          {<ContainerEnvironment container={container} namespace={pod.getNs()} />}
          {volumeMounts && volumeMounts.length > 0 && (
            <DetailPanelField label="Mounts">
              {volumeMounts.map((mount) => {
                const { name, mountPath, readOnly } = mount;

                return (
                  <React.Fragment key={name + mountPath}>
                    <Badge variant="outline" className="font-mono">
                      {mountPath}
                    </Badge>
                    <span className="text-sm text-muted-foreground ml-2">{`from ${name} (${readOnly ? "ro" : "rw"})`}</span>
                  </React.Fragment>
                );
              })}
            </DetailPanelField>
          )}
          {liveness.length > 0 && (
            <DetailPanelField label="Liveness">
              {liveness.map((value, index) => (
                <Badge key={index} variant="secondary">
                  {value}
                </Badge>
              ))}
            </DetailPanelField>
          )}
          {readiness.length > 0 && (
            <DetailPanelField label="Readiness">
              {readiness.map((value, index) => (
                <Badge key={index} variant="secondary">
                  {value}
                </Badge>
              ))}
            </DetailPanelField>
          )}
          {startup.length > 0 && (
            <DetailPanelField label="Startup">
              {startup.map((value, index) => (
                <Badge key={index} variant="secondary">
                  {value}
                </Badge>
              ))}
            </DetailPanelField>
          )}
          {command && <DetailPanelField label="Command">{command.join(" ")}</DetailPanelField>}

          {args && <DetailPanelField label="Arguments">{args.join(" ")}</DetailPanelField>}

          {requests.length > 0 && (
            <DetailPanelField label="Requests">
              {requests.map(([key, value], index) => (
                <Badge key={index} variant="secondary">{`${key}=${value}`}</Badge>
              ))}
            </DetailPanelField>
          )}

          {limits.length > 0 && (
            <DetailPanelField label="Limits">
              {limits.map(([key, value], index) => (
                <Badge key={index} variant="secondary">{`${key}=${value}`}</Badge>
              ))}
            </DetailPanelField>
          )}
        </DetailPanelFieldGroup>
      </div>
    );
  }
}

export const PodDetailsContainer = withInjectables<Dependencies, PodDetailsContainerProps>(
  observer(NonInjectedPodDetailsContainer),
  {
    getProps: (di, props) => ({
      ...props,
      portForwardStore: di.inject(portForwardStoreInjectable),
      containerMetricsVisible: di.inject(enabledMetricsInjectable, ClusterMetricsResourceType.Container),
      containerMetrics: di.injectMany(podDetailsContainerMetricsInjectionToken),
    }),
  },
);
