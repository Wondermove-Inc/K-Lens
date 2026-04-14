/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: LimitRange 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시 (Created, Name, Namespace, Controlled By)
 *   - LimitRangeDetails 로직 재사용 (Container/Pod/PVC Limits 표시)
 *   - shadcn Badge 컴포넌트 사용
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-02: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-03: shadcn Table로 메타데이터 UI 변경
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import "./limit-range-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { LimitPart, LimitRange, Resource } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelFieldGroup,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
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

import type { KubeObject, LimitRangeItem } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: LimitRangeDetailPanel Props 인터페이스
 */
export interface LimitRangeDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 LimitRange 객체
   */
  limitRange: LimitRange | undefined;

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
 * 🎯 목적: 개별 Limit 항목 렌더링 (Badge 형태)
 */
function renderLimit(limit: LimitRangeItem, part: LimitPart, resource: Resource) {
  const resourceLimit = limit[part]?.[resource];

  if (!resourceLimit) {
    return null;
  }

  return <Badge key={`${part}-${resource}`}>{`${part}:${resourceLimit}`}</Badge>;
}

/**
 * 🎯 목적: 리소스별 Limit 렌더링 (CPU, Memory, Storage)
 */
function renderResourceLimits(limit: LimitRangeItem, resource: Resource) {
  return (
    <React.Fragment key={limit.type + resource}>
      {renderLimit(limit, LimitPart.MIN, resource)}
      {renderLimit(limit, LimitPart.MAX, resource)}
      {renderLimit(limit, LimitPart.DEFAULT, resource)}
      {renderLimit(limit, LimitPart.DEFAULT_REQUEST, resource)}
      {renderLimit(limit, LimitPart.MAX_LIMIT_REQUEST_RATIO, resource)}
    </React.Fragment>
  );
}

/**
 * 🎯 목적: Limit 상세 정보 렌더링 (DetailPanelField로 감싸기)
 */
function renderLimitDetails(limits: LimitRangeItem[], resources: Resource[]) {
  return resources.map((resource) => (
    <DetailPanelField key={resource} label={resource}>
      {limits.map((limit) => renderResourceLimits(limit, resource))}
    </DetailPanelField>
  ));
}

/**
 * 🎯 목적: LimitRange 상세 정보 우측 슬라이드 패널 컴포넌트
 */
class NonInjectedLimitRangeDetailPanel extends Component<LimitRangeDetailPanelProps & Dependencies> {
  /**
   * 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
   */
  @observable private renderLimitRange: LimitRange | undefined;
  private clearTimerRef: ReturnType<typeof setTimeout> | undefined;
  private prevIsOpenRef = true;

  constructor(props: LimitRangeDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
    // 초기값 설정
    this.renderLimitRange = props.limitRange;
  }

  /**
   * 🎯 패널 닫힘 애니메이션 처리 - 데이터 유지
   */
  componentDidUpdate(prevProps: LimitRangeDetailPanelProps & Dependencies) {
    const { isOpen, limitRange } = this.props;

    // 새로 선택된 리소스 반영
    if (limitRange) {
      this.renderLimitRange = limitRange;
    }

    // 패널 닫힘 애니메이션 처리
    const wasOpen = this.prevIsOpenRef;

    if (!isOpen && wasOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.renderLimitRange = undefined;
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

  /**
   * 🎯 액션 핸들러: Edit 액션 - YAML 편집 탭 열기
   */
  handleEdit = () => {
    const { limitRange, createEditResourceTab } = this.props;
    if (limitRange) {
      createEditResourceTab(limitRange);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - LimitRange 삭제
   */
  handleDelete = () => {
    const { limitRange, hostedCluster, deleteService, onClose, openConfirmDialog } = this.props;
    if (!limitRange) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(limitRange, "delete");
          onClose();
        } catch (error) {
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting limit range",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete limit range <b>{limitRange.getName()}</b>?
        </p>
      ),
    });
  };

  render() {
    const { isOpen, onClose, logger, apiManager, getDetailsUrl } = this.props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    const limitRange = this.renderLimitRange;

    if (!limitRange) {
      return null;
    }

    if (!(limitRange instanceof LimitRange)) {
      logger.error("[LimitRangeDetailPanel]: passed object that is not an instanceof LimitRange", limitRange);
      return null;
    }

    const containerLimits = limitRange.getContainerLimits();
    const podLimits = limitRange.getPodLimits();
    const pvcLimits = limitRange.getPVCLimits();
    const ownerRefs = limitRange.getOwnerRefs();
    const namespace = limitRange.getNs();
    const creationTimestamp = limitRange.metadata.creationTimestamp;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={limitRange.getName()}
        subtitle={`Namespace: ${namespace}`}
        object={limitRange}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={limitRange} />

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
                    <KubeObjectAge object={limitRange} compact={false} withTooltip={false} />
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
                        to={getDetailsUrl(apiManager.lookupApiLink(ref, limitRange))}
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

        <div className="LimitRangeDetails">
          <DetailPanelFieldGroup>
            {containerLimits.length > 0 && (
              <DetailPanelField label="Container Limits">
                {renderLimitDetails(containerLimits, [Resource.CPU, Resource.MEMORY, Resource.EPHEMERAL_STORAGE])}
              </DetailPanelField>
            )}
            {podLimits.length > 0 && (
              <DetailPanelField label="Pod Limits">
                {renderLimitDetails(podLimits, [Resource.CPU, Resource.MEMORY, Resource.EPHEMERAL_STORAGE])}
              </DetailPanelField>
            )}
            {pvcLimits.length > 0 && (
              <DetailPanelField label="Persistent Volume Claim Limits">
                {renderLimitDetails(pvcLimits, [Resource.STORAGE])}
              </DetailPanelField>
            )}
          </DetailPanelFieldGroup>
        </div>

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={limitRange} />
      </DetailPanel>
    );
  }
}

/**
 * DI 패턴 적용된 LimitRange Detail Panel
 */
export const LimitRangeDetailPanel = withInjectables<Dependencies, LimitRangeDetailPanelProps>(
  observer(NonInjectedLimitRangeDetailPanel),
  {
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
  },
);
