/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Node 전용 액션 핸들러 (Cordon, Uncordon, Drain 등)
 *
 * 📝 주의사항:
 *   - node-detail-panel.tsx의 액션 로직 재사용
 *   - Cordon: kubectl cordon 명령 실행
 *   - Uncordon: kubectl uncordon 명령 실행
 *   - Drain: kubectl drain 명령 실행
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { Node } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import React from "react";
import { App } from "../../../../../extensions/common-api";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../../../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../../../dock/edit-resource/edit-resource-tab.injectable";
import sendCommandInjectable from "../../../dock/terminal/send-command.injectable";
import hideDetailsInjectable from "../../../kube-detail-params/hide-details.injectable";
import kubeObjectDeleteServiceInjectable from "../../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import { kubeObjectActionHandlerInjectionToken } from "../kube-object-action-handler-injection-token";

import type { KubeObject } from "@skuberplus/kube-object";

import type { KubeObjectActionHandlers } from "../kube-object-action-handler-injection-token";

/**
 * 🎯 Node 액션 핸들러
 * - kind: "Node"
 * - apiVersions: ["v1"]
 * - Cordon, Uncordon, Drain 등 Node 전용 액션 제공
 */
const nodeActionHandlerInjectable = getInjectable({
  id: "node-action-handler",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const createEditResourceTab = di.inject(createEditResourceTabInjectable);
    const deleteService = di.inject(kubeObjectDeleteServiceInjectable);
    const sendCommand = di.inject(sendCommandInjectable);
    const hideDetails = di.inject(hideDetailsInjectable);
    const openConfirmDialog = di.inject(openConfirmDialogInjectable);
    // 🆕 FIX-038: clusterName metadata 추가
    const hostedCluster = di.inject(hostedClusterInjectable);

    return {
      kind: "Node",
      apiVersions: ["v1"],

      getHandlers: (object: KubeObject, onClose?: () => void): KubeObjectActionHandlers => {
        // Node 타입 확인
        if (!(object instanceof Node)) {
          logger.warn("[NodeActionHandler] Object is not a Node", object);
          return {};
        }

        const node = object as Node;
        const nodeName = node.getName();
        const kubectlPath = App.Preferences.getKubectlPath() || "kubectl";

        /**
         * Edit 액션: YAML 편집 탭 열기
         */
        const onEdit = () => {
          createEditResourceTab(node);
        };

        /**
         * Delete 액션: Node 삭제 (Confirm Dialog → API 호출)
         */
        const onDelete = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await deleteService.delete(node, "delete");
                onClose?.();
              } catch (error) {
                logger.error("[NodeActionHandler] Delete failed:", error);
                const errorMsg = error instanceof Error ? error.message : "Unknown error occurred while deleting node";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Delete",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to delete node ",
              React.createElement("b", null, nodeName),
              "?",
            ),
          });
        };

        /**
         * Cordon 액션: Node 스케줄링 중지 (Confirm Dialog → kubectl cordon)
         */
        const onCordon = () => {
          openConfirmDialog({
            ok: () => {
              sendCommand(`${kubectlPath} cordon ${nodeName}`, {
                enter: true,
                newTab: true,
              }).then(() => {
                hideDetails();
              });
            },
            labelOk: "Cordon",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to cordon node ",
              React.createElement("b", null, nodeName),
              "?",
              React.createElement("br"),
              React.createElement(
                "span",
                { className: "text-sm text-muted-foreground" },
                "This will mark the node as unschedulable and prevent new pods from being scheduled on it.",
              ),
            ),
          });
        };

        /**
         * Uncordon 액션: Node 스케줄링 재개 (Confirm Dialog → kubectl uncordon)
         */
        const onUncordon = () => {
          openConfirmDialog({
            ok: () => {
              sendCommand(`${kubectlPath} uncordon ${nodeName}`, {
                enter: true,
                newTab: true,
              }).then(() => {
                hideDetails();
              });
            },
            labelOk: "Uncordon",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to uncordon node ",
              React.createElement("b", null, nodeName),
              "?",
              React.createElement("br"),
              React.createElement(
                "span",
                { className: "text-sm text-muted-foreground" },
                "This will mark the node as schedulable and allow new pods to be scheduled on it.",
              ),
            ),
          });
        };

        /**
         * Drain 액션: Node Pod 제거 (Confirm Dialog → kubectl drain)
         */
        const onDrain = () => {
          const command = `${kubectlPath} drain ${nodeName} --delete-emptydir-data --ignore-daemonsets --force`;

          openConfirmDialog({
            ok: () => {
              sendCommand(command, {
                enter: true,
                newTab: true,
              }).then(() => {
                hideDetails();
              });
            },
            labelOk: "Drain Node",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to drain node ",
              React.createElement("b", null, nodeName),
              "?",
              React.createElement("br"),
              React.createElement(
                "span",
                { className: "text-sm text-muted-foreground" },
                "This will safely evict all pods from the node before maintenance.",
              ),
            ),
          });
        };

        /**
         * Force Finalize 액션: Finalizer 제거 (종료 중 상태일 때만)
         */
        const hasDeletionTimestamp = !!node.metadata.deletionTimestamp;
        const hasFinalizers = node.getFinalizers().length > 0;
        const shouldShowForceFinalize = hasDeletionTimestamp && hasFinalizers;

        const onForceFinalize = shouldShowForceFinalize
          ? () => {
              openConfirmDialog({
                ok: async () => {
                  try {
                    await deleteService.delete(node, "force_finalize");
                    onClose?.();
                  } catch (error) {
                    logger.error("[NodeActionHandler] Force Finalize failed:", error);
                    const errorMsg =
                      error instanceof Error ? error.message : "Unknown error occurred while force finalizing node";
                    // 🆕 FIX-038: clusterName metadata 추가
                    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                    notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
                  }
                },
                labelOk: "Force Finalize",
                message: React.createElement(
                  "p",
                  null,
                  "Are you sure you want to force finalize node ",
                  React.createElement("b", null, nodeName),
                  "? This will remove all finalizers.",
                ),
              });
            }
          : undefined;

        return {
          onEdit,
          onDelete,
          onCordon,
          onUncordon,
          onDrain,
          onForceFinalize,
        };
      },
    };
  },

  injectionToken: kubeObjectActionHandlerInjectionToken,
});

export default nodeActionHandlerInjectable;
