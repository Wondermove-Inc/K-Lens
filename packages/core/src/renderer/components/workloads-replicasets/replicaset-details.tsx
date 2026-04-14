/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./replicaset-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { ReplicaSet } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { PodDetailsAffinities } from "../workloads-pods/pod-details-affinities";
import { PodDetailsList } from "../workloads-pods/pod-details-list";
import { PodDetailsStatuses } from "../workloads-pods/pod-details-statuses";
import { PodDetailsTolerations } from "../workloads-pods/pod-details-tolerations";
import podStoreInjectable from "../workloads-pods/store.injectable";
import replicaSetStoreInjectable from "./store.injectable";

import type { Logger } from "@skuberplus/logger";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { PodStore } from "../workloads-pods/store";
import type { ReplicaSetStore } from "./store";

export interface ReplicaSetDetailsProps extends KubeObjectDetailsProps<ReplicaSet> {}

interface Dependencies {
  subscribeStores: SubscribeStores;
  podStore: PodStore;
  replicaSetStore: ReplicaSetStore;
  logger: Logger;
}

class NonInjectedReplicaSetDetails extends Component<ReplicaSetDetailsProps & Dependencies> {
  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.podStore])]);
  }
  render() {
    const { object: replicaSet, replicaSetStore, logger } = this.props;

    if (!replicaSet) {
      return null;
    }

    if (!(replicaSet instanceof ReplicaSet)) {
      logger.error("[ReplicaSetDetails]: passed object that is not an instanceof ReplicaSet", replicaSet);

      return null;
    }

    const { availableReplicas, replicas } = replicaSet.status ?? {};
    const selectors = replicaSet.getSelectors();
    const nodeSelector = replicaSet.getNodeSelectors();
    const images = replicaSet.getImages();
    const childPods = replicaSetStore.getChildPods(replicaSet);

    // 🎯 shadcn DetailPanelField로 마이그레이션 완료
    return (
      <div className="ReplicaSetDetails">
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
        {images.length > 0 && (
          <DetailPanelField label="Images">
            {images.map((image) => (
              <p key={image}>{image}</p>
            ))}
          </DetailPanelField>
        )}
        <DetailPanelField label="Replicas">{`${availableReplicas || 0} current / ${replicas || 0} desired`}</DetailPanelField>
        <PodDetailsTolerations workload={replicaSet} />
        <PodDetailsAffinities workload={replicaSet} />
        <DetailPanelField label="Pod Status">
          <PodDetailsStatuses pods={childPods} />
        </DetailPanelField>
        <PodDetailsList pods={childPods} owner={replicaSet} />
      </div>
    );
  }
}

export const ReplicaSetDetails = withInjectables<Dependencies, ReplicaSetDetailsProps>(
  observer(NonInjectedReplicaSetDetails),
  {
    getProps: (di, props) => ({
      ...props,
      subscribeStores: di.inject(subscribeStoresInjectable),
      podStore: di.inject(podStoreInjectable),
      replicaSetStore: di.inject(replicaSetStoreInjectable),
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
