/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { formatNodeTaint, Node } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import loadPodsFromAllNamespacesInjectable from "../workloads-pods/load-pods-from-all-namespaces.injectable";
import { PodDetailsList } from "../workloads-pods/pod-details-list";
import podStoreInjectable from "../workloads-pods/store.injectable";
import { NodeDetailsResources } from "./details-resources";

import type { Logger } from "@skuberplus/logger";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { PodStore } from "../workloads-pods/store";

export interface NodeDetailsProps extends KubeObjectDetailsProps<Node> {}

interface Dependencies {
  subscribeStores: SubscribeStores;
  podStore: PodStore;
  logger: Logger;
  loadPodsFromAllNamespaces: () => void;
}

class NonInjectedNodeDetails extends Component<NodeDetailsProps & Dependencies> {
  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.podStore])]);

    this.props.loadPodsFromAllNamespaces();
  }

  render() {
    const { object: node, podStore, logger } = this.props;

    if (!node) {
      return null;
    }

    if (!(node instanceof Node)) {
      logger.error("[NodeDetails]: passed object that is not an instanceof Node", node);

      return null;
    }

    const { nodeInfo, addresses } = node.status ?? {};
    const taints = node.getTaints();
    const childPods = podStore.getPodsByNode(node.getName());

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="NodeDetails">
        {addresses && (
          <DetailPanelField label="Addresses">
            {addresses.map(({ type, address }) => (
              <p key={type}>{`${type}: ${address}`}</p>
            ))}
          </DetailPanelField>
        )}
        {nodeInfo && (
          <>
            <DetailPanelField label="OS">{`${nodeInfo.operatingSystem} (${nodeInfo.architecture})`}</DetailPanelField>
            <DetailPanelField label="OS Image">{nodeInfo.osImage}</DetailPanelField>
            <DetailPanelField label="Kernel version">{nodeInfo.kernelVersion}</DetailPanelField>
            <DetailPanelField label="Container runtime">{nodeInfo.containerRuntimeVersion}</DetailPanelField>
            <DetailPanelField label="Kubelet version">{nodeInfo.kubeletVersion}</DetailPanelField>
          </>
        )}
        {taints.length > 0 && (
          <DetailPanelField label="Taints">
            <div className="flex flex-wrap gap-1">
              {taints.map((taint) => (
                <Badge key={taint.key} variant="outline">
                  {formatNodeTaint(taint)}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}
        <KubeObjectConditionsDrawer object={node} />
        <DetailPanelSection title="Capacity">
          <NodeDetailsResources node={node} type="capacity" />
        </DetailPanelSection>
        <DetailPanelSection title="Allocatable">
          <NodeDetailsResources node={node} type="allocatable" />
        </DetailPanelSection>
        <PodDetailsList
          pods={childPods}
          owner={node}
          maxCpu={node.getCpuCapacity()}
          maxMemory={node.getMemoryCapacity()}
        />
      </div>
    );
  }
}

export const NodeDetails = withInjectables<Dependencies, NodeDetailsProps>(observer(NonInjectedNodeDetails), {
  getProps: (di, props) => ({
    ...props,
    subscribeStores: di.inject(subscribeStoresInjectable),
    podStore: di.inject(podStoreInjectable),
    logger: di.inject(loggerInjectionToken),
    loadPodsFromAllNamespaces: di.inject(loadPodsFromAllNamespacesInjectable),
  }),
});
