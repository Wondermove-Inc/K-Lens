/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { statefulSetApiInjectable } from "@skuberplus/kube-api-specifics";
import React from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import { MenuItem } from "../menu";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { StatefulSetApi } from "@skuberplus/kube-api";
import type { StatefulSet } from "@skuberplus/kube-object";

import type { Cluster } from "../../../common/cluster/cluster";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { KubeObjectMenuProps } from "../kube-object-menu";

export interface StatefulSetMenuProps extends KubeObjectMenuProps<StatefulSet> {}

interface Dependencies {
  statefulSetApi: StatefulSetApi;
  openConfirmDialog: OpenConfirmDialog;
  hostedCluster: Cluster | undefined;
}

const NonInjectedStatefulSetMenu = ({
  statefulSetApi,
  object,
  toolbar,
  openConfirmDialog,
  hostedCluster,
}: Dependencies & StatefulSetMenuProps) => {
  const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

  return (
    <>
      <MenuItem
        onClick={() =>
          openConfirmDialog({
            ok: async () => {
              try {
                await statefulSetApi.restart({
                  namespace: object.getNs(),
                  name: object.getName(),
                });
              } catch (err) {
                notificationPanelStore.addCheckedError(
                  "operations",
                  err,
                  "Unknown error occurred while restarting StatefulSet",
                  { clusterName },
                );
              }
            },
            labelOk: "Restart",
            message: (
              <p>
                {"Are you sure you want to restart StatefulSet "}
                <b>{object.getName()}</b>?
              </p>
            ),
          })
        }
      >
        <Icon material="autorenew" tooltip="Restart" interactive={toolbar} />
        <span className="title">Restart</span>
      </MenuItem>
    </>
  );
};

export const StatefulSetMenu = withInjectables<Dependencies, StatefulSetMenuProps>(NonInjectedStatefulSetMenu, {
  getProps: (di, props) => ({
    ...props,
    statefulSetApi: di.inject(statefulSetApiInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
    hostedCluster: di.inject(hostedClusterInjectable),
  }),
});
