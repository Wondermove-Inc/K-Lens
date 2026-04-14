/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: StatefulSet 전용 액션 핸들러 (Restart, Scale)
 *
 * 📝 주의사항:
 *   - statefulset-detail-panel.tsx의 액션 로직 재사용
 *   - Restart: statefulSetApi.restart 호출
 *   - Scale: openStatefulSetScaleDialog 호출
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { statefulSetApiInjectable } from "@skuberplus/kube-api-specifics";
import { StatefulSet } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import React from "react";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../../../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../../../dock/edit-resource/edit-resource-tab.injectable";
import kubeObjectDeleteServiceInjectable from "../../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import openStatefulSetScaleDialogInjectable from "../../../workloads-statefulsets/scale/open-dialog.injectable";
import { kubeObjectActionHandlerInjectionToken } from "../kube-object-action-handler-injection-token";

import type { KubeObject } from "@skuberplus/kube-object";

import type { KubeObjectActionHandlers } from "../kube-object-action-handler-injection-token";

/**
 * 🎯 StatefulSet 액션 핸들러
 * - kind: "StatefulSet"
 * - apiVersions: ["apps/v1"]
 * - Restart, Scale 등 StatefulSet 전용 액션 제공
 */
const statefulSetActionHandlerInjectable = getInjectable({
  id: "statefulset-action-handler",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const createEditResourceTab = di.inject(createEditResourceTabInjectable);
    const deleteService = di.inject(kubeObjectDeleteServiceInjectable);
    const statefulSetApi = di.inject(statefulSetApiInjectable);
    const openStatefulSetScaleDialog = di.inject(openStatefulSetScaleDialogInjectable);
    const openConfirmDialog = di.inject(openConfirmDialogInjectable);
    // 🆕 FIX-038: clusterName metadata 추가
    const hostedCluster = di.inject(hostedClusterInjectable);

    return {
      kind: "StatefulSet",
      apiVersions: ["apps/v1"],

      getHandlers: (object: KubeObject, onClose?: () => void): KubeObjectActionHandlers => {
        // StatefulSet 타입 확인
        if (!(object instanceof StatefulSet)) {
          logger.warn("[StatefulSetActionHandler] Object is not a StatefulSet", object);
          return {};
        }

        const statefulSet = object as StatefulSet;
        const name = statefulSet.getName();
        const namespace = statefulSet.getNs();

        /**
         * Edit 액션: YAML 편집 탭 열기
         */
        const onEdit = () => {
          createEditResourceTab(statefulSet);
        };

        /**
         * Delete 액션: StatefulSet 삭제 (Confirm Dialog → API 호출)
         */
        const onDelete = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await deleteService.delete(statefulSet, "delete");
                onClose?.();
              } catch (error) {
                logger.error("[StatefulSetActionHandler] Delete failed:", error);
                const errorMsg =
                  error instanceof Error ? error.message : "Unknown error occurred while deleting statefulset";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Delete",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to delete StatefulSet ",
              React.createElement("b", null, name),
              "?",
            ),
          });
        };

        /**
         * Restart 액션: StatefulSet 재시작 (Confirm Dialog → API 호출)
         */
        const onRestart = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await statefulSetApi.restart({ namespace, name });
              } catch (err) {
                const errorMsg =
                  err instanceof Error ? err.message : "Unknown error occurred while restarting StatefulSet";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Restart",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to restart StatefulSet ",
              React.createElement("b", null, name),
              "?",
            ),
          });
        };

        /**
         * Scale 액션: Scale Dialog 열기
         */
        const onScale = () => {
          openStatefulSetScaleDialog(statefulSet);
        };

        /**
         * Force Finalize 액션: Finalizer 제거 (종료 중 상태일 때만)
         */
        const hasDeletionTimestamp = !!statefulSet.metadata.deletionTimestamp;
        const hasFinalizers = statefulSet.getFinalizers().length > 0;
        const shouldShowForceFinalize = hasDeletionTimestamp && hasFinalizers;

        const onForceFinalize = shouldShowForceFinalize
          ? () => {
              openConfirmDialog({
                ok: async () => {
                  try {
                    await deleteService.delete(statefulSet, "force_finalize");
                    onClose?.();
                  } catch (error) {
                    logger.error("[StatefulSetActionHandler] Force Finalize failed:", error);
                    const errorMsg =
                      error instanceof Error
                        ? error.message
                        : "Unknown error occurred while force finalizing statefulset";
                    // 🆕 FIX-038: clusterName metadata 추가
                    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                    notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
                  }
                },
                labelOk: "Force Finalize",
                message: React.createElement(
                  "p",
                  null,
                  "Are you sure you want to force finalize StatefulSet ",
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
          onScale,
          onForceFinalize,
        };
      },
    };
  },

  injectionToken: kubeObjectActionHandlerInjectionToken,
});

export default statefulSetActionHandlerInjectable;
