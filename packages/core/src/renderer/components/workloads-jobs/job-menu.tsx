/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { jobApiInjectable } from "@skuberplus/kube-api-specifics";
import React from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import { MenuItem } from "../menu";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { JobApi } from "@skuberplus/kube-api";
import type { Job } from "@skuberplus/kube-object";

import type { Cluster } from "../../../common/cluster/cluster";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { KubeObjectMenuProps } from "../kube-object-menu";

export interface JobMenuProps extends KubeObjectMenuProps<Job> {}

interface Dependencies {
  openConfirmDialog: OpenConfirmDialog;
  jobApi: JobApi;
  hostedCluster: Cluster | undefined;
}

const NonInjectedJobMenu = ({
  object,
  toolbar,
  openConfirmDialog,
  jobApi,
  hostedCluster,
}: Dependencies & JobMenuProps) => {
  const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

  return (
    <>
      {object.isSuspend() ? (
        <MenuItem
          onClick={() =>
            openConfirmDialog({
              ok: async () => {
                try {
                  await jobApi.resume({ namespace: object.getNs(), name: object.getName() });
                } catch (err) {
                  notificationPanelStore.addCheckedError(
                    "operations",
                    err,
                    "Unknown error occurred while resuming Job",
                    { clusterName },
                  );
                }
              },
              labelOk: `Resume`,
              message: (
                <p>
                  {"Resume Job "}
                  <b>{object.getName()}</b>?
                </p>
              ),
            })
          }
        >
          <Icon material="play_circle_outline" tooltip="Resume" interactive={toolbar} />
          <span className="title">Resume</span>
        </MenuItem>
      ) : (
        <MenuItem
          onClick={() =>
            openConfirmDialog({
              ok: async () => {
                try {
                  await jobApi.suspend({ namespace: object.getNs(), name: object.getName() });
                } catch (err) {
                  notificationPanelStore.addCheckedError(
                    "operations",
                    err,
                    "Unknown error occurred while suspending Job",
                    { clusterName },
                  );
                }
              },
              labelOk: `Suspend`,
              message: (
                <p>
                  {"Suspend Job "}
                  <b>{object.getName()}</b>?
                </p>
              ),
            })
          }
        >
          <Icon material="pause_circle_filled" tooltip="Suspend" interactive={toolbar} />
          <span className="title">Suspend</span>
        </MenuItem>
      )}
    </>
  );
};

export const JobMenu = withInjectables<Dependencies, JobMenuProps>(NonInjectedJobMenu, {
  getProps: (di, props) => ({
    ...props,
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
    jobApi: di.inject(jobApiInjectable),
    hostedCluster: di.inject(hostedClusterInjectable),
  }),
});
