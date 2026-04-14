/**
 * 🎯 목적: Ingress Class 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - CommonTable 템플릿의 우측 패널 UI 패턴 적용 (fixed inset-y-0 right-0 w-[700px])
 *   - shadcn UI 컴포넌트 (Table, Badge, Button) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - DetailPanelActionsMenu로 Edit, Delete, Set as Default 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-04: 초기 생성 (DrawerItem 구조를 DetailPanel로 마이그레이션)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-11-06: Set as Default 액션 추가
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import "./ingress-class-details.module.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { IngressClass } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { stopPropagation } from "@skuberplus/utilities";
import { makeObservable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import getDetailsUrlInjectable, { type GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { ingressClassSetDefaultInjectable } from "./ingress-class-set-default.injectable";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

export interface IngressClassDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 IngressClass 객체
   */
  ingressClass: IngressClass | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  apiManager: ApiManager;
  getDetailsUrl: GetDetailsUrl;
  logger: Logger;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
  setAsDefault: (ingressClass: IngressClass) => Promise<void>;
  hostedCluster: Cluster | undefined;
}

/**
 * Ingress Class 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param ingressClass - 표시할 IngressClass 객체
 * @param onClose - 패널 닫기 콜백
 */
class NonInjectedIngressClassDetailPanel extends Component<IngressClassDetailPanelProps & Dependencies> {
  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
  private renderIngressClass: IngressClass | undefined = this.props.ingressClass;
  private clearTimerRef?: ReturnType<typeof setTimeout>;
  private prevIsOpen = this.props.isOpen;

  constructor(props: IngressClassDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  componentDidUpdate(prevProps: IngressClassDetailPanelProps & Dependencies) {
    const { isOpen, ingressClass } = this.props;

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    if (ingressClass && ingressClass !== prevProps.ingressClass) {
      this.renderIngressClass = ingressClass;
      this.forceUpdate();
    }

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    if (!isOpen && this.prevIsOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.renderIngressClass = undefined;
        this.forceUpdate();
      }, 320);
    }
    if (isOpen && this.clearTimerRef) {
      clearTimeout(this.clearTimerRef);
      this.clearTimerRef = undefined;
    }
    this.prevIsOpen = isOpen;
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
    const { createEditResourceTab } = this.props;
    if (this.renderIngressClass) {
      createEditResourceTab(this.renderIngressClass);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - IngressClass 삭제
   */
  handleDelete = () => {
    const { deleteService, onClose, openConfirmDialog } = this.props;
    if (!this.renderIngressClass) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(this.renderIngressClass!, "delete");
          onClose();
        } catch (error) {
          // 🆕 FIX-038: clusterName metadata 추가
          const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "network",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting ingress class",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete ingress class <b>{this.renderIngressClass.getName()}</b>?
        </p>
      ),
    });
  };

  /**
   * 🎯 액션 핸들러: Set as Default 액션 - IngressClass를 기본값으로 설정
   */
  handleSetAsDefault = async () => {
    const { setAsDefault, logger } = this.props;
    if (!this.renderIngressClass) return;

    try {
      await setAsDefault(this.renderIngressClass);
    } catch (error) {
      logger.error("[IngressClassDetailPanel] Set as Default failed:", error);
    }
  };

  render() {
    const { isOpen, onClose, apiManager, getDetailsUrl, logger } = this.props;

    // ⚠️ IngressClass 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!this.renderIngressClass) {
      return null;
    }

    if (!(this.renderIngressClass instanceof IngressClass)) {
      logger.error(
        "[IngressClassDetailPanel]: passed object that is not an instanceof IngressClass",
        this.renderIngressClass,
      );
      return null;
    }

    const controller = this.renderIngressClass.getController();
    const hasParameters = !!this.renderIngressClass.spec.parameters;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={this.renderIngressClass.getName()}
        subtitle="Network Resource"
        object={this.renderIngressClass}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
        onSetDefault={this.handleSetAsDefault}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={this.renderIngressClass} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 속성 테이블 - shadcn Table 컴포넌트 사용 */}
        {/* ============================================ */}
        <Table>
          <TableBody>
            {/* Controller */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Controller</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <Badge variant="outline">{controller}</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* ============================================ */}
        {/* 📦 Parameters 섹션 (선택적) */}
        {/* ============================================ */}
        {hasParameters && (
          <div className="mt-8">
            <span className="text-foreground text-base font-medium">Parameters</span>
            <div className="mt-4">
              <Table>
                <TableBody>
                  {/* Parameter Name */}
                  <TableRow>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">Name</span>
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      {(() => {
                        const url =
                          this.renderIngressClass!.spec.parameters &&
                          getDetailsUrl(apiManager.lookupApiLink(this.renderIngressClass!.spec.parameters));

                        return url ? (
                          <Link to={url} onClick={stopPropagation} className="text-primary hover:underline text-sm">
                            {this.renderIngressClass!.getCtrlName()}
                          </Link>
                        ) : (
                          <span className="text-foreground text-sm">{this.renderIngressClass!.getCtrlName()}</span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>

                  {/* Namespace (조건부 표시) */}
                  {this.renderIngressClass.getCtrlNs() && (
                    <TableRow>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        <span className="text-foreground text-sm">Namespace</span>
                      </TableCell>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        <span className="text-foreground text-sm">{this.renderIngressClass.getCtrlNs()}</span>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Scope */}
                  <TableRow>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">Scope</span>
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">{this.renderIngressClass.getCtrlScope()}</span>
                    </TableCell>
                  </TableRow>

                  {/* Kind */}
                  <TableRow>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">Kind</span>
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">{this.renderIngressClass.getCtrlKind()}</span>
                    </TableCell>
                  </TableRow>

                  {/* API Group */}
                  <TableRow>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">API Group</span>
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">{this.renderIngressClass.getCtrlApiGroup()}</span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={this.renderIngressClass} />
      </DetailPanel>
    );
  }
}

/**
 * DI 패턴 적용된 Ingress Class Detail Panel
 */
export const IngressClassDetailPanel = withInjectables<Dependencies, IngressClassDetailPanelProps>(
  observer(NonInjectedIngressClassDetailPanel),
  {
    getProps: (di, props) => ({
      ...props,
      apiManager: di.inject(apiManagerInjectable),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      logger: di.inject(loggerInjectionToken),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      setAsDefault: di.inject(ingressClassSetDefaultInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
