/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Pod 전용 액션 핸들러 (Shell, Logs, Attach, ForceDelete 등)
 *
 * 📝 주의사항:
 *   - pod-detail-panel.tsx의 액션 로직 재사용
 *   - Shell, Logs, Attach는 실행 중인 컨테이너 필요
 *   - ForceDelete는 Pod 전용
 *
 * 🔄 변경이력:
 *   - 2026-01-06: 초기 생성 (클러스터 오버뷰 Warning 패널 개선)
 */

import { getInjectable } from "@ogre-tools/injectable";
import { Pod } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import React from "react";
import { buildKubectlAttachCommand, buildKubectlExecCommand } from "../../../../../common/utils/shell-utils";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import openConfirmDialogInjectable from "../../../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../../../dock/edit-resource/edit-resource-tab.injectable";
import createPodLogsTabInjectable from "../../../dock/logs/create-pod-logs-tab.injectable";
import openPodLogsInWindowInjectable from "../../../dock/logs/open-pod-logs-in-window.injectable";
import createTerminalTabInjectable from "../../../dock/terminal/create-terminal-tab.injectable";
import sendCommandInjectable from "../../../dock/terminal/send-command.injectable";
import hideDetailsInjectable from "../../../kube-detail-params/hide-details.injectable";
import kubeObjectDeleteServiceInjectable from "../../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import { kubeObjectActionHandlerInjectionToken } from "../kube-object-action-handler-injection-token";

import type { Container, KubeObject } from "@skuberplus/kube-object";

import type { KubeObjectActionHandlers } from "../kube-object-action-handler-injection-token";

/**
 * 🎯 Pod 액션 핸들러
 * - kind: "Pod"
 * - apiVersions: ["v1"]
 * - Shell, Logs, Attach, ForceDelete 등 Pod 전용 액션 제공
 */
