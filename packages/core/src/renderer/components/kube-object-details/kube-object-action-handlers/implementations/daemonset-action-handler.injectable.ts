/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: DaemonSet 전용 액션 핸들러 (Restart)
 *
 * 📝 주의사항:
 *   - daemonset-detail-panel.tsx의 액션 로직 재사용
 *   - Restart: daemonSetApi.restart 호출
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { daemonSetApiInjectable } from "@skuberplus/kube-api-specifics";
import { DaemonSet } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import React from "react";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../../../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../../../dock/edit-resource/edit-resource-tab.injectable";
import kubeObjectDeleteServiceInjectable from "../../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import { kubeObjectActionHandlerInjectionToken } from "../kube-object-action-handler-injection-token";

import type { KubeObject } from "@skuberplus/kube-object";

import type { KubeObjectActionHandlers } from "../kube-object-action-handler-injection-token";

/**
 * 🎯 DaemonSet 액션 핸들러
 * - kind: "DaemonSet"
 * - apiVersions: ["apps/v1"]
 * - Restart 등 DaemonSet 전용 액션 제공
 */
const daemonSetActionHandlerInjectable = getInjectable({
  id: "daemonset-action-handler",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const createEditResourceTab = di.inject(createEditResourceTabInjectable);
    const deleteService = di.inject(kubeObjectDeleteServiceInjectable);
    const daemonSetApi = di.inject(daemonSetApiInjectable);
    const openConfirmDialog = di.inject(openConfirmDialogInjectable);
    // 🆕 FIX-038: clusterName metadata 추가
    const hostedCluster = di.inject(hostedClusterInjectable);

    return {
      kind: "DaemonSet",
      apiVersions: ["apps/v1"],

      getHandlers: (object: KubeObject, onClose?: () => void): KubeObjectActionHandlers => {
        // DaemonSet 타입 확인
        if (!(object instanceof DaemonSet)) {
          logger.warn("[DaemonSetActionHandler] Object is not a DaemonSet", object);
          return {};
        }

        const daemonSet = object as DaemonSet;
        const name = daemonSet.getName();
        const namespace = daemonSet.getNs();

        /**
         * Edit 액션: YAML 편집 탭 열기
         */
        const onEdit = () => {
          createEditResourceTab(daemonSet);
        };

        /**
         * Delete 액션: DaemonSet 삭제 (Confirm Dialog → API 호출)
         */
        const onDelete = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await deleteService.delete(daemonSet, "delete");
                onClose?.();
              } catch (error) {
                logger.error("[DaemonSetActionHandler] Delete failed:", error);
                const errorMsg =
                  error instanceof Error ? error.message : "Unknown error occurred while deleting daemonset";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Delete",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to delete DaemonSet ",
              React.createElement("b", null, name),
              "?",
            ),
          });
        };

        /**
         * Restart 액션: DaemonSet 재시작 (Confirm Dialog → API 호출)
         */
        const onRestart = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await daemonSetApi.restart({ namespace, name });
              } catch (err) {
                const errorMsg =
                  err instanceof Error ? err.message : "Unknown error occurred while restarting DaemonSet";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Restart",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to restart DaemonSet ",
              React.createElement("b", null, name),
              "?",
            ),
          });
        };

        /**
         * Force Finalize 액션: Finalizer 제거 (종료 중 상태일 때만)
         */
        const hasDeletionTimestamp = !!daemonSet.metadata.deletionTimestamp;
        const hasFinalizers = daemonSet.getFinalizers().length > 0;
        const shouldShowForceFinalize = hasDeletionTimestamp && hasFinalizers;

        const onForceFinalize = shouldShowForceFinalize
          ? () => {
              openConfirmDialog({
                ok: async () => {
                  try {
                    await deleteService.delete(daemonSet, "force_finalize");
                    onClose?.();
                  } catch (error) {
                    logger.error("[DaemonSetActionHandler] Force Finalize failed:", error);
                    const errorMsg =
                      error instanceof Error
                        ? error.message
                        : "Unknown error occurred while force finalizing daemonset";
                    // 🆕 FIX-038: clusterName metadata 추가
                    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                    notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
                  }
                },
                labelOk: "Force Finalize",
                message: React.createElement(
                  "p",
                  null,
                  "Are you sure you want to force finalize DaemonSet ",
                  React.createElement("b", null, name),
                  "? This will remove all finalizers.",
                ),
              });
            }
          : undefined;

        return {
          onEdit,
          onDelete,
          onRestart,
          onForceFinalize,
        };
      },
    };
  },

  injectionToken: kubeObjectActionHandlerInjectionToken,
});

export default daemonSetActionHandlerInjectable;
