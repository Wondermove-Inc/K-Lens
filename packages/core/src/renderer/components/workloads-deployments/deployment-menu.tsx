/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { deploymentApiInjectable } from "@skuberplus/kube-api-specifics";
import React from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import { MenuItem } from "../menu";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import openDeploymentScaleDialogInjectable from "./scale/open.injectable";

import type { DeploymentApi } from "@skuberplus/kube-api";
import type { Deployment } from "@skuberplus/kube-object";

import type { Cluster } from "../../../common/cluster/cluster";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { KubeObjectMenuProps } from "../kube-object-menu";
import type { OpenDeploymentScaleDialog } from "./scale/open.injectable";

export interface DeploymentMenuProps extends KubeObjectMenuProps<Deployment> {}

interface Dependencies {
  openDeploymentScaleDialog: OpenDeploymentScaleDialog;
  deploymentApi: DeploymentApi;
  openConfirmDialog: OpenConfirmDialog;
  hostedCluster: Cluster | undefined;
}

const NonInjectedDeploymentMenu = ({
  deploymentApi,
  object,
  openDeploymentScaleDialog,
  toolbar,
  openConfirmDialog,
  hostedCluster,
}: Dependencies & DeploymentMenuProps) => {
  const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

  return (
    <>
      <MenuItem onClick={() => openDeploymentScaleDialog(object)}>
        <Icon material="open_with" tooltip="Scale" interactive={toolbar} />
        <span className="title">Scale</span>
      </MenuItem>
      <MenuItem
        onClick={() =>
          openConfirmDialog({
            ok: async () => {
              try {
                await deploymentApi.restart({
                  namespace: object.getNs(),
                  name: object.getName(),
                });
              } catch (err) {
                notificationPanelStore.addCheckedError(
                  "operations",
                  err,
                  "Unknown error occurred while restarting deployment",
                  { clusterName },
                );
              }
            },
            labelOk: "Restart",
            message: (
              <p>
                {"Are you sure you want to restart deployment "}
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

export const DeploymentMenu = withInjectables<Dependencies, DeploymentMenuProps>(NonInjectedDeploymentMenu, {
  getProps: (di, props) => ({
    ...props,
    deploymentApi: di.inject(deploymentApiInjectable),
    openDeploymentScaleDialog: di.inject(openDeploymentScaleDialogInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
    hostedCluster: di.inject(hostedClusterInjectable),
  }),
});
