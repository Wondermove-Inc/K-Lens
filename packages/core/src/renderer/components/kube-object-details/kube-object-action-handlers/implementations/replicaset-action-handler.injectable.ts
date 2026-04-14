/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ReplicaSet 전용 액션 핸들러 (Scale)
 *
 * 📝 주의사항:
 *   - replicaset-detail-panel.tsx의 액션 로직 재사용
 *   - Scale: openReplicaSetScaleDialog 호출
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { ReplicaSet } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import React from "react";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../../../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../../../dock/edit-resource/edit-resource-tab.injectable";
import kubeObjectDeleteServiceInjectable from "../../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import openReplicaSetScaleDialogInjectable from "../../../workloads-replicasets/scale-dialog/open.injectable";
import { kubeObjectActionHandlerInjectionToken } from "../kube-object-action-handler-injection-token";

import type { KubeObject } from "@skuberplus/kube-object";

import type { KubeObjectActionHandlers } from "../kube-object-action-handler-injection-token";

/**
 * 🎯 ReplicaSet 액션 핸들러
 * - kind: "ReplicaSet"
 * - apiVersions: ["apps/v1"]
 * - Scale 등 ReplicaSet 전용 액션 제공
 */
const replicaSetActionHandlerInjectable = getInjectable({
  id: "replicaset-action-handler",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const createEditResourceTab = di.inject(createEditResourceTabInjectable);
    const deleteService = di.inject(kubeObjectDeleteServiceInjectable);
    const openReplicaSetScaleDialog = di.inject(openReplicaSetScaleDialogInjectable);
    const openConfirmDialog = di.inject(openConfirmDialogInjectable);
    // 🆕 FIX-038: clusterName metadata 추가
    const hostedCluster = di.inject(hostedClusterInjectable);

    return {
      kind: "ReplicaSet",
      apiVersions: ["apps/v1"],

      getHandlers: (object: KubeObject, onClose?: () => void): KubeObjectActionHandlers => {
        // ReplicaSet 타입 확인
        if (!(object instanceof ReplicaSet)) {
          logger.warn("[ReplicaSetActionHandler] Object is not a ReplicaSet", object);
          return {};
        }

        const replicaSet = object as ReplicaSet;
        const name = replicaSet.getName();

        /**
         * Edit 액션: YAML 편집 탭 열기
         */
        const onEdit = () => {
          createEditResourceTab(replicaSet);
        };

        /**
         * Delete 액션: ReplicaSet 삭제 (Confirm Dialog → API 호출)
         */
        const onDelete = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await deleteService.delete(replicaSet, "delete");
                onClose?.();
              } catch (error) {
                logger.error("[ReplicaSetActionHandler] Delete failed:", error);
                const errorMsg =
                  error instanceof Error ? error.message : "Unknown error occurred while deleting replicaset";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Delete",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to delete ReplicaSet ",
              React.createElement("b", null, name),
              "?",
            ),
          });
        };

        /**
         * Scale 액션: Scale Dialog 열기
         */
        const onScale = () => {
          openReplicaSetScaleDialog(replicaSet);
        };

        /**
         * Force Finalize 액션: Finalizer 제거 (종료 중 상태일 때만)
         */
        const hasDeletionTimestamp = !!replicaSet.metadata.deletionTimestamp;
        const hasFinalizers = replicaSet.getFinalizers().length > 0;
        const shouldShowForceFinalize = hasDeletionTimestamp && hasFinalizers;

        const onForceFinalize = shouldShowForceFinalize
          ? () => {
              openConfirmDialog({
                ok: async () => {
                  try {
                    await deleteService.delete(replicaSet, "force_finalize");
                    onClose?.();
                  } catch (error) {
                    logger.error("[ReplicaSetActionHandler] Force Finalize failed:", error);
                    const errorMsg =
                      error instanceof Error
                        ? error.message
                        : "Unknown error occurred while force finalizing replicaset";
                    // 🆕 FIX-038: clusterName metadata 추가
                    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                    notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
                  }
                },
                labelOk: "Force Finalize",
                message: React.createElement(
                  "p",
                  null,
                  "Are you sure you want to force finalize ReplicaSet ",
                  React.createElement("b", null, name),
                  "? This will remove all finalizers.",
                ),
              });
            }
          : undefined;

        return {
          onEdit,
          onDelete,
          onScale,
          onForceFinalize,
        };
      },
    };
  },

  injectionToken: kubeObjectActionHandlerInjectionToken,
});

export default replicaSetActionHandlerInjectable;
