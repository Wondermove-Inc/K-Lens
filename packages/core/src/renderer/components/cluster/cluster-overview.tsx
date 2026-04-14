/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
// 🎯 shadcn UI 컴포넌트 import
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@skuberplus/storybook-shadcn/src/components/ui/empty";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import { ClusterMetricsResourceType } from "../../../common/cluster-types";
import enabledMetricsInjectable from "../../api/catalog/entity/metrics-enabled.injectable";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import eventStoreInjectable from "../events/store.injectable";
import { TabLayout } from "../layout/tab-layout";
import nodeStoreInjectable from "../nodes/store.injectable";
import podStoreInjectable from "../workloads-pods/store.injectable";
import { ClusterIssues } from "./cluster-issues";
import { ClusterOverviewChartDefault } from "./cluster-overview-chart-default";

import type { IComputedValue } from "mobx";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { EventStore } from "../events/store";
import type { NodeStore } from "../nodes/store";
import type { PodStore } from "../workloads-pods/store";

interface Dependencies {
  subscribeStores: SubscribeStores;
  podStore: PodStore;
  eventStore: EventStore;
  nodeStore: NodeStore;
  clusterMetricsAreVisible: IComputedValue<boolean>;
}

class NonInjectedClusterOverview extends Component<Dependencies> {
  componentDidMount() {
    disposeOnUnmount(this, [
      this.props.subscribeStores([this.props.podStore, this.props.eventStore, this.props.nodeStore]),
    ]);
  }

  renderWithMetrics() {
    return (
      <>
        {/* 🎯 Store 직접 구독하는 ClusterOverviewChartDefault 컴포넌트 사용 */}
        <ClusterOverviewChartDefault className="flex min-w-0 flex-col" />
        <ClusterIssues />
      </>
    );
  }

  render() {
    const { eventStore, nodeStore, clusterMetricsAreVisible } = this.props;
    const isMetricsHidden = !clusterMetricsAreVisible.get();

    return (
      <TabLayout scrollable>
        <div className="flex min-h-[650px] flex-col gap-6 pr-4" data-testid="cluster-overview-page">
          {!nodeStore.isLoaded || !eventStore.isLoaded ? (
            <Empty className="h-[400px]">
              <EmptyHeader>
                <EmptyTitle>Loading Cluster Overview...</EmptyTitle>
                <EmptyDescription>Collecting cluster data. Please wait...</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : isMetricsHidden ? (
            <ClusterIssues className="OnlyClusterIssues" />
          ) : (
            this.renderWithMetrics()
          )}
        </div>
      </TabLayout>
    );
  }
}

export const ClusterOverview = withInjectables<Dependencies>(observer(NonInjectedClusterOverview), {
  getProps: (di) => ({
    subscribeStores: di.inject(subscribeStoresInjectable),
    clusterMetricsAreVisible: di.inject(enabledMetricsInjectable, ClusterMetricsResourceType.Cluster),
    podStore: di.inject(podStoreInjectable),
    eventStore: di.inject(eventStoreInjectable),
    nodeStore: di.inject(nodeStoreInjectable),
  }),
});
