/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: PriorityClass 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시 (Created, Name, Value, Global Default, Preemption Policy, Description)
 *   - PriorityClass는 cluster-scoped 리소스 (namespace 없음)
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-03: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { PriorityClass } from "@skuberplus/kube-object";
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
 * 🎯 목적: PriorityClassDetailPanel Props 인터페이스
 */
export interface PriorityClassDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 PriorityClass 객체
   */
  priorityClass: PriorityClass | undefined;

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
 * 🎯 목적: PriorityClass 상세 정보 우측 슬라이드 패널 컴포넌트
 */
const NonInjectedPriorityClassDetailPanel = observer(
  ({
    isOpen,
    priorityClass,
    onClose,
    logger,
    hostedCluster,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
  }: PriorityClassDetailPanelProps & Dependencies) => {
    // ============================================
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    // ============================================
    const [renderPriorityClass, setRenderPriorityClass] = useState<PriorityClass | undefined>(priorityClass);
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const prevIsOpenRef = useRef(true);

    useEffect(() => {
      // 새로 선택된 리소스 반영
      if (priorityClass) {
        setRenderPriorityClass(priorityClass);
      }

      // 패널 닫힘 애니메이션 처리
      const wasOpen = prevIsOpenRef.current;

      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderPriorityClass(undefined);
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
    }, [isOpen, priorityClass]);

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 사용
    const pc = renderPriorityClass;

    if (!pc) {
      return null;
    }

    if (!(pc instanceof PriorityClass)) {
      logger.error("[PriorityClassDetailPanel]: passed object that is not an instanceof PriorityClass", pc);
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(pc);
    };

    /**
     * Delete 액션: PriorityClass 삭제 확인 다이얼로그 표시
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(pc, "delete");
            onClose();
          } catch (error) {
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting priority class",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete priority class <b>{pc.getName()}</b>?
          </p>
        ),
      });
    };

    const creationTimestamp = pc.metadata.creationTimestamp;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={pc.getName()}
        subtitle="Cluster-scoped resource"
        object={pc}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={pc} />

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
                    <KubeObjectAge object={pc} compact={false} withTooltip={false} />
                    {" ago ("}
                    <LocaleDate date={creationTimestamp} />
                    {")"}
                  </span>
                </TableCell>
              </TableRow>
            )}

            {/* Value */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Value</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{pc.getValue()}</span>
              </TableCell>
            </TableRow>

            {/* Global Default */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Global Default</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{pc.getGlobalDefault()}</span>
              </TableCell>
            </TableRow>

            {/* Preemption Policy */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Preemption Policy</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{pc.getPreemptionPolicy()}</span>
              </TableCell>
            </TableRow>

            {/* Description */}
            {pc.getDescription() && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Description</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{pc.getDescription()}</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={pc} />
      </DetailPanel>
    );
  },
);

/**
 * DI 패턴 적용된 PriorityClass Detail Panel
 */
export const PriorityClassDetailPanel = withInjectables<Dependencies, PriorityClassDetailPanelProps>(
  NonInjectedPriorityClassDetailPanel,
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
