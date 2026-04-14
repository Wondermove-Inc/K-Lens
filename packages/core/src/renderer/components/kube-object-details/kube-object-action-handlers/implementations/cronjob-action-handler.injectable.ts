/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CronJob 전용 액션 핸들러 (Trigger, Suspend)
 *
 * 📝 주의사항:
 *   - cronjob-detail-panel.tsx의 액션 로직 재사용
 *   - Trigger: openCronJobTriggerDialog 호출
 *   - Suspend: cronJobStore.api.suspend 호출
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { CronJob } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import React from "react";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../../../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../../../dock/edit-resource/edit-resource-tab.injectable";
import kubeObjectDeleteServiceInjectable from "../../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import cronJobStoreInjectable from "../../../workloads-cronjobs/store.injectable";
import openCronJobTriggerDialogInjectable from "../../../workloads-cronjobs/trigger-dialog/open.injectable";
import { kubeObjectActionHandlerInjectionToken } from "../kube-object-action-handler-injection-token";

import type { KubeObject } from "@skuberplus/kube-object";

import type { KubeObjectActionHandlers } from "../kube-object-action-handler-injection-token";

/**
 * 🎯 CronJob 액션 핸들러
 * - kind: "CronJob"
 * - apiVersions: ["batch/v1"]
 * - Trigger, Suspend 등 CronJob 전용 액션 제공
 */
const cronJobActionHandlerInjectable = getInjectable({
  id: "cronjob-action-handler",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const createEditResourceTab = di.inject(createEditResourceTabInjectable);
    const deleteService = di.inject(kubeObjectDeleteServiceInjectable);
    const cronJobStore = di.inject(cronJobStoreInjectable);
    const openCronJobTriggerDialog = di.inject(openCronJobTriggerDialogInjectable);
    const openConfirmDialog = di.inject(openConfirmDialogInjectable);
    // 🆕 FIX-038: clusterName metadata 추가
    const hostedCluster = di.inject(hostedClusterInjectable);

    return {
      kind: "CronJob",
      apiVersions: ["batch/v1"],

      getHandlers: (object: KubeObject, onClose?: () => void): KubeObjectActionHandlers => {
        // CronJob 타입 확인
        if (!(object instanceof CronJob)) {
          logger.warn("[CronJobActionHandler] Object is not a CronJob", object);
          return {};
        }

        const cronJob = object as CronJob;
        const name = cronJob.getName();
        const namespace = cronJob.getNs();

        /**
         * Edit 액션: YAML 편집 탭 열기
         */
        const onEdit = () => {
          createEditResourceTab(cronJob);
        };

        /**
         * Delete 액션: CronJob 삭제 (Confirm Dialog → API 호출)
         */
        const onDelete = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await deleteService.delete(cronJob, "delete");
                onClose?.();
              } catch (error) {
                logger.error("[CronJobActionHandler] Delete failed:", error);
                const errorMsg =
                  error instanceof Error ? error.message : "Unknown error occurred while deleting cronjob";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Delete",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to delete CronJob ",
              React.createElement("b", null, name),
              "?",
            ),
          });
        };

        /**
         * Trigger 액션: CronJob 수동 실행 (Trigger Dialog 열기)
         */
        const onTrigger = () => {
          openCronJobTriggerDialog(cronJob);
        };

        /**
         * Suspend 액션: CronJob 일시 중지 (Confirm Dialog → API 호출)
         */
        const onSuspend = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await cronJobStore.api.suspend({ name, namespace });
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : "Unknown error occurred while suspending CronJob";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Suspend",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to suspend CronJob ",
              React.createElement("b", null, name),
              "?",
            ),
          });
        };

        /**
         * Force Finalize 액션: Finalizer 제거 (종료 중 상태일 때만)
         */
        const hasDeletionTimestamp = !!cronJob.metadata.deletionTimestamp;
        const hasFinalizers = cronJob.getFinalizers().length > 0;
        const shouldShowForceFinalize = hasDeletionTimestamp && hasFinalizers;

        const onForceFinalize = shouldShowForceFinalize
          ? () => {
              openConfirmDialog({
                ok: async () => {
                  try {
                    await deleteService.delete(cronJob, "force_finalize");
                    onClose?.();
                  } catch (error) {
                    logger.error("[CronJobActionHandler] Force Finalize failed:", error);
                    const errorMsg =
                      error instanceof Error ? error.message : "Unknown error occurred while force finalizing cronjob";
                    // 🆕 FIX-038: clusterName metadata 추가
                    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                    notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
                  }
                },
                labelOk: "Force Finalize",
                message: React.createElement(
                  "p",
                  null,
                  "Are you sure you want to force finalize CronJob ",
                  React.createElement("b", null, name),
                  "? This will remove all finalizers.",
                ),
              });
            }
          : undefined;

        return {
          onEdit,
          onDelete,
          onTrigger,
          onSuspend,
          onForceFinalize,
        };
      },
    };
  },

  injectionToken: kubeObjectActionHandlerInjectionToken,
});

export default cronJobActionHandlerInjectable;
