/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { cronJobApiInjectable } from "@skuberplus/kube-api-specifics";
import React from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import { MenuItem } from "../menu";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import openCronJobTriggerDialogInjectable from "./trigger-dialog/open.injectable";

import type { CronJobApi } from "@skuberplus/kube-api";
import type { CronJob } from "@skuberplus/kube-object";

import type { Cluster } from "../../../common/cluster/cluster";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { KubeObjectMenuProps } from "../kube-object-menu";
import type { OpenCronJobTriggerDialog } from "./trigger-dialog/open.injectable";

export interface CronJobMenuProps extends KubeObjectMenuProps<CronJob> {}

interface Dependencies {
  openConfirmDialog: OpenConfirmDialog;
  openCronJobTriggerDialog: OpenCronJobTriggerDialog;
  cronJobApi: CronJobApi;
  hostedCluster: Cluster | undefined;
}

const NonInjectedCronJobMenu = ({
  object,
  toolbar,
  openConfirmDialog,
  openCronJobTriggerDialog,
  cronJobApi,
  hostedCluster,
}: Dependencies & CronJobMenuProps) => {
  const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

  return (
    <>
      <MenuItem onClick={() => openCronJobTriggerDialog(object)}>
        <Icon material="play_circle_filled" tooltip="Trigger" interactive={toolbar} />
        <span className="title">Trigger</span>
      </MenuItem>

      {object.isSuspend() ? (
        <MenuItem
          onClick={() =>
            openConfirmDialog({
              ok: async () => {
                try {
                  await cronJobApi.resume({ namespace: object.getNs(), name: object.getName() });
                  // 🎯 FIX-037: NotificationPanel으로 마이그레이션
                  notificationPanelStore.addSuccess(
                    "operations",
                    "CronJob Resumed",
                    `[${clusterName}] ${object.getName()} resumed successfully`,
                    {
                      resourceKind: "CronJob",
                      resourceName: object.getName(),
                      namespace: object.getNs(),
                      clusterName,
                    },
                  );
                } catch (err) {
                  const errorMsg = err instanceof Error ? err.message : "Unknown error occurred while resuming CronJob";
                  notificationPanelStore.addError("operations", "Resume Failed", errorMsg, { clusterName });
                }
              },
              labelOk: `Resume`,
              message: (
                <p>
                  {"Resume CronJob "}
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
                  await cronJobApi.suspend({ namespace: object.getNs(), name: object.getName() });
                  // 🎯 FIX-037: NotificationPanel으로 마이그레이션
                  notificationPanelStore.addSuccess(
                    "operations",
                    "CronJob Suspended",
                    `[${clusterName}] ${object.getName()} suspended successfully`,
                    {
                      resourceKind: "CronJob",
                      resourceName: object.getName(),
                      namespace: object.getNs(),
                      clusterName,
                    },
                  );
                } catch (err) {
                  const errorMsg =
                    err instanceof Error ? err.message : "Unknown error occurred while suspending CronJob";
                  notificationPanelStore.addError("operations", "Suspend Failed", errorMsg, { clusterName });
                }
              },
              labelOk: `Suspend`,
              message: (
                <p>
                  {"Suspend CronJob "}
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

export const CronJobMenu = withInjectables<Dependencies, CronJobMenuProps>(NonInjectedCronJobMenu, {
  getProps: (di, props) => ({
    ...props,
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
    openCronJobTriggerDialog: di.inject(openCronJobTriggerDialogInjectable),
    cronJobApi: di.inject(cronJobApiInjectable),
    hostedCluster: di.inject(hostedClusterInjectable),
  }),
});
