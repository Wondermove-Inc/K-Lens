/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Deployment 전용 액션 핸들러 (Restart, Scale 등)
 *
 * 📝 주의사항:
 *   - deployment-detail-panel.tsx의 액션 로직 재사용
 *   - Restart: Pod 재시작 (deploymentApi.restart)
 *   - Scale: Scale Dialog 열기
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { deploymentApiInjectable } from "@skuberplus/kube-api-specifics";
import { Deployment } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import React from "react";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../../../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../../../dock/edit-resource/edit-resource-tab.injectable";
import kubeObjectDeleteServiceInjectable from "../../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import openDeploymentScaleDialogInjectable from "../../../workloads-deployments/scale/open.injectable";
import { kubeObjectActionHandlerInjectionToken } from "../kube-object-action-handler-injection-token";

import type { KubeObject } from "@skuberplus/kube-object";

import type { KubeObjectActionHandlers } from "../kube-object-action-handler-injection-token";

/**
 * 🎯 Deployment 액션 핸들러
 * - kind: "Deployment"
 * - apiVersions: ["apps/v1"]
 * - Restart, Scale 등 Deployment 전용 액션 제공
 */
const deploymentActionHandlerInjectable = getInjectable({
  id: "deployment-action-handler",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const createEditResourceTab = di.inject(createEditResourceTabInjectable);
    const deleteService = di.inject(kubeObjectDeleteServiceInjectable);
    const deploymentApi = di.inject(deploymentApiInjectable);
    const openDeploymentScaleDialog = di.inject(openDeploymentScaleDialogInjectable);
    const openConfirmDialog = di.inject(openConfirmDialogInjectable);
    // 🆕 FIX-038: clusterName metadata 추가
    const hostedCluster = di.inject(hostedClusterInjectable);

    return {
      kind: "Deployment",
      apiVersions: ["apps/v1"],

      getHandlers: (object: KubeObject, onClose?: () => void): KubeObjectActionHandlers => {
        // Deployment 타입 확인
        if (!(object instanceof Deployment)) {
          logger.warn("[DeploymentActionHandler] Object is not a Deployment", object);
          return {};
        }

        const deployment = object as Deployment;

        /**
         * Edit 액션: YAML 편집 탭 열기
         */
        const onEdit = () => {
          createEditResourceTab(deployment);
        };

        /**
         * Delete 액션: Deployment 삭제 (Confirm Dialog → API 호출)
         */
        const onDelete = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await deleteService.delete(deployment, "delete");
                onClose?.();
              } catch (error) {
                logger.error("[DeploymentActionHandler] Delete failed:", error);
                const errorMsg =
                  error instanceof Error ? error.message : "Unknown error occurred while deleting deployment";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Delete",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to delete deployment ",
              React.createElement("b", null, deployment.getName()),
              "?",
            ),
          });
        };

        /**
         * Restart 액션: Deployment 재시작 (Confirm Dialog → API 호출)
         */
        const onRestart = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await deploymentApi.restart({
                  namespace: deployment.getNs(),
                  name: deployment.getName(),
                });
              } catch (err) {
                const errorMsg =
                  err instanceof Error ? err.message : "Unknown error occurred while restarting deployment";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Restart",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to restart deployment ",
              React.createElement("b", null, deployment.getName()),
              "?",
            ),
          });
        };

        /**
         * Scale 액션: Scale Dialog 열기
         */
        const onScale = () => {
          openDeploymentScaleDialog(deployment);
        };

        /**
         * Force Finalize 액션: Finalizer 제거 (종료 중 상태일 때만)
         */
        const hasDeletionTimestamp = !!deployment.metadata.deletionTimestamp;
        const hasFinalizers = deployment.getFinalizers().length > 0;
        const shouldShowForceFinalize = hasDeletionTimestamp && hasFinalizers;

        const onForceFinalize = shouldShowForceFinalize
          ? () => {
              openConfirmDialog({
                ok: async () => {
                  try {
                    await deleteService.delete(deployment, "force_finalize");
                    onClose?.();
                  } catch (error) {
                    logger.error("[DeploymentActionHandler] Force Finalize failed:", error);
                    const errorMsg =
                      error instanceof Error
                        ? error.message
                        : "Unknown error occurred while force finalizing deployment";
                    // 🆕 FIX-038: clusterName metadata 추가
                    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                    notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
                  }
                },
                labelOk: "Force Finalize",
                message: React.createElement(
                  "p",
                  null,
                  "Are you sure you want to force finalize deployment ",
                  React.createElement("b", null, deployment.getName()),
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

export default deploymentActionHandlerInjectable;
