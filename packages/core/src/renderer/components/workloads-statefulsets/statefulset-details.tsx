/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./statefulset-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { StatefulSet } from "@skuberplus/kube-object";
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
import statefulSetStoreInjectable from "./store.injectable";

import type { Logger } from "@skuberplus/logger";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { PodStore } from "../workloads-pods/store";
import type { StatefulSetStore } from "./store";

export interface StatefulSetDetailsProps extends KubeObjectDetailsProps<StatefulSet> {}

interface Dependencies {
  subscribeStores: SubscribeStores;
  podStore: PodStore;
  statefulSetStore: StatefulSetStore;
  logger: Logger;
}

class NonInjectedStatefulSetDetails extends Component<StatefulSetDetailsProps & Dependencies> {
  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.podStore])]);
  }

  render() {
    const { object: statefulSet, statefulSetStore, logger } = this.props;

    if (!statefulSet) {
      return null;
    }

    if (!(statefulSet instanceof StatefulSet)) {
      logger.error("[StatefulSetDetails]: passed object that is not an instanceof StatefulSet", statefulSet);

      return null;
    }

    const images = statefulSet.getImages();
    const selectors = statefulSet.getSelectors();
    const nodeSelector = statefulSet.getNodeSelectors();
    const childPods = statefulSetStore.getChildPods(statefulSet);

    // 🎯 shadcn DetailPanelField로 마이그레이션 완료
    return (
      <div className="StatefulSetDetails">
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
        <PodDetailsTolerations workload={statefulSet} />
        <PodDetailsAffinities workload={statefulSet} />
        <DetailPanelField label="Pod Status">
          <PodDetailsStatuses pods={childPods} />
        </DetailPanelField>
        <PodDetailsList pods={childPods} owner={statefulSet} />
      </div>
    );
  }
}

export const StatefulSetDetails = withInjectables<Dependencies, StatefulSetDetailsProps>(
  observer(NonInjectedStatefulSetDetails),
  {
    getProps: (di, props) => ({
      ...props,
      subscribeStores: di.inject(subscribeStoresInjectable),
      podStore: di.inject(podStoreInjectable),
      statefulSetStore: di.inject(statefulSetStoreInjectable),
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
