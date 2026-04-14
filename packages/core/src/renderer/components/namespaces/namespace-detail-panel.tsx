/**
 * 🎯 목적: Namespace 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - CommonTable 템플릿의 우측 패널 UI 패턴 적용 (fixed inset-y-0 right-0 w-[700px])
 *   - shadcn UI 컴포넌트 (Table, Badge, Button) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-04: 초기 생성 (DrawerItem 구조를 DetailPanel로 마이그레이션)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import "./namespace-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Namespace } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Spinner } from "@skuberplus/spinner";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { cssNames } from "@skuberplus/utilities";
import { computed, makeObservable, observable } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { DetailPanel } from "../common/detail-panel";
import limitRangeStoreInjectable from "../config-limit-ranges/store.injectable";
import resourceQuotaStoreInjectable from "../config-resource-quotas/store.injectable";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { NamespaceMetricsDetailsComponent } from "./metrics-details-component";
import { NamespaceTreeView } from "./namespace-tree-view";
import namespaceStoreInjectable from "./store.injectable";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { LimitRangeStore } from "../config-limit-ranges/store";
import type { ResourceQuotaStore } from "../config-resource-quotas/store";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";
import type { NamespaceStore } from "./store";

export interface NamespaceDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Namespace 객체
   */
  namespace: Namespace | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  subscribeStores: SubscribeStores;
  getDetailsUrl: GetDetailsUrl;
  resourceQuotaStore: ResourceQuotaStore;
  limitRangeStore: LimitRangeStore;
  namespaceStore: NamespaceStore;
  logger: Logger;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
  hostedCluster: Cluster | undefined;
}

/**
 * Namespace 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param namespace - 표시할 Namespace 객체
 * @param onClose - 패널 닫기 콜백
 */
class NonInjectedNamespaceDetailPanel extends Component<NamespaceDetailPanelProps & Dependencies> {
  // ============================================
  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
  // ============================================
  @observable private renderNamespace: Namespace | undefined;
  private clearTimerRef: ReturnType<typeof setTimeout> | undefined;
  private prevIsOpenRef = true;

  constructor(props: NamespaceDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
    this.renderNamespace = props.namespace;
  }

  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.resourceQuotaStore, this.props.limitRangeStore])]);
  }

  componentDidUpdate(prevProps: NamespaceDetailPanelProps & Dependencies) {
    const { isOpen, namespace } = this.props;

    // 새로 선택된 리소스 반영
    if (namespace) {
      this.renderNamespace = namespace;
    }

    // 패널 닫힘 애니메이션 처리
    const wasOpen = this.prevIsOpenRef;

    if (!isOpen && wasOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.renderNamespace = undefined;
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
    const { namespace, createEditResourceTab } = this.props;
    if (namespace) {
      createEditResourceTab(namespace);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - Namespace 삭제
   */
  handleDelete = () => {
    const { namespace, deleteService, onClose, openConfirmDialog, hostedCluster } = this.props;
    if (!namespace) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(namespace, "delete");
          onClose();
        } catch (error) {
          // 🆕 FIX-038: clusterName 메타데이터 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting namespace",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete namespace <b>{namespace.getName()}</b>?
        </p>
      ),
    });
  };

  @computed get quotas() {
    const namespace = this.props.namespace?.getName();

    if (!namespace) return [];

    return this.props.resourceQuotaStore.getAllByNs(namespace);
  }

  @computed get limitranges() {
    const namespace = this.props.namespace?.getName();

    if (!namespace) return [];

    return this.props.limitRangeStore.getAllByNs(namespace);
  }

  render() {
    const { isOpen, onClose, resourceQuotaStore, getDetailsUrl, limitRangeStore, namespaceStore, logger } = this.props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 사용
    const namespace = this.renderNamespace;

    // ⚠️ Namespace 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!namespace) {
      return null;
    }

    if (!(namespace instanceof Namespace)) {
      logger.error("[NamespaceDetailPanel]: passed object that is not an instanceof Namespace", namespace);
      return null;
    }

    const status = namespace.getStatus();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={namespace.getName()}
        subtitle="Cluster Resource"
        object={namespace}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
        metricsComponent={<NamespaceMetricsDetailsComponent object={namespace} />}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={namespace} />

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
                <span className={cssNames("text-sm status", status.toLowerCase())}>{status}</span>
              </TableCell>
            </TableRow>

            {/* Resource Quotas */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Resource Quotas</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <div className="flex flex-wrap gap-2 items-center">
                  {!this.quotas && resourceQuotaStore.isLoading && <Spinner />}
                  {this.quotas.map(
                    (quota) =>
                      quota.selfLink && (
                        <Link
                          key={quota.getId()}
                          to={getDetailsUrl(quota.selfLink)}
                          className="text-primary hover:underline text-sm"
                        >
                          {quota.getName()}
                        </Link>
                      ),
                  )}
                  {this.quotas.length === 0 && !resourceQuotaStore.isLoading && (
                    <span className="text-muted-foreground text-sm">None</span>
                  )}
                </div>
              </TableCell>
            </TableRow>

            {/* Limit Ranges */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Limit Ranges</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <div className="flex flex-wrap gap-2 items-center">
                  {!this.limitranges && limitRangeStore.isLoading && <Spinner />}
                  {this.limitranges.map(
                    (limitrange) =>
                      limitrange.selfLink && (
                        <Link
                          key={limitrange.getId()}
                          to={getDetailsUrl(limitrange.selfLink)}
                          className="text-primary hover:underline text-sm"
                        >
                          {limitrange.getName()}
                        </Link>
                      ),
                  )}
                  {this.limitranges.length === 0 && !limitRangeStore.isLoading && (
                    <span className="text-muted-foreground text-sm">None</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* ============================================ */}
        {/* 📦 추가 섹션 - Namespace Tree (HNC) */}
        {/* ============================================ */}
        {namespace.isControlledByHNC() && (
          <div className="mt-8">
            <span className="text-foreground text-base font-medium">Namespace Tree</span>
            <div className="mt-4">
              <NamespaceTreeView tree={namespaceStore.getNamespaceTree(namespace)} />
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={namespace} />
      </DetailPanel>
    );
  }
}

/**
 * DI 패턴 적용된 Namespace Detail Panel
 */
export const NamespaceDetailPanel = withInjectables<Dependencies, NamespaceDetailPanelProps>(
  observer(NonInjectedNamespaceDetailPanel),
  {
    getProps: (di, props) => ({
      ...props,
      subscribeStores: di.inject(subscribeStoresInjectable),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      limitRangeStore: di.inject(limitRangeStoreInjectable),
      resourceQuotaStore: di.inject(resourceQuotaStoreInjectable),
      namespaceStore: di.inject(namespaceStoreInjectable),
      logger: di.inject(loggerInjectionToken),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