const podActionHandlerInjectable = getInjectable({
  id: "pod-action-handler",

  instantiate: (di) => {
    const logger = di.inject(loggerInjectionToken);
    const createEditResourceTab = di.inject(createEditResourceTabInjectable);
    const deleteService = di.inject(kubeObjectDeleteServiceInjectable);
    const createTerminalTab = di.inject(createTerminalTabInjectable);
    const sendCommand = di.inject(sendCommandInjectable);
    const hideDetails = di.inject(hideDetailsInjectable);
    const createPodLogsTab = di.inject(createPodLogsTabInjectable);
    const openPodLogsInWindow = di.inject(openPodLogsInWindowInjectable);
    const openConfirmDialog = di.inject(openConfirmDialogInjectable);
    // 🆕 FIX-038: clusterName metadata 추가
    const hostedCluster = di.inject(hostedClusterInjectable);

    return {
      kind: "Pod",
      apiVersions: ["v1"],

      getHandlers: (object: KubeObject, onClose?: () => void): KubeObjectActionHandlers => {
        // Pod 타입 확인
        if (!(object instanceof Pod)) {
          logger.warn("[PodActionHandler] Object is not a Pod", object);
          return {};
        }

        const pod = object as Pod;
        const namespace = pod.getNs();

        /**
         * Edit 액션: YAML 편집 탭 열기
         */
        const onEdit = () => {
          createEditResourceTab(pod);
        };

        /**
         * Delete 액션: Pod 삭제 (Confirm Dialog → API 호출)
         */
        const onDelete = () => {
          openConfirmDialog({
            ok: async () => {
              try {
                await deleteService.delete(pod, "delete");
                onClose?.();
              } catch (error) {
                logger.error("[PodActionHandler] Delete failed:", error);
                const errorMsg = error instanceof Error ? error.message : "Unknown error occurred while deleting pod";
                // 🆕 FIX-038: clusterName metadata 추가
                const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
              }
            },
            labelOk: "Delete",
            message: React.createElement(
              "p",
              null,
              "Are you sure you want to delete pod ",
              React.createElement("b", null, pod.getName()),
              "?",
            ),
          });
        };

        /**
         * Force Delete 액션: Pod 강제 삭제 (gracePeriodSeconds: 0)
         */
        const onForceDelete = async () => {
          try {
            await deleteService.delete(pod, "force_delete");
            onClose?.();
          } catch (error) {
            logger.error("[PodActionHandler] Force Delete failed:", error);
            const errorMsg = error instanceof Error ? error.message : "Unknown error occurred while force deleting pod";
            // 🆕 FIX-038: clusterName metadata 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
          }
        };

        /**
         * Shell 액션: Pod 셸 열기 (첫 번째 실행 중인 컨테이너 사용)
         */
        const onShell = async () => {
          const containers = pod.getRunningContainersWithType();
          if (containers.length === 0) {
            logger.warn("[PodActionHandler] No running containers for shell");
            return;
          }

          const container = containers[0] as Container;
          const shellId = `shell-${pod.getId()}-${Date.now()}`;

          createTerminalTab({
            title: `Pod: ${pod.getName()} (namespace: ${namespace})`,
            id: shellId,
          });

          // 공통 유틸리티를 사용하여 명령어 빌드
          const command = buildKubectlExecCommand({
            kubectlPath: "kubectl",
            namespace,
            podName: pod.getName(),
            containerName: container.name,
            podOs: pod.getSelectedNodeOs(),
          });

          await sendCommand(command, {
            enter: true,
            tabId: shellId,
          });

          hideDetails();
        };

        /**
         * Logs 액션: Pod 로그 보기 (첫 번째 컨테이너 사용)
         */
        const onLogs = () => {
          const containers = pod.getAllContainersWithType();
          if (containers.length === 0) {
            logger.warn("[PodActionHandler] No containers for logs");
            return;
          }

          const container = containers[0] as Container;

          createPodLogsTab({
            selectedPod: pod,
            selectedContainer: container,
          });

          hideDetails();
        };

        /**
         * Logs (New Window) 액션: dock 탭 없이 바로 독립 로그 창 열기
         */
        const onLogsNewWindow = () => {
          openPodLogsInWindow(pod);
          hideDetails();
        };

        /**
         * Attach 액션: Pod에 연결 (첫 번째 실행 중인 컨테이너 사용)
         */
        const onAttach = async () => {
          const containers = pod.getRunningContainersWithType();
          if (containers.length === 0) {
            logger.warn("[PodActionHandler] No running containers for attach");
            return;
          }

          const container = containers[0] as Container;
          const attachId = `attach-${pod.getId()}-${Date.now()}`;

          createTerminalTab({
            title: `Pod: ${pod.getName()} (namespace: ${namespace}) [Attached]`,
            id: attachId,
          });

          // 공통 유틸리티를 사용하여 명령어 빌드
          const command = buildKubectlAttachCommand({
            kubectlPath: "kubectl",
            namespace,
            podName: pod.getName(),
            containerName: container.name,
          });

          await sendCommand(command, {
            enter: true,
            tabId: attachId,
          });

          hideDetails();
        };

        /**
         * Force Finalize 액션: Finalizer 제거 (종료 중 상태일 때만)
         */
        const hasDeletionTimestamp = !!pod.metadata.deletionTimestamp;
        const hasFinalizers = pod.getFinalizers().length > 0;
        const shouldShowForceFinalize = hasDeletionTimestamp && hasFinalizers;

        const onForceFinalize = shouldShowForceFinalize
          ? () => {
              openConfirmDialog({
                ok: async () => {
                  try {
                    await deleteService.delete(pod, "force_finalize");
                    onClose?.();
                  } catch (error) {
                    logger.error("[PodActionHandler] Force Finalize failed:", error);
                    const errorMsg =
                      error instanceof Error ? error.message : "Unknown error occurred while force finalizing pod";
                    // 🆕 FIX-038: clusterName metadata 추가
                    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
                    notificationPanelStore.addError("operations", "Action Failed", errorMsg, { clusterName });
                  }
                },
                labelOk: "Force Finalize",
                message: React.createElement(
                  "p",
                  null,
                  "Are you sure you want to force finalize pod ",
                  React.createElement("b", null, pod.getName()),
                  "? This will remove all finalizers.",
                ),
              });
            }
          : undefined;

        return {
          onEdit,
          onDelete,
          onForceDelete,
          onShell,
          onLogs,
          onLogsNewWindow,
          onAttach,
          onForceFinalize,
        };
      },
    };
  },

  injectionToken: kubeObjectActionHandlerInjectionToken,
});

export default podActionHandlerInjectable;
