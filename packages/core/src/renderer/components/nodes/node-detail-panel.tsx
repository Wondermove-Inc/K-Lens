/**
 * 🎯 목적: Node 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - 공통 DetailPanel 컴포넌트 사용 (packages/storybook-shadcn/src/components/ui/detail-panel.tsx)
 *   - shadcn UI 컴포넌트 (Table, Badge) 사용
 *   - 메트릭 차트 자동 표시 (metricsComponent prop)
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-13: 초기 생성 (레거시 DrawerItem 스타일에서 shadcn DetailPanel로 마이그레이션)
 */

import "./details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { formatNodeTaint, Node } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { bytesToUnits, unitsToBytes } from "@skuberplus/utilities";
import { makeObservable, observable } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import { App } from "../../../extensions/common-api";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import createTerminalTabInjectable from "../dock/terminal/create-terminal-tab.injectable";
import sendCommandInjectable from "../dock/terminal/send-command.injectable";
import hideDetailsInjectable from "../kube-detail-params/hide-details.injectable";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { WithTooltip } from "../with-tooltip";
import loadPodsFromAllNamespacesInjectable from "../workloads-pods/load-pods-from-all-namespaces.injectable";
import { PodDetailsList } from "../workloads-pods/pod-details-list";
import podStoreInjectable from "../workloads-pods/store.injectable";
import { NodeMetricsDetailsComponent } from "./metrics-details-component";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { SendCommand } from "../dock/terminal/send-command.injectable";
import type { HideDetails } from "../kube-detail-params/hide-details.injectable";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";
import type { PodStore } from "../workloads-pods/store";

export interface NodeDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Node 객체
   */
  node: Node | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  createTerminalTab: (tabParams: DockTabCreateSpecific) => void;
  sendCommand: SendCommand;
  hideDetails: HideDetails;
  openConfirmDialog: OpenConfirmDialog;
  subscribeStores: SubscribeStores;
  podStore: PodStore;
  loadPodsFromAllNamespaces: () => void;
  hostedCluster: Cluster | undefined;
}

/**
 * Node 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param node - 표시할 Node 객체
 * @param onClose - 패널 닫기 콜백
 */
class NonInjectedNodeDetailPanel extends Component<NodeDetailPanelProps & Dependencies> {
  // ============================================
  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
  // ============================================
  @observable private renderNode: Node | undefined;
  private clearTimerRef: ReturnType<typeof setTimeout> | undefined;
  private prevIsOpenRef = true;

