/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 모든 KubeObject에 적용되는 기본 액션 핸들러 (Edit/Delete)
 *
 * 📝 주의사항:
 *   - 모든 Kubernetes 리소스에 공통으로 적용
 *   - Edit: YAML 편집 탭 열기
 *   - Delete: 삭제 확인 다이얼로그 → API 호출
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
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
 * 🎯 기본 액션 핸들러 (모든 리소스에 적용)
 * - kind: "*" (모든 리소스)
 * - apiVersions: [] (모든 API 버전)
 * - Edit, Delete 액션 제공
 */
const defaultActionHandlerInjectable = getInjectable({
  id: "default-action-handler",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const createEditResourceTab = di.inject(createEditResourceTabInjectable);
    const deleteService = di.inject(kubeObjectDeleteServiceInjectable);
    const openConfirmDialog = di.inject(openConfirmDialogInjectable);
    // 🆕 FIX-038: clusterName metadata 추가
    const hostedCluster = di.inject(hostedClusterInjectable);

    return {
      kind: "*", // 모든 리소스에 적용
      apiVersions: [], // 모든 API 버전에 적용

      getHandlers: (object: KubeObject, onClose?: () => void): KubeObjectActionHandlers => {
        /**
         * Edit 액션: YAML 편집 탭 열기
         */
        const onEdit = () => {
          createEditResourceTab(object);
        };

        /**
         * Delete 액션: 삭제 확인 다이얼로그 → API 호출
         */
        const onDelete = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await deleteService.delete(object, "delete");
                onClose?.();
              } catch (error) {
                logger.error("[DefaultActionHandler] Delete failed:", error);
                const errorMsg =
                  error instanceof Error ? error.message : `Unknown error occurred while deleting ${object.kind}`;
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Delete",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to delete ",
              React.createElement("b", null, object.getName()),
              "?",
            ),
          });
        };

        /**
         * Force Finalize 액션: Finalizer 제거 (종료 중 상태일 때만)
         */
        const hasDeletionTimestamp = !!object.metadata.deletionTimestamp;
        const hasFinalizers = object.getFinalizers().length > 0;
        const shouldShowForceFinalize = hasDeletionTimestamp && hasFinalizers;

        const onForceFinalize = shouldShowForceFinalize
          ? () => {
              openConfirmDialog({
                ok: async () => {
                  try {
                    await deleteService.delete(object, "force_finalize");
                    onClose?.();
                  } catch (error) {
                    logger.error("[DefaultActionHandler] Force Finalize failed:", error);
                    const errorMsg =
                      error instanceof Error
                        ? error.message
                        : `Unknown error occurred while force finalizing ${object.kind}`;
                    // 🆕 FIX-038: clusterName metadata 추가
                    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                    notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
                  }
                },
                labelOk: "Force Finalize",
                message: React.createElement(
                  "p",
                  null,
                  "Are you sure you want to force finalize ",
                  React.createElement("b", null, object.getName()),
                  "? This will remove all finalizers.",
                ),
              });
            }
          : undefined;

        return {
          onEdit,
          onDelete,
          onForceFinalize,
        };
      },
    };
  },

  injectionToken: kubeObjectActionHandlerInjectionToken,
});

export default defaultActionHandlerInjectable;
