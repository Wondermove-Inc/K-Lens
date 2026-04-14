/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: StorageClass 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table, Badge 컴포넌트로 상세 정보 표시
 *   - Provisioner, Reclaim Policy, Volume Binding Mode, Allow Volume Expansion 등의 정보 표시
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-05: 초기 생성 (PersistentVolume DetailPanel 패턴 참고)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { StorageClass } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { observer } from "mobx-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: StorageClassDetailPanel Props 인터페이스
 */
export interface StorageClassDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 StorageClass 객체
   */
  storageClass: StorageClass | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
  hostedCluster: Cluster | undefined;
}

/**
 * 🎯 목적: StorageClass 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param storageClass - 표시할 StorageClass 객체
 * @param onClose - 패널 닫기 콜백
 */
class NonInjectedStorageClassDetailPanel extends Component<StorageClassDetailPanelProps & Dependencies> {
  state = {
    /**
     * 🎯 목적: 닫힘 애니메이션 동안 마지막 선택 항목을 유지
     */
    renderStorageClass: this.props.storageClass as StorageClass | undefined,
  };

  private clearTimer?: ReturnType<typeof setTimeout>;

  componentDidUpdate(prevProps: Readonly<StorageClassDetailPanelProps>) {
    const { storageClass, isOpen } = this.props;

    // 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    if (storageClass && storageClass !== prevProps.storageClass) {
      this.setState({ renderStorageClass: storageClass });
    }

    // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
    if (!isOpen && prevProps.isOpen) {
      this.clearTimer = setTimeout(() => {
        this.setState({ renderStorageClass: undefined });
      }, 320);
    }

    // 다시 열리면 정리 타이머 취소
    if (isOpen && this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = undefined;
    }
  }

  componentWillUnmount() {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
    }
  }

  /**
   * 🎯 액션 핸들러: Edit 액션 - YAML 편집 탭 열기
   */
  handleEdit = () => {
    const { createEditResourceTab } = this.props;
    const { renderStorageClass } = this.state;

    if (renderStorageClass) {
      createEditResourceTab(renderStorageClass);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - StorageClass 삭제
   */
  handleDelete = () => {
    const { deleteService, onClose, openConfirmDialog, hostedCluster } = this.props;
    const { renderStorageClass } = this.state;

    if (!renderStorageClass) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(renderStorageClass, "delete");
          onClose();
        } catch (error) {
          // 🆕 FIX-038: clusterName 메타데이터 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting storage class",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete storage class <b>{renderStorageClass.getName()}</b>?
        </p>
      ),
    });
  };

  render() {
    const { isOpen, storageClass, onClose, logger } = this.props;
    const { renderStorageClass } = this.state;

    if (!renderStorageClass) {
      return null;
    }

    if (storageClass && !(storageClass instanceof StorageClass)) {
      logger.error("[StorageClassDetailPanel]: passed object that is not a StorageClass", storageClass);

      return null;
    }

    // 🎯 StorageClass 속성 데이터 추출
    const provisioner = renderStorageClass.provisioner;
    const reclaimPolicy = renderStorageClass.reclaimPolicy || "-";
    const volumeBindingMode = renderStorageClass.volumeBindingMode || "-";
    const allowVolumeExpansion = renderStorageClass.allowVolumeExpansion ? "Yes" : "No";
    const isDefault = renderStorageClass.isDefault();
    const mountOptions = renderStorageClass.mountOptions?.join(", ") || "-";

    // Parameters를 key-value 쌍으로 표시
    const parameters = renderStorageClass.parameters || {};
    const parameterEntries = Object.entries(parameters);

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderStorageClass.getName()}
        subtitle="Cluster-scoped"
        object={renderStorageClass}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderStorageClass} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 속성 테이블 - shadcn Table 컴포넌트 사용 */}
        {/* ============================================ */}
        <Table>
          <TableBody>
            {/* Provisioner */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Provisioner</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{provisioner}</span>
              </TableCell>
            </TableRow>

            {/* Reclaim Policy */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Reclaim Policy</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <Badge variant="outline">{reclaimPolicy}</Badge>
              </TableCell>
            </TableRow>

            {/* Volume Binding Mode */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Volume Binding Mode</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{volumeBindingMode}</span>
              </TableCell>
            </TableRow>

            {/* Allow Volume Expansion */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Allow Volume Expansion</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <Badge variant={allowVolumeExpansion === "Yes" ? "default" : "secondary"}>{allowVolumeExpansion}</Badge>
              </TableCell>
            </TableRow>

            {/* Default Storage Class */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Default Storage Class</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <Badge variant={isDefault ? "default" : "secondary"}>{isDefault ? "Yes" : "No"}</Badge>
              </TableCell>
            </TableRow>

            {/* Mount Options */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Mount Options</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{mountOptions}</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* ============================================ */}
        {/* 📋 Parameters 섹션 (존재할 경우에만 표시) */}
        {/* ============================================ */}
        {parameterEntries.length > 0 && (
          <>
            <Separator className="my-6" />
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">Parameters</h3>
              <Table>
                <TableBody>
                  {parameterEntries.map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        <span className="text-foreground text-sm">{key}</span>
                      </TableCell>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        <span className="text-foreground text-sm">{value}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderStorageClass} />
      </DetailPanel>
    );
  }
}

export const StorageClassDetailPanel = withInjectables<Dependencies, StorageClassDetailPanelProps>(
  observer(NonInjectedStorageClassDetailPanel),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
