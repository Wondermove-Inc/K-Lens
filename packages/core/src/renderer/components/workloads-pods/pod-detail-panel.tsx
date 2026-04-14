/**
 * 🎯 목적: Pod 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - 공통 DetailPanel 컴포넌트 사용 (packages/storybook-shadcn/src/components/ui/detail-panel.tsx)
 *   - 내부 콘텐츠는 PodDetailsContent 재사용 (중복 제거)
 *   - 메트릭 차트 자동 표시 (metricsComponent prop)
 *   - DetailPanelActionsMenu로 Edit, Delete, Shell, Logs, Attach 액션 제공
 * 🔄 변경이력:
 *   - 2025-10-29: 초기 생성 (CommonTable 우측 패널 스타일 적용)
 *   - 2025-11-04: 공통 DetailPanel 컴포넌트로 리팩토링 (254줄 감소)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete, Shell, Logs, Attach)
 *   - 2025-11-13: PodDetailsContent 재사용으로 리팩토링 (200줄 중복 제거)
 */

import "./pod-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Pod } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { observer } from "mobx-react";
import React from "react";
import { buildKubectlAttachCommand, buildKubectlExecCommand } from "../../../common/utils/shell-utils";
import { App } from "../../../extensions/common-api";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import createPodLogsTabInjectable from "../dock/logs/create-pod-logs-tab.injectable";
import openPodLogsInWindowInjectable from "../dock/logs/open-pod-logs-in-window.injectable";
import createTerminalTabInjectable from "../dock/terminal/create-terminal-tab.injectable";
import sendCommandInjectable from "../dock/terminal/send-command.injectable";
import hideDetailsInjectable from "../kube-detail-params/hide-details.injectable";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { PodDetailsContent } from "./pod-details-content";
import PodMetricsDetailsComponent from "./pod-metrics-details-component";

