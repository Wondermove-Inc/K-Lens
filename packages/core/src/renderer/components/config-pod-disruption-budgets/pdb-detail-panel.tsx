/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: PodDisruptionBudget 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시 (Created, Name, Namespace, Controlled By)
 *   - PodDisruptionBudgetDetails 로직 재사용 (Selector, Min/Max, Conditions 표시)
 *   - shadcn Badge 컴포넌트 사용
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-02: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-03: shadcn Table로 메타데이터 UI 변경
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import "./pod-disruption-budgets-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { PodDisruptionBudget } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelFieldGroup,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { LocaleDate } from "../locale-date";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: PdbDetailPanel Props 인터페이스
 */
export interface PdbDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 PodDisruptionBudget 객체
   */
  pdb: PodDisruptionBudget | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  hostedCluster: HostedCluster | undefined;
  apiManager: ApiManager;
  getDetailsUrl: GetDetailsUrl;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * 🎯 목적: PodDisruptionBudget 상세 정보 우측 슬라이드 패널 컴포넌트
 */
const NonInjectedPdbDetailPanel = observer(
  ({
    isOpen,
    pdb,
    onClose,
    logger,
    hostedCluster,
    apiManager,
    getDetailsUrl,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
  }: PdbDetailPanelProps & Dependencies) => {
    // ============================================
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    // ============================================
    const [renderPdb, setRenderPdb] = useState<PodDisruptionBudget | undefined>(pdb);
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const prevIsOpenRef = useRef(true);

    useEffect(() => {
      // 새로 선택된 리소스 반영
      if (pdb) {
        setRenderPdb(pdb);
      }

      // 패널 닫힘 애니메이션 처리
      const wasOpen = prevIsOpenRef.current;

      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderPdb(undefined);
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
    }, [isOpen, pdb]);

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 사용
    const item = renderPdb;

    if (!item) {
      return null;
    }

    if (!(item instanceof PodDisruptionBudget)) {
      logger.error("[PdbDetailPanel]: passed object that is not an instanceof PodDisruptionBudget", item);
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
     * Delete 액션: PDB 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(item, "delete");
            onClose();
          } catch (error) {
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting pod disruption budget",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete pod disruption budget <b>{item.getName()}</b>?
          </p>
        ),
      });
    };

    const selectors = item.getSelectors();
    const ownerRefs = item.getOwnerRefs();
    const namespace = item.getNs();
    const creationTimestamp = item.metadata.creationTimestamp;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={item.getName()}
        subtitle={`Namespace: ${namespace}`}
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

            {/* Controlled By */}
            {ownerRefs && ownerRefs.length > 0 && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Controlled By</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  {ownerRefs.map((ref) => (
                    <p key={ref.name} className="text-foreground text-sm">
                      {`${ref.kind} `}
                      <Link
                        to={getDetailsUrl(apiManager.lookupApiLink(ref, item))}
                        className="text-primary hover:underline"
                      >
                        {ref.name}
                      </Link>
                    </p>
                  ))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="PdbDetails">
          <DetailPanelFieldGroup>
            {selectors.length > 0 && (
              <DetailPanelField label="Selector">
                {selectors.map((label) => (
                  <Badge key={label}>{label}</Badge>
                ))}
              </DetailPanelField>
            )}

            <DetailPanelField label="Min Available">{item.getMinAvailable()}</DetailPanelField>
            <DetailPanelField label="Max Unavailable">{item.getMaxUnavailable()}</DetailPanelField>
            <DetailPanelField label="Current Healthy">{item.getCurrentHealthy()}</DetailPanelField>
            <DetailPanelField label="Desired Healthy">{item.getDesiredHealthy()}</DetailPanelField>
          </DetailPanelFieldGroup>
          <KubeObjectConditionsDrawer object={item} />
        </div>

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={item} />
      </DetailPanel>
    );
  },
);

/**
 * DI 패턴 적용된 PDB Detail Panel
 */
export const PdbDetailPanel = withInjectables<Dependencies, PdbDetailPanelProps>(NonInjectedPdbDetailPanel, {
  getProps: (di, props) => ({
    ...props,
    logger: di.inject(loggerInjectionToken),
    hostedCluster: di.inject(hostedClusterInjectable),
    apiManager: di.inject(apiManagerInjectable),
    getDetailsUrl: di.inject(getDetailsUrlInjectable),
    createEditResourceTab: di.inject(createEditResourceTabInjectable),
    deleteService: di.inject(kubeObjectDeleteServiceInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
  }),
});
