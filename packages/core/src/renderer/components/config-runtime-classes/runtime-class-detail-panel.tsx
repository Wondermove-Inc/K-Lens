/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: RuntimeClass 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시 (Created, Name, Handler, Overhead, Scheduling)
 *   - RuntimeClass는 cluster-scoped 리소스 (namespace 없음)
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-03: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { RuntimeClass } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import { KubeObjectAge } from "../kube-object/age";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { LocaleDate } from "../locale-date";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: RuntimeClassDetailPanel Props 인터페이스
 */
export interface RuntimeClassDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 RuntimeClass 객체
   */
  runtimeClass: RuntimeClass | undefined;

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
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * 🎯 목적: RuntimeClass 상세 정보 우측 슬라이드 패널 컴포넌트
 */
const NonInjectedRuntimeClassDetailPanel = observer(
  ({
    isOpen,
    runtimeClass,
    onClose,
    logger,
    hostedCluster,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
  }: RuntimeClassDetailPanelProps & Dependencies) => {
    // ============================================
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    // ============================================
    const [renderRuntimeClass, setRenderRuntimeClass] = useState<RuntimeClass | undefined>(runtimeClass);
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const prevIsOpenRef = useRef(true);

    useEffect(() => {
      // 새로 선택된 리소스 반영
      if (runtimeClass) {
        setRenderRuntimeClass(runtimeClass);
      }

      // 패널 닫힘 애니메이션 처리
      const wasOpen = prevIsOpenRef.current;

      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderRuntimeClass(undefined);
        }, 320);
      }

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
    }, [isOpen, runtimeClass]);

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 사용
    const rc = renderRuntimeClass;

    if (!rc) {
      return null;
    }

    if (!(rc instanceof RuntimeClass)) {
      logger.error("[RuntimeClassDetailPanel]: passed object that is not an instanceof RuntimeClass", rc);
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(rc);
    };

    /**
     * Delete 액션: RuntimeClass 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(rc, "delete");
            onClose();
          } catch (error) {
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting runtime class",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete runtime class <b>{rc.getName()}</b>?
          </p>
        ),
      });
    };

    const creationTimestamp = rc.metadata.creationTimestamp;
    const handler = rc.getHandler();
    const overhead = rc.overhead;
    const scheduling = rc.scheduling;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={rc.getName()}
        subtitle="Cluster-scoped resource"
        object={rc}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={rc} />

        <Separator className="my-6" />
        {/* 메타데이터 테이블 - shadcn Table 사용 */}
        <Table>
          <TableBody>
            {/* Created */}
            {creationTimestamp && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Created</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">
                    <KubeObjectAge object={rc} compact={false} withTooltip={false} />
                    {" ago ("}
                    <LocaleDate date={creationTimestamp} />
                    {")"}
                  </span>
                </TableCell>
              </TableRow>
            )}

            {/* Handler */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Handler</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{handler}</span>
              </TableCell>
            </TableRow>

            {/* Overhead */}
            {overhead && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Overhead</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm font-mono">{JSON.stringify(overhead, null, 2)}</span>
                </TableCell>
              </TableRow>
            )}

            {/* Scheduling */}
            {scheduling && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Scheduling</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm font-mono">{JSON.stringify(scheduling, null, 2)}</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={rc} />
      </DetailPanel>
    );
  },
);

/**
 * DI 패턴 적용된 RuntimeClass Detail Panel
 */
export const RuntimeClassDetailPanel = withInjectables<Dependencies, RuntimeClassDetailPanelProps>(
  NonInjectedRuntimeClassDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      hostedCluster: di.inject(hostedClusterInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
    }),
  },
);