import type { Container, KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { PodLogsTabData } from "../dock/logs/create-pod-logs-tab.injectable";
import type { OpenPodLogsInWindow } from "../dock/logs/open-pod-logs-in-window.injectable";
import type { SendCommand } from "../dock/terminal/send-command.injectable";
import type { HideDetails } from "../kube-detail-params/hide-details.injectable";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

export interface PodDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Pod 객체
   */
  pod: Pod | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  hostedCluster: HostedCluster | undefined;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  createTerminalTab: (tabParams: DockTabCreateSpecific) => void;
  sendCommand: SendCommand;
  hideDetails: HideDetails;
  createPodLogsTab: (data: PodLogsTabData) => any;
  openPodLogsInWindow: OpenPodLogsInWindow;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * Pod 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param pod - 표시할 Pod 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedPodDetailPanel = observer((props: PodDetailPanelProps & Dependencies) => {
  const {
    isOpen,
    pod,
    onClose,
    logger,
    hostedCluster,
    createEditResourceTab,
    deleteService,
    createTerminalTab,
    sendCommand,
    hideDetails,
    createPodLogsTab,
    openPodLogsInWindow,
    openConfirmDialog,
  } = props;

  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
  const [renderPod, setRenderPod] = React.useState<Pod | undefined>(pod);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const prevIsOpenRef = React.useRef(isOpen);

  // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
  React.useEffect(() => {
    if (pod) {
      setRenderPod(pod);
    }
  }, [pod]);

  // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
  React.useEffect(() => {
    const wasOpen = prevIsOpenRef.current;

    // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
    if (!isOpen && wasOpen) {
      clearTimerRef.current = setTimeout(() => {
        setRenderPod(undefined);
      }, 320);
    }

    // 다시 열리면 정리 타이머 취소
    if (isOpen && clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = undefined;
    }

    prevIsOpenRef.current = isOpen;

    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, [isOpen]);

  // ⚠️ 렌더 대상 Pod가 없으면 렌더링하지 않음
  if (!renderPod) {
    return null;
  }

  if (pod && !(pod instanceof Pod)) {
    logger.error("[PodDetailPanel]: passed object that is not an instanceof Pod", pod);
    return null;
  }

  const namespace = renderPod.getNs();

  // ============================================
  // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
  // ============================================

  /**
   * Edit 액션: YAML 편집 탭 열기
   */
  const handleEdit = () => {
    createEditResourceTab(renderPod);
  };

  /**
   * Delete 액션: Pod 삭제 (Confirm Dialog → API 호출)
   */
  const handleDelete = () => {
    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(renderPod, "delete");
          onClose();
        } catch (error) {
          logger.error("[PodDetailPanel] Delete failed:", error);
          // 🆕 FIX-038: clusterName 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting pod",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete pod <b>{renderPod.getName()}</b>?
        </p>
      ),
    });
  };

  /**
   * Force Delete 액션: Pod 강제 삭제 (gracePeriodSeconds: 0)
   */
  const handleForceDelete = async () => {
    try {
      await deleteService.delete(renderPod, "force_delete");
      onClose();
    } catch (error) {
      logger.error("[PodDetailPanel] Force Delete failed:", error);
    }
  };

  /**
   * Shell 액션: Pod 셸 열기 (첫 번째 실행 중인 컨테이너 사용)
   */
  const handleShell = async () => {
    const containers = renderPod.getRunningContainersWithType();
    if (containers.length === 0) {
      logger.warn("[PodDetailPanel] No running containers for shell");
      return;
    }

    const container = containers[0] as Container;
    const shellId = `shell-${renderPod.getId()}-${Date.now()}`;

    createTerminalTab({
      title: `Pod: ${renderPod.getName()} (namespace: ${namespace})`,
      id: shellId,
    });

    // 공통 유틸리티를 사용하여 명령어 빌드
    const kubectlPath = App.Preferences.getKubectlPath() || "kubectl";
    const hostShellPath = App.Preferences.getTerminalShellPath();

    const command = buildKubectlExecCommand({
      kubectlPath,
      namespace,
      podName: renderPod.getName(),
      containerName: container.name,
      podOs: renderPod.getSelectedNodeOs(),
      hostShellPath,
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
  const handleLogs = () => {
    const containers = renderPod.getAllContainersWithType();
    if (containers.length === 0) {
      logger.warn("[PodDetailPanel] No containers for logs");
      return;
    }

    const container = containers[0] as Container;

    createPodLogsTab({
      selectedPod: renderPod,
      selectedContainer: container,
    });

    hideDetails();
  };

  /**
   * Logs (New Window) 액션: dock 탭 없이 바로 독립 로그 창 열기
   */
  const handleLogsNewWindow = () => {
    openPodLogsInWindow(renderPod);
    hideDetails();
  };

  /**
   * Attach 액션: Pod에 연결 (첫 번째 실행 중인 컨테이너 사용)
   */
  const handleAttach = async () => {
    const containers = renderPod.getRunningContainersWithType();
    if (containers.length === 0) {
      logger.warn("[PodDetailPanel] No running containers for attach");
      return;
    }

    const container = containers[0] as Container;
    const attachId = `attach-${renderPod.getId()}-${Date.now()}`;

    createTerminalTab({
      title: `Pod: ${renderPod.getName()} (namespace: ${namespace}) [Attached]`,
      id: attachId,
    });

    // 공통 유틸리티를 사용하여 명령어 빌드
    const kubectlPath = App.Preferences.getKubectlPath() || "kubectl";
    const hostShellPath = App.Preferences.getTerminalShellPath();

    const command = buildKubectlAttachCommand({
      kubectlPath,
      namespace,
      podName: renderPod.getName(),
      containerName: container.name,
      hostShellPath,
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
  const handleForceFinalize = () => {
    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(renderPod, "force_finalize");
          onClose();
        } catch (error) {
          logger.error("[PodDetailPanel] Force Finalize failed:", error);
          // 🆕 FIX-038: clusterName 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while force finalizing pod",
            { clusterName },
          );
        }
      },
      labelOk: "Force Finalize",
      message: (
        <p>
          Are you sure you want to force finalize pod <b>{renderPod.getName()}</b>? This will remove all finalizers.
        </p>
      ),
    });
  };

  // 🎯 Force Finalize 표시 조건 체크 (기존 KubeObjectMenu 로직과 동일)
  const hasDeletionTimestamp = !!renderPod.metadata.deletionTimestamp;
  const hasFinalizers = renderPod.getFinalizers().length > 0;
  const shouldShowForceFinalize = hasDeletionTimestamp && hasFinalizers;

  return (
    <DetailPanel
      isOpen={isOpen}
      onClose={onClose}
      title={renderPod.getName()}
      subtitle={`Namespace: ${namespace}`}
      metricsComponent={<PodMetricsDetailsComponent object={renderPod} />}
      object={renderPod}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onForceDelete={handleForceDelete}
      onForceFinalize={shouldShowForceFinalize ? handleForceFinalize : undefined}
      onShell={handleShell}
      onLogs={handleLogs}
      onLogsNewWindow={handleLogsNewWindow}
      onAttach={handleAttach}
    >
      {/* 🎯 PodDetailsContent 재사용 - 중복 코드 제거 */}
      <PodDetailsContent object={renderPod} />
    </DetailPanel>
  );
});

/**
 * DI 패턴 적용된 Pod Detail Panel
 */
export const PodDetailPanel = withInjectables<Dependencies, PodDetailPanelProps>(NonInjectedPodDetailPanel, {
  getProps: (di, props) => ({
    ...props,
    logger: di.inject(loggerInjectionToken),
    hostedCluster: di.inject(hostedClusterInjectable),
    createEditResourceTab: di.inject(createEditResourceTabInjectable),
    deleteService: di.inject(kubeObjectDeleteServiceInjectable),
    createTerminalTab: di.inject(createTerminalTabInjectable),
    sendCommand: di.inject(sendCommandInjectable),
    hideDetails: di.inject(hideDetailsInjectable),
    createPodLogsTab: di.inject(createPodLogsTabInjectable),
    openPodLogsInWindow: di.inject(openPodLogsInWindowInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
  }),
});
