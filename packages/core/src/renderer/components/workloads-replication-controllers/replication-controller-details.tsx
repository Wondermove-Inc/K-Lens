/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { replicationControllerApiInjectable } from "@skuberplus/kube-api-specifics";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle/Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { Slider } from "../slider";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import styles from "./replication-controller-details.module.scss";

import type { ReplicationControllerApi } from "@skuberplus/kube-api";
import type { ReplicationController } from "@skuberplus/kube-object";

import type { Cluster } from "../../../common/cluster/cluster";
import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface ReplicationControllerDetailsProps extends KubeObjectDetailsProps<ReplicationController> {}

interface Dependencies {
  api: ReplicationControllerApi;
  hostedCluster: Cluster | undefined;
}

class NonInjectedReplicationControllerDetails<
  Props extends ReplicationControllerDetailsProps & Dependencies,
> extends Component<Props> {
  @observable sliderReplicasValue = this.props.object.getDesiredReplicas();
  @observable sliderReplicasDisabled = false;

  constructor(props: Props) {
    super(props);
    makeObservable(this);
  }

  @action
  async scale(replicas: number) {
    const { object: resource, api, hostedCluster } = this.props;
    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

    try {
      await api.scale(
        {
          name: resource.getName(),
          namespace: resource.getNs(),
        },
        replicas,
      );
    } catch (error) {
      this.sliderReplicasValue = resource.getDesiredReplicas(); // rollback to last valid value
      notificationPanelStore.addError("operations", "Error", error instanceof Error ? error.message : String(error), {
        clusterName,
      });
    }
  }

  @action
  async onScaleSliderChangeCommitted(evt: React.SyntheticEvent | Event, replicas: number) {
    this.sliderReplicasDisabled = true;
    await this.scale(replicas);
    this.sliderReplicasDisabled = false;
  }

  // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
  render() {
    const { object: resource } = this.props;

    return (
      <div className={styles.ReplicationControllerDetails}>
        <DetailPanelSection title="Spec">
          <DetailPanelField label="Replicas">
            <div className={styles.replicas}>
              <div>{resource.getDesiredReplicas()}</div>
              <div>Scale</div>
              <Slider
                min={0}
                max={100}
                valueLabelDisplay="auto"
                disabled={this.sliderReplicasDisabled}
                value={this.sliderReplicasValue}
                onChange={(evt, value) => (this.sliderReplicasValue = value)}
                onChangeCommitted={(event, value) => this.onScaleSliderChangeCommitted(event, value as number)}
              />
            </div>
          </DetailPanelField>
          <DetailPanelField label="Selectors">
            <div className="flex flex-wrap gap-1">
              {resource.getSelectorLabels().map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        </DetailPanelSection>

        <DetailPanelSection title="Status">
          <DetailPanelField label="Replicas">{resource.getReplicas()}</DetailPanelField>
          <DetailPanelField label="Available Replicas">{resource.getAvailableReplicas()}</DetailPanelField>
          <DetailPanelField label="Labeled Replicas">{resource.getLabeledReplicas()}</DetailPanelField>
          <DetailPanelField label="Controller Generation">{resource.getGeneration()}</DetailPanelField>
          <DetailPanelField label="Minimum Pod Readiness">{`${resource.getMinReadySeconds()} seconds`}</DetailPanelField>
        </DetailPanelSection>
      </div>
    );
  }
}

export const ReplicationControllerDetails = withInjectables<Dependencies, ReplicationControllerDetailsProps>(
  observer(NonInjectedReplicationControllerDetails),
  {
    getProps: (di, props) => ({
      ...props,
      api: di.inject(replicationControllerApiInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
