/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Job 전용 액션 핸들러 (Suspend)
 *
 * 📝 주의사항:
 *   - job-detail-panel.tsx의 액션 로직 재사용
 *   - Suspend: jobStore.api.suspend 호출
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { Job } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import React from "react";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../../../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../../../dock/edit-resource/edit-resource-tab.injectable";
import kubeObjectDeleteServiceInjectable from "../../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import jobStoreInjectable from "../../../workloads-jobs/store.injectable";
import { kubeObjectActionHandlerInjectionToken } from "../kube-object-action-handler-injection-token";

import type { KubeObject } from "@skuberplus/kube-object";

import type { KubeObjectActionHandlers } from "../kube-object-action-handler-injection-token";

/**
 * 🎯 Job 액션 핸들러
 * - kind: "Job"
 * - apiVersions: ["batch/v1"]
 * - Suspend 등 Job 전용 액션 제공
 */
const jobActionHandlerInjectable = getInjectable({
  id: "job-action-handler",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const createEditResourceTab = di.inject(createEditResourceTabInjectable);
    const deleteService = di.inject(kubeObjectDeleteServiceInjectable);
    const jobStore = di.inject(jobStoreInjectable);
    const openConfirmDialog = di.inject(openConfirmDialogInjectable);
    // 🆕 FIX-038: clusterName metadata 추가
    const hostedCluster = di.inject(hostedClusterInjectable);

    return {
      kind: "Job",
      apiVersions: ["batch/v1"],

      getHandlers: (object: KubeObject, onClose?: () => void): KubeObjectActionHandlers => {
        // Job 타입 확인
        if (!(object instanceof Job)) {
          logger.warn("[JobActionHandler] Object is not a Job", object);
          return {};
        }

        const job = object as Job;
        const name = job.getName();
        const namespace = job.getNs();

        /**
         * Edit 액션: YAML 편집 탭 열기
         */
        const onEdit = () => {
          createEditResourceTab(job);
        };

        /**
         * Delete 액션: Job 삭제 (Confirm Dialog → API 호출)
         */
        const onDelete = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await deleteService.delete(job, "delete");
                onClose?.();
              } catch (error) {
                logger.error("[JobActionHandler] Delete failed:", error);
                const errorMsg = error instanceof Error ? error.message : "Unknown error occurred while deleting job";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Delete",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to delete Job ",
              React.createElement("b", null, name),
              "?",
            ),
          });
        };

        /**
         * Suspend 액션: Job 일시 중지 (Confirm Dialog → API 호출)
         */
        const onSuspend = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await jobStore.api.suspend({ name, namespace });
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : "Unknown error occurred while suspending Job";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Suspend",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to suspend Job ",
              React.createElement("b", null, name),
              "?",
            ),
          });
        };

        /**
         * Force Finalize 액션: Finalizer 제거 (종료 중 상태일 때만)
         */
        const hasDeletionTimestamp = !!job.metadata.deletionTimestamp;
        const hasFinalizers = job.getFinalizers().length > 0;
        const shouldShowForceFinalize = hasDeletionTimestamp && hasFinalizers;

        const onForceFinalize = shouldShowForceFinalize
          ? () => {
              openConfirmDialog({
                ok: async () => {
                  try {
                    await deleteService.delete(job, "force_finalize");
                    onClose?.();
                  } catch (error) {
                    logger.error("[JobActionHandler] Force Finalize failed:", error);
                    const errorMsg =
                      error instanceof Error ? error.message : "Unknown error occurred while force finalizing job";
                    // 🆕 FIX-038: clusterName metadata 추가
                    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                    notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
                  }
                },
                labelOk: "Force Finalize",
                message: React.createElement(
                  "p",
                  null,
                  "Are you sure you want to force finalize Job ",
                  React.createElement("b", null, name),
                  "? This will remove all finalizers.",
                ),
              });
            }
          : undefined;

        return {
          onEdit,
          onDelete,
          onSuspend,
          onForceFinalize,
        };
      },
    };
  },

  injectionToken: kubeObjectActionHandlerInjectionToken,
});

export default jobActionHandlerInjectable;
