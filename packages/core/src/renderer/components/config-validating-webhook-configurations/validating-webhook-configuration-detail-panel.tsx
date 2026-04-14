/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ValidatingWebhookConfiguration 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시 (Created, Name, Webhooks)
 *   - ValidatingWebhookConfiguration은 cluster-scoped 리소스 (namespace 없음)
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-03: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ValidatingWebhookConfiguration } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@skuberplus/storybook-shadcn";
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
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

import type { Cluster } from "../../../common/cluster/cluster";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: ValidatingWebhookConfigurationDetailPanel Props 인터페이스
 */
export interface ValidatingWebhookConfigurationDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 ValidatingWebhookConfiguration 객체
   */
  config: ValidatingWebhookConfiguration | undefined;

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
 * 🎯 목적: ValidatingWebhookConfiguration 상세 정보 우측 슬라이드 패널 컴포넌트
 */
const NonInjectedValidatingWebhookConfigurationDetailPanel = observer(
  ({
    isOpen,
    config,
    onClose,
    logger,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
    hostedCluster,
  }: ValidatingWebhookConfigurationDetailPanelProps & Dependencies) => {
    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
    // ============================================
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    // ============================================
    const [renderConfig, setRenderConfig] = useState<ValidatingWebhookConfiguration | undefined>(config);
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const prevIsOpenRef = useRef(true);

    useEffect(() => {
      // 새로 선택된 리소스 반영
      if (config) {
        setRenderConfig(config);
      }

      // 패널 닫힘 애니메이션 처리
      const wasOpen = prevIsOpenRef.current;

      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderConfig(undefined);
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
    }, [isOpen, config]);

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 사용
    const item = renderConfig;

    if (!item) {
      return null;
    }

    if (!(item instanceof ValidatingWebhookConfiguration)) {
      logger.error(
        "[ValidatingWebhookConfigurationDetailPanel]: passed object that is not an instanceof ValidatingWebhookConfiguration",
        item,
      );
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(item);
    };

    /**
     * Delete 액션: ValidatingWebhookConfiguration 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(item, "delete");
            onClose();
          } catch (error) {
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error
                ? error.message
                : "Unknown error occurred while deleting validating webhook configuration",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete validating webhook configuration <b>{item.getName()}</b>?
          </p>
        ),
      });
    };

    const creationTimestamp = item.metadata.creationTimestamp;
    const webhooks = item.getWebhooks();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={item.getName()}
        subtitle="Cluster-scoped resource"
        object={item}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={item} />

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
                    <KubeObjectAge object={item} compact={false} withTooltip={false} />
                    {" ago ("}
                    <LocaleDate date={creationTimestamp} />
                    {")"}
                  </span>
                </TableCell>
              </TableRow>
            )}

            {/* Webhooks Count */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Webhooks</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{webhooks.length}</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Webhooks 상세 테이블 */}
        {webhooks.length > 0 && (
          <DetailPanelSection title="Webhook Details">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="name">Name</TableHead>
                  <TableHead className="admission-review">Admission Review Versions</TableHead>
                  <TableHead className="side-effects">Side Effects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook, index) => (
                  <TableRow key={index}>
                    <TableCell className="name">{webhook.name}</TableCell>
                    <TableCell className="admission-review">
                      {webhook.admissionReviewVersions?.join(", ") || "N/A"}
                    </TableCell>
                    <TableCell className="side-effects">{webhook.sideEffects || "Unknown"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DetailPanelSection>
        )}

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={item} />
      </DetailPanel>
    );
  },
);

/**
 * DI 패턴 적용된 ValidatingWebhookConfiguration Detail Panel
 */
export const ValidatingWebhookConfigurationDetailPanel = withInjectables<
  Dependencies,
  ValidatingWebhookConfigurationDetailPanelProps
>(NonInjectedValidatingWebhookConfigurationDetailPanel, {
  getProps: (di, props) => ({
    ...props,
    logger: di.inject(loggerInjectionToken),
    createEditResourceTab: di.inject(createEditResourceTabInjectable),
    deleteService: di.inject(kubeObjectDeleteServiceInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
    hostedCluster: di.inject(hostedClusterInjectable),
  }),
});
