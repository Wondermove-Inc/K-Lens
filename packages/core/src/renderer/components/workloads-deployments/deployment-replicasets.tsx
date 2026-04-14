/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./deployment-replicasets.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Spinner } from "@skuberplus/spinner";
// 🎯 shadcn UI 컴포넌트: DrawerTitle 대체
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { prevDefault, stopPropagation } from "@skuberplus/utilities";
import { observer } from "mobx-react";
import React, { Component } from "react";
import showDetailsInjectable from "../kube-detail-params/show-details.injectable";
import { KubeObjectAge } from "../kube-object/age";
import { LinkToNamespace, LinkToReplicaSet } from "../kube-object-link";
import { KubeObjectMenu } from "../kube-object-menu";
import { KubeObjectStatusIcon } from "../kube-object-status-icon";
import { Table, TableCell, TableHead, TableRow } from "../table";
import { WithTooltip } from "../with-tooltip";
import replicaSetStoreInjectable from "../workloads-replicasets/store.injectable";

import type { ReplicaSet } from "@skuberplus/kube-object";

import type { ShowDetails } from "../kube-detail-params/show-details.injectable";
import type { ReplicaSetStore } from "../workloads-replicasets/store";

enum sortBy {
  name = "name",
  namespace = "namespace",
  pods = "pods",
  age = "age",
}

interface Dependencies {
  replicaSetStore: ReplicaSetStore;
  showDetails: ShowDetails;
}

export interface DeploymentReplicaSetsProps {
  replicaSets: ReplicaSet[];
}

interface Dependencies {
  replicaSetStore: ReplicaSetStore;
  showDetails: ShowDetails;
}

class NonInjectedDeploymentReplicaSets extends Component<DeploymentReplicaSetsProps & Dependencies> {
  getPodsLength(replicaSet: ReplicaSet) {
    return this.props.replicaSetStore.getChildPods(replicaSet).length;
  }

  render() {
    const { replicaSets, replicaSetStore, showDetails } = this.props;

    if (!replicaSets.length && !replicaSetStore.isLoaded)
      return (
        <div className="ReplicaSets">
          <Spinner center />
        </div>
      );
    if (!replicaSets.length) return null;

    // 🎯 shadcn DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="ReplicaSets flex column">
        <DetailPanelSection title="Deploy Revisions">
          <Table
            selectable
            tableId="deployment_replica_sets_view"
            scrollable={false}
            sortable={{
              [sortBy.name]: (replicaSet: ReplicaSet) => replicaSet.getName(),
              [sortBy.namespace]: (replicaSet: ReplicaSet) => replicaSet.getNs(),
              [sortBy.age]: (replicaSet: ReplicaSet) => replicaSet.metadata.creationTimestamp,
              [sortBy.pods]: (replicaSet: ReplicaSet) => this.getPodsLength(replicaSet),
            }}
            sortByDefault={{ sortBy: sortBy.pods, orderBy: "desc" }}
            sortSyncWithUrl={false}
            className="box grow"
          >
            <TableHead flat sticky={false}>
              <TableCell className="name" sortBy={sortBy.name}>
                Name
              </TableCell>
              <TableCell className="warning" />
              <TableCell className="namespace" sortBy={sortBy.namespace}>
                Namespace
              </TableCell>
              <TableCell className="pods" sortBy={sortBy.pods}>
                Pods
              </TableCell>
              <TableCell className="age" sortBy={sortBy.age}>
                Age
              </TableCell>
              <TableCell className="actions" />
            </TableHead>
            {replicaSets.map((replica) => (
              <TableRow
                key={replica.getId()}
                sortItem={replica}
                nowrap
                onClick={prevDefault(() => showDetails(replica.selfLink, false))}
              >
                <TableCell className="name">
                  <WithTooltip>
                    <LinkToReplicaSet name={replica.getName()} namespace={replica.getNs()} />
                  </WithTooltip>
                </TableCell>
                <TableCell className="warning">
                  <KubeObjectStatusIcon key="icon" object={replica} />
                </TableCell>
                <TableCell className="namespace">
                  <WithTooltip>
                    <LinkToNamespace namespace={replica.getNs()} />
                  </WithTooltip>
                </TableCell>
                <TableCell className="pods">{this.getPodsLength(replica)}</TableCell>
                <TableCell className="age">
                  <KubeObjectAge key="age" object={replica} />
                </TableCell>
                <TableCell className="actions" onClick={stopPropagation}>
                  <KubeObjectMenu object={replica} />
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </DetailPanelSection>
      </div>
    );
  }
}

export const DeploymentReplicaSets = withInjectables<Dependencies, DeploymentReplicaSetsProps>(
  observer(NonInjectedDeploymentReplicaSets),
  {
    getProps: (di, props) => ({
      ...props,
      replicaSetStore: di.inject(replicaSetStoreInjectable),
      showDetails: di.inject(showDetailsInjectable),
    }),
  },
);
