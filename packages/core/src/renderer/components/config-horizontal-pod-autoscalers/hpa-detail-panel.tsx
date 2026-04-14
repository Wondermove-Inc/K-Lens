/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: HorizontalPodAutoscaler 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 및 HPA 정보 표시 (Created, Name, Namespace, Controlled By, Reference, Min/Max Pods, Replicas)
 *   - HorizontalPodAutoscalerDetails 로직 재사용 (Metrics, Conditions 표시)
 *   - shadcn Table 컴포넌트 사용
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-02: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-03: shadcn Table로 메타데이터 및 HPA 정보 UI 변경
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import "./details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { HorizontalPodAutoscaler } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@skuberplus/storybook-shadcn";
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
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
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { getMetricName } from "./get-metric-name";
import getHorizontalPodAutoscalerMetrics from "./get-metrics.injectable";

import type {
  HorizontalPodAutoscalerMetricSpec,
  HorizontalPodAutoscalerMetricTarget,
  KubeObject,
} from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: HpaDetailPanel Props 인터페이스
 */
export interface HpaDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 HorizontalPodAutoscaler 객체
   */
  hpa: HorizontalPodAutoscaler | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  apiManager: ApiManager;
  logger: Logger;
  hostedCluster: HostedCluster | undefined;
  getDetailsUrl: GetDetailsUrl;
  getMetrics: (hpa: HorizontalPodAutoscaler) => string[];
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * 🎯 목적: HorizontalPodAutoscaler 상세 정보 우측 슬라이드 패널 컴포넌트
 */
class NonInjectedHpaDetailPanel extends Component<HpaDetailPanelProps & Dependencies> {
  /**
   * 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
   */
  @observable private renderHpa: HorizontalPodAutoscaler | undefined;
  private clearTimerRef: ReturnType<typeof setTimeout> | undefined;
  private prevIsOpenRef = true;

  constructor(props: HpaDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
    // 초기값 설정
    this.renderHpa = props.hpa;
  }

  /**
   * 🎯 패널 닫힘 애니메이션 처리 - 데이터 유지
   */
  componentDidUpdate(prevProps: HpaDetailPanelProps & Dependencies) {
    const { isOpen, hpa } = this.props;

    // 새로 선택된 리소스 반영
    if (hpa) {
      this.renderHpa = hpa;
    }

    // 패널 닫힘 애니메이션 처리
    const wasOpen = this.prevIsOpenRef;

    if (!isOpen && wasOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.renderHpa = undefined;
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
    const { hpa, createEditResourceTab } = this.props;
    if (hpa) {
      createEditResourceTab(hpa);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - HPA 삭제 확인 다이얼로그 표시
   */
  handleDelete = () => {
    const { hpa, hostedCluster, deleteService, onClose, openConfirmDialog } = this.props;
    if (!hpa) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(hpa, "delete");
          onClose();
        } catch (error) {
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting horizontal pod autoscaler",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete horizontal pod autoscaler <b>{hpa.getName()}</b>?
        </p>
      ),
    });
  };

  /**
   * 🎯 목적: Target Link 렌더링 (Object 타입 메트릭의 링크)
   */
  private renderTargetLink(target: HorizontalPodAutoscalerMetricTarget | undefined) {
    if (!target) {
      return null;
    }

    const { hpa, apiManager, getDetailsUrl } = this.props;
    const { kind, name } = target;
    const objectUrl = getDetailsUrl(apiManager.lookupApiLink(target, hpa));

    return (
      <>
        on
        <Link to={objectUrl}>{`${kind}/${name}`}</Link>
      </>
    );
  }

  /**
   * 🎯 목적: Metrics 테이블 렌더링
   */
  renderMetrics() {
    const { hpa, getMetrics } = this.props;

    if (!hpa) return null;

    const renderName = (metric: HorizontalPodAutoscalerMetricSpec) => {
      const metricName = getMetricName(metric);

      switch (metric?.type) {
        case "ContainerResource":
        // fallthrough
        case "Resource": {
          const metricSpec = metric.resource ?? metric.containerResource;

          return `Resource ${metricSpec.name} on Pods`;
        }
        case "Pods":
          return `${metricName ?? ""} on Pods`;

        case "Object": {
          return (
            <>
              {metricName} {this.renderTargetLink(metric.object?.describedObject)}
            </>
          );
        }
        case "External":
          return `${metricName ?? ""} on ${JSON.stringify(metric.external.metricSelector ?? metric.external.metric?.selector)}`;
        default:
          return hpa.spec?.targetCPUUtilizationPercentage ? "CPU Utilization percentage" : "unknown";
      }
    };

    return (
      <Table data-testid="hpa-metrics">
        <TableHeader>
          <TableRow>
            <TableHead className="name">Name</TableHead>
            <TableHead className="metrics">Current / Target</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {getMetrics(hpa).map((metrics, index) => (
            <TableRow key={index}>
              <TableCell className="name">{renderName(hpa.getMetrics()[index])}</TableCell>
              <TableCell className="metrics">{metrics}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  render() {
    const { isOpen, onClose, apiManager, getDetailsUrl, logger } = this.props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    const hpa = this.renderHpa;

    if (!hpa) {
      return null;
    }

    if (!(hpa instanceof HorizontalPodAutoscaler)) {
      logger.error("[HpaDetailPanel]: passed object that is not an instanceof HorizontalPodAutoscaler", hpa);
      return null;
    }

    const { scaleTargetRef } = hpa.spec;
    const namespace = hpa.getNs();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={hpa.getName()}
        subtitle={`Namespace: ${namespace}`}
        object={hpa}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={hpa} />

        <Separator className="my-6" />

        {/* HPA 전용 메타데이터 테이블 - shadcn Table 사용 */}
        <Table>
          <TableBody>
            {/* Reference */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Reference</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                {scaleTargetRef && (
                  <Link
                    to={getDetailsUrl(apiManager.lookupApiLink(scaleTargetRef, hpa))}
                    className="text-primary hover:underline"
                  >
                    {scaleTargetRef.kind}/{scaleTargetRef.name}
                  </Link>
                )}
              </TableCell>
            </TableRow>

            {/* Min Pods */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Min Pods</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{hpa.getMinPods()}</span>
              </TableCell>
            </TableRow>

            {/* Max Pods */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Max Pods</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{hpa.getMaxPods()}</span>
              </TableCell>
            </TableRow>

            {/* Replicas */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Replicas</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{hpa.getReplicas()}</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="HpaDetails">
          <KubeObjectConditionsDrawer object={hpa} />

          {(hpa.getMetrics().length !== 0 || hpa.spec?.targetCPUUtilizationPercentage) && (
            <DetailPanelSection title="Metrics">
              <div className="metrics">{this.renderMetrics()}</div>
            </DetailPanelSection>
          )}
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={hpa} />
      </DetailPanel>
    );
  }
}

/**
 * DI 패턴 적용된 HPA Detail Panel
 */
export const HpaDetailPanel = withInjectables<Dependencies, HpaDetailPanelProps>(observer(NonInjectedHpaDetailPanel), {
  getProps: (di, props) => ({
    ...props,
    apiManager: di.inject(apiManagerInjectable),
    getDetailsUrl: di.inject(getDetailsUrlInjectable),
    logger: di.inject(loggerInjectionToken),
    hostedCluster: di.inject(hostedClusterInjectable),
    getMetrics: di.inject(getHorizontalPodAutoscalerMetrics),
    createEditResourceTab: di.inject(createEditResourceTabInjectable),
    deleteService: di.inject(kubeObjectDeleteServiceInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
  }),
});