  constructor(props: NodeDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
    this.renderNode = props.node;
  }

  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.podStore])]);
    this.props.loadPodsFromAllNamespaces();
  }

  componentDidUpdate(prevProps: NodeDetailPanelProps & Dependencies) {
    const { isOpen, node } = this.props;

    // 새로 선택된 리소스 반영
    if (node) {
      this.renderNode = node;
    }

    // 패널 닫힘 애니메이션 처리
    const wasOpen = this.prevIsOpenRef;

    if (!isOpen && wasOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.renderNode = undefined;
      }, 320);
    }

    if (isOpen && this.clearTimerRef) {
      clearTimeout(this.clearTimerRef);
      this.clearTimerRef = undefined;
    }

    this.prevIsOpenRef = isOpen;
  }

  componentWillUnmount() {
    if (this.clearTimerRef) {
      clearTimeout(this.clearTimerRef);
    }
  }

  render() {
    const {
      isOpen,
      onClose,
      logger,
      createEditResourceTab,
      deleteService,
      createTerminalTab,
      sendCommand,
      hideDetails,
      openConfirmDialog,
      podStore,
      hostedCluster,
    } = this.props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 사용
    const node = this.renderNode;

    // ⚠️ Node 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!node) {
      return null;
    }

    if (!(node instanceof Node)) {
      logger.error("[NodeDetailPanel]: passed object that is not an instanceof Node", node);
      return null;
    }

    // 🎯 Node 속성 데이터 추출
    const { nodeInfo, addresses } = node.status ?? {};
    const taints = node.getTaints();
    const childPods = podStore.getPodsByNode(node.getName());

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(node);
    };

    /**
     * Delete 액션: Node 삭제 (Confirm Dialog → API 호출)
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(node, "delete");
            onClose();
          } catch (error) {
            logger.error("[NodeDetailPanel] Delete failed:", error);
            // 🆕 FIX-038: clusterName 메타데이터 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting node",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete node <b>{node.getName()}</b>?
          </p>
        ),
      });
    };

    /**
     * Cordon 액션: Node 스케줄링 중지 (Confirm Dialog → kubectl cordon)
     */
    const handleCordon = () => {
      const nodeName = node.getName();
      const kubectlPath = App.Preferences.getKubectlPath() || "kubectl";

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
        message: (
          <p>
            Are you sure you want to cordon node <b>{nodeName}</b>?
            <br />
            <span className="text-sm text-muted-foreground">
              This will mark the node as unschedulable and prevent new pods from being scheduled on it.
            </span>
          </p>
        ),
      });
    };

    /**
     * Uncordon 액션: Node 스케줄링 재개 (Confirm Dialog → kubectl uncordon)
     */
    const handleUncordon = () => {
      const nodeName = node.getName();
      const kubectlPath = App.Preferences.getKubectlPath() || "kubectl";

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
        message: (
          <p>
            Are you sure you want to uncordon node <b>{nodeName}</b>?
            <br />
            <span className="text-sm text-muted-foreground">
              This will mark the node as schedulable and allow new pods to be scheduled on it.
            </span>
          </p>
        ),
      });
    };

    /**
     * Drain 액션: Node Pod 제거 (Confirm Dialog → kubectl drain)
     */
    const handleDrain = () => {
      const nodeName = node.getName();
      const kubectlPath = App.Preferences.getKubectlPath() || "kubectl";
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
        message: (
          <p>
            Are you sure you want to drain node <b>{nodeName}</b>?
            <br />
            <span className="text-sm text-muted-foreground">
              This will safely evict all pods from the node before maintenance.
            </span>
          </p>
        ),
      });
    };

    /**
     * Shell 액션: Node Shell 터미널 탭 열기
     */
    const handleShell = () => {
      createTerminalTab({
        title: `Node: ${node.getName()}`,
        node: node.getName(),
      });
      hideDetails();
    };

    /**
     * 리소스 데이터 렌더링 헬퍼 (Capacity/Allocatable용)
     */
    const renderResourceTable = (type: "capacity" | "allocatable") => {
      const resourceStatus = node.status?.[type];

      if (!resourceStatus) {
        return null;
      }

      return (
        <Table>
          <TableBody>
            {Object.entries(resourceStatus).map(([key, value]) => {
              if (value === undefined || value === null) {
                return null;
              }

              let displayValue = value;
              let tooltip = null;

              // 메모리 및 스토리지 단위 변환
              if (key === "ephemeral-storage" || key === "memory") {
                const convertedValue = bytesToUnits(unitsToBytes(value));
                if (convertedValue !== "N/A") {
                  tooltip = value;
                  displayValue = convertedValue;
                }
              }

              return (
                <TableRow key={key}>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{key}</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <WithTooltip tooltip={tooltip}>
                      <span className="text-foreground text-sm">{displayValue}</span>
                    </WithTooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      );
    };

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={node.getName()}
        subtitle={`Roles: ${node.getRoleLabels() || "None"}`}
        metricsComponent={<NodeMetricsDetailsComponent object={node} />}
        object={node}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onShell={handleShell}
        onCordon={handleCordon}
        onUncordon={handleUncordon}
        onDrain={handleDrain}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={node} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 속성 테이블 - shadcn Table 컴포넌트 사용 */}
        {/* ============================================ */}
        <Table>
          <TableBody>
            {/* Addresses */}
            {addresses && addresses.length > 0 && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Addresses</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <div className="flex flex-col gap-1">
                    {addresses.map(({ type, address }) => (
                      <span key={type} className="text-foreground text-sm">
                        {type}: {address}
                      </span>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* OS */}
            {nodeInfo && (
              <>
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">OS</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">
                      {nodeInfo.operatingSystem} ({nodeInfo.architecture})
                    </span>
                  </TableCell>
                </TableRow>

                {/* OS Image */}
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">OS Image</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{nodeInfo.osImage}</span>
                  </TableCell>
                </TableRow>

                {/* Kernel version */}
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Kernel version</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{nodeInfo.kernelVersion}</span>
                  </TableCell>
                </TableRow>

                {/* Container runtime */}
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Container runtime</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{nodeInfo.containerRuntimeVersion}</span>
                  </TableCell>
                </TableRow>

                {/* Kubelet version */}
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Kubelet version</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{nodeInfo.kubeletVersion}</span>
                  </TableCell>
                </TableRow>
              </>
            )}

            {/* Taints */}
            {taints.length > 0 && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Taints</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <div className="flex flex-wrap gap-1">
                    {taints.map((taint) => (
                      <Badge key={taint.key} variant="outline">
                        {formatNodeTaint(taint)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* ============================================ */}
        {/* 📦 Conditions 섹션 */}
        {/* ============================================ */}
        <div className="mt-8">
          <KubeObjectConditionsDrawer object={node} />
        </div>

        {/* ============================================ */}
        {/* 📦 Capacity 섹션 */}
        {/* ============================================ */}
        <div className="mt-8">
          <DetailPanelSection title="Capacity">{renderResourceTable("capacity")}</DetailPanelSection>
        </div>

        {/* ============================================ */}
        {/* 📦 Allocatable 섹션 */}
        {/* ============================================ */}
        <div className="mt-8">
          <DetailPanelSection title="Allocatable">{renderResourceTable("allocatable")}</DetailPanelSection>
        </div>

        {/* ============================================ */}
        {/* 📦 Child Pods 섹션 */}
        {/* ============================================ */}
        <div className="mt-8">
          <PodDetailsList
            pods={childPods}
            owner={node}
            maxCpu={node.getCpuCapacity()}
            maxMemory={node.getMemoryCapacity()}
          />
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={node} />
      </DetailPanel>
    );
  }
}

/**
 * DI 패턴 적용된 Node Detail Panel
 */
export const NodeDetailPanel = withInjectables<Dependencies, NodeDetailPanelProps>(
  observer(NonInjectedNodeDetailPanel),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      createTerminalTab: di.inject(createTerminalTabInjectable),
      sendCommand: di.inject(sendCommandInjectable),
      hideDetails: di.inject(hideDetailsInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      subscribeStores: di.inject(subscribeStoresInjectable),
      podStore: di.inject(podStoreInjectable),
      loadPodsFromAllNamespaces: di.inject(loadPodsFromAllNamespacesInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
