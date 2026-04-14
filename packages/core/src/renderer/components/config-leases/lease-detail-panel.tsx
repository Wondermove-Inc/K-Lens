/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Lease 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시 (Created, Name, Namespace, Controlled By)
 *   - LeaseDetails 로직 재사용 (Holder Identity, Duration, Transitions, Times 표시)
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-02: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-03: shadcn Table로 메타데이터 UI 변경
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import "./lease-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Lease } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import {
  DetailPanelField,
  DetailPanelFieldGroup,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { observer } from "mobx-react";
import React from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { KubeObjectAge } from "../kube-object/age";
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
 * 🎯 목적: LeaseDetailPanel Props 인터페이스
 */
export interface LeaseDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Lease 객체
   */
  lease: Lease | undefined;

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
 * 🎯 목적: Lease 상세 정보 우측 슬라이드 패널 컴포넌트
 */
const NonInjectedLeaseDetailPanel = observer(
  ({
    isOpen,
    lease,
    onClose,
    logger,
    hostedCluster,
    apiManager,
    getDetailsUrl,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
  }: LeaseDetailPanelProps & Dependencies) => {
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
    const [renderLease, setRenderLease] = React.useState<Lease | undefined>(lease);
    const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const prevIsOpenRef = React.useRef(isOpen);

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    React.useEffect(() => {
      if (lease) {
        setRenderLease(lease);
      }
    }, [lease]);

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    React.useEffect(() => {
      const wasOpen = prevIsOpenRef.current;

      // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderLease(undefined);
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

    // ⚠️ 렌더 대상 Lease가 없으면 렌더링하지 않음
    if (!renderLease) {
      return null;
    }

    if (!(renderLease instanceof Lease)) {
      logger.error("[LeaseDetailPanel]: passed object that is not an instanceof Lease", renderLease);
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(renderLease);
    };

    /**
     * Delete 액션: Lease 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(renderLease, "delete");
            onClose();
          } catch (error) {
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting lease",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete lease <b>{renderLease.getName()}</b>?
          </p>
        ),
      });
    };

    const ownerRefs = renderLease.getOwnerRefs();
    const namespace = renderLease.getNs();
    const creationTimestamp = renderLease.metadata.creationTimestamp;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderLease.getName()}
        subtitle={`Namespace: ${namespace}`}
        object={renderLease}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderLease} />

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
                    <KubeObjectAge object={renderLease} compact={false} withTooltip={false} />
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
                        to={getDetailsUrl(apiManager.lookupApiLink(ref, renderLease))}
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

        <div className="LeaseDetails">
          <DetailPanelFieldGroup>
            <DetailPanelField label="Holder Identity">{renderLease.getHolderIdentity()}</DetailPanelField>

            <DetailPanelField label="Lease Duration Seconds">{renderLease.getLeaseDurationSeconds()}</DetailPanelField>

            <DetailPanelField label="Lease Transitions" hidden={renderLease.getLeaseTransitions() === undefined}>
              {renderLease.getLeaseTransitions()}
            </DetailPanelField>

            <DetailPanelField label="Acquire Time" hidden={renderLease.getAcquireTime() === ""}>
              {renderLease.getAcquireTime()}
            </DetailPanelField>

            <DetailPanelField label="Renew Time">{renderLease.getRenewTime()}</DetailPanelField>
          </DetailPanelFieldGroup>
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderLease} />
      </DetailPanel>
    );
  },
);

/**
 * DI 패턴 적용된 Lease Detail Panel
 */
export const LeaseDetailPanel = withInjectables<Dependencies, LeaseDetailPanelProps>(NonInjectedLeaseDetailPanel, {
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
