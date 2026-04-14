/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: PersistentVolume 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table, Badge 컴포넌트로 상세 정보 표시
 *   - Claim, StorageClass, Capacity, Access Modes, Reclaim Policy 등의 정보 표시
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-05: 초기 생성 (PersistentVolumeClaim DetailPanel 패턴 참고)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { PersistentVolume } from "@skuberplus/kube-object";
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
 * 🎯 목적: PersistentVolumeDetailPanel Props 인터페이스
 */
export interface PersistentVolumeDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 PersistentVolume 객체
   */
  pv: PersistentVolume | undefined;

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
 * 🎯 목적: PersistentVolume 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param pv - 표시할 PersistentVolume 객체
 * @param onClose - 패널 닫기 콜백
 */
class NonInjectedPersistentVolumeDetailPanel extends Component<PersistentVolumeDetailPanelProps & Dependencies> {
  /**
   * 🎯 목적: unmount 애니메이션 실행을 위한 state (패널 닫힐 때 마지막 PV 객체 유지)
   * 📝 주의사항: 패널이 닫히는 동안(320ms) 이전 PV 객체를 렌더링하여 자연스러운 슬라이드 아웃 구현
   */
  state = {
    renderPersistentVolume: this.props.pv,
  };

  /**
   * 🎯 목적: 이전 isOpen 상태를 추적하기 위한 ref (패널 닫힘 감지)
   */
  private prevIsOpenRef = false;

  /**
   * 🎯 목적: unmount 애니메이션 타이머를 저장하는 ref (cleanup 시 타이머 정리)
   */
  private clearTimerRef?: ReturnType<typeof setTimeout>;

  /**
   * 🎯 액션 핸들러: Edit 액션 - YAML 편집 탭 열기
   */
  handleEdit = () => {
    const { pv, createEditResourceTab } = this.props;
    if (pv) {
      createEditResourceTab(pv);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - PersistentVolume 삭제 확인 다이얼로그 표시
   */
  handleDelete = () => {
    const { pv, deleteService, onClose, openConfirmDialog, hostedCluster } = this.props;
    if (!pv) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(pv, "delete");
          onClose();
        } catch (error) {
          // 🆕 FIX-038: clusterName 메타데이터 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting persistent volume",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete persistent volume <b>{pv.getName()}</b>?
        </p>
      ),
    });
  };

  /**
   * 🔄 라이프사이클: pv prop이 변경될 때 renderPersistentVolume state 업데이트
   */
  componentDidUpdate(prevProps: PersistentVolumeDetailPanelProps & Dependencies) {
    const { pv, isOpen } = this.props;

    // 🎯 새로운 PV 객체가 들어오면 즉시 state 업데이트 (패널 열림 시)
    if (pv && pv !== prevProps.pv) {
      this.setState({ renderPersistentVolume: pv });
    }

    // 🎯 패널이 닫히는 순간 감지 (wasOpen && !isOpen)
    const wasOpen = this.prevIsOpenRef;
    if (!isOpen && wasOpen) {
      // 320ms 후 renderPersistentVolume을 undefined로 설정 (슬라이드 아웃 애니메이션 완료 후)
      this.clearTimerRef = setTimeout(() => {
        this.setState({ renderPersistentVolume: undefined });
      }, 320);
    }

    // 🎯 패널이 다시 열릴 때 타이머가 있으면 취소 (애니메이션 중단 방지)
    if (isOpen && this.clearTimerRef) {
      clearTimeout(this.clearTimerRef);
      this.clearTimerRef = undefined;
    }

    // 이전 isOpen 상태 업데이트
    this.prevIsOpenRef = isOpen;
  }

  /**
   * 🧹 라이프사이클: 컴포넌트 언마운트 시 타이머 정리
   */
  componentWillUnmount() {
    if (this.clearTimerRef) {
      clearTimeout(this.clearTimerRef);
    }
  }

  render() {
    const { isOpen, onClose, logger } = this.props;
    const { renderPersistentVolume } = this.state;

    if (!renderPersistentVolume) {
      return null;
    }

    if (!(renderPersistentVolume instanceof PersistentVolume)) {
      logger.error(
        "[PersistentVolumeDetailPanel]: passed object that is not a PersistentVolume",
        renderPersistentVolume,
      );

      return null;
    }

    // 🎯 변수명을 pv로 유지하여 기존 로직 변경 없이 사용
    const pv = renderPersistentVolume;

    // 🎯 PV 속성 데이터 추출
    const status = pv.getStatus();
    const claimName = pv.getClaimRefName() || "-";
    const storageClass = pv.getStorageClass() || "-";
    const capacity = pv.getCapacity();
    const accessModes = pv.spec.accessModes?.join(", ") || "-";
    const reclaimPolicy = pv.spec.persistentVolumeReclaimPolicy || "-";
    const volumeMode = pv.spec.volumeMode || "Filesystem";

    // 🎯 Storage Type 추출 (flexVolume, nfs 등)
    let storageType = "-";
    if (pv.spec.flexVolume) {
      storageType = "FlexVolume";
    } else if (pv.spec.nfs) {
      storageType = "NFS";
    }

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={pv.getName()}
        subtitle="Cluster-scoped"
        object={pv}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={pv} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 속성 테이블 - shadcn Table 컴포넌트 사용 */}
        {/* ============================================ */}
        <Table>
          <TableBody>
            {/* Status */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Status</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <Badge variant={status === "Bound" ? "default" : "secondary"}>{status}</Badge>
              </TableCell>
            </TableRow>

            {/* Claim */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Claim</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{claimName}</span>
              </TableCell>
            </TableRow>

            {/* Storage Class */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Storage Class</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{storageClass}</span>
              </TableCell>
            </TableRow>

            {/* Capacity */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Capacity</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{capacity}</span>
              </TableCell>
            </TableRow>

            {/* Access Modes */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Access Modes</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{accessModes}</span>
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

            {/* Volume Mode */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Volume Mode</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{volumeMode}</span>
              </TableCell>
            </TableRow>

            {/* Storage Type */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Storage Type</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{storageType}</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={pv} />
      </DetailPanel>
    );
  }
}

export const PersistentVolumeDetailPanel = withInjectables<Dependencies, PersistentVolumeDetailPanelProps>(
  observer(NonInjectedPersistentVolumeDetailPanel),
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
