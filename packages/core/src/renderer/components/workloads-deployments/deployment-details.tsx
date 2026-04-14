/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./deployment-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Deployment } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { PodDetailsAffinities } from "../workloads-pods/pod-details-affinities";
import { PodDetailsList } from "../workloads-pods/pod-details-list";
import { PodDetailsTolerations } from "../workloads-pods/pod-details-tolerations";
import replicaSetStoreInjectable from "../workloads-replicasets/store.injectable";
import { DeploymentReplicaSets } from "./deployment-replicasets";
import deploymentStoreInjectable from "./store.injectable";

import type { Logger } from "@skuberplus/logger";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { ReplicaSetStore } from "../workloads-replicasets/store";
import type { DeploymentStore } from "./store";

export interface DeploymentDetailsProps extends KubeObjectDetailsProps<Deployment> {}

interface Dependencies {
  subscribeStores: SubscribeStores;
  replicaSetStore: ReplicaSetStore;
  deploymentStore: DeploymentStore;
  logger: Logger;
}

class NonInjectedDeploymentDetails extends Component<DeploymentDetailsProps & Dependencies> {
  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.replicaSetStore])]);
  }

  render() {
    const { object: deployment, replicaSetStore, deploymentStore, logger } = this.props;

    if (!deployment) {
      return null;
    }

    if (!(deployment instanceof Deployment)) {
      logger.error("[DeploymentDetails]: passed object that is not an instanceof Deployment", deployment);

      return null;
    }

    const { status, spec } = deployment;
    const nodeSelector = deployment.getNodeSelectors();
    const selectors = deployment.getSelectors();
    const childPods = deploymentStore.getChildPods(deployment);
    const replicaSets = replicaSetStore.getReplicaSetsByOwner(deployment);

    // 🎯 shadcn DetailPanelField로 마이그레이션 완료
    return (
      <div className="DeploymentDetails">
        <DetailPanelField label="Replicas">
          {`${spec.replicas} desired, ${status?.updatedReplicas ?? 0} updated, `}
          {`${status?.replicas ?? 0} total, ${status?.availableReplicas ?? 0} available, `}
          {`${status?.unavailableReplicas ?? 0} unavailable`}
        </DetailPanelField>
        {selectors.length > 0 && (
          <DetailPanelField label="Selector">
            <div className="flex flex-wrap gap-1">
              {selectors.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}
        {nodeSelector.length > 0 && (
          <DetailPanelField label="Node Selector">
            <div className="flex flex-wrap gap-1">
              {nodeSelector.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}
        <DetailPanelField label="Strategy Type">{spec.strategy.type}</DetailPanelField>
        <KubeObjectConditionsDrawer object={deployment} />
        <PodDetailsTolerations workload={deployment} />
        <PodDetailsAffinities workload={deployment} />
        <DeploymentReplicaSets replicaSets={replicaSets} />
        <PodDetailsList pods={childPods} owner={deployment} />
      </div>
    );
  }
}

export const DeploymentDetails = withInjectables<Dependencies, DeploymentDetailsProps>(
  observer(NonInjectedDeploymentDetails),
  {
    getProps: (di, props) => ({
      ...props,
      subscribeStores: di.inject(subscribeStoresInjectable),
      replicaSetStore: di.inject(replicaSetStoreInjectable),
      deploymentStore: di.inject(deploymentStoreInjectable),
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
