/**
 * 🎯 목적: ReplicationController 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - 공통 DetailPanel 컴포넌트 사용 (packages/storybook-shadcn/src/components/ui/detail-panel.tsx)
 *   - shadcn UI 컴포넌트 (Table, Badge, Slider) 사용
 *   - ReplicationController 전용 기능: Scale 슬라이더, Spec/Status 섹션
 * 🔄 변경이력:
 *   - 2025-11-11: 초기 생성 (Deployment Detail Panel 패턴 기반)
 *   - 2025-11-11: 원래 SkuberPlus 기능 복원 (Scale 슬라이더, Spec/Status 섹션)
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { replicationControllerApiInjectable } from "@skuberplus/kube-api-specifics";
import { ReplicationController } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { Slider } from "@skuberplus/storybook-shadcn/src/components/ui/slider";
import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { ReplicationControllerApi } from "@skuberplus/kube-api";
import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

export interface ReplicationControllerDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 ReplicationController 객체
   */
  replicationController: ReplicationController | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  api: ReplicationControllerApi;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
  hostedCluster: Cluster | undefined;
}

/**
 * ReplicationController 상세 정보 우측 슬라이드 패널 컴포넌트 (Class Component - MobX observable 사용)
 *
 * @remarks
 * - Class Component 사용: MobX observable 상태 관리를 위해
 * - Scale 슬라이더 값 변경 시 Kubernetes API 호출
 * - 원래 SkuberPlus 구현 기능 복원 (replication-controller-details.tsx 참조)
 */
class NonInjectedReplicationControllerDetailPanel extends Component<
  ReplicationControllerDetailPanelProps & Dependencies
> {
  @observable sliderReplicasValue = 0;
  @observable sliderReplicasDisabled = false;

  state = {
    renderReplicationController: this.props.replicationController as ReplicationController | undefined,
  };

  private clearTimer?: ReturnType<typeof setTimeout>;

  constructor(props: ReplicationControllerDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);

    // 초기 슬라이더 값 설정
    if (props.replicationController) {
      this.sliderReplicasValue = props.replicationController.getDesiredReplicas();
    }
  }

  /**
   * 🎯 목적: Props 업데이트 시 슬라이더 값 동기화 및 닫힘 애니메이션 관리
   */
  componentDidUpdate(prevProps: ReplicationControllerDetailPanelProps & Dependencies) {
    const { replicationController, isOpen } = this.props;

    // 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    if (replicationController && replicationController !== prevProps.replicationController) {
      this.setState({ renderReplicationController: replicationController });
      this.sliderReplicasValue = replicationController.getDesiredReplicas();
    }

    // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
    if (!isOpen && prevProps.isOpen) {
      this.clearTimer = setTimeout(() => {
        this.setState({ renderReplicationController: undefined });
      }, 320);
    }

    // 다시 열리면 정리 타이머 취소
    if (isOpen && this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = undefined;
    }
  }

  /**
   * 🎯 목적: 컴포넌트 언마운트 시 타이머 정리
   */
  componentWillUnmount() {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
    }
  }

  /**
   * 🎯 목적: Replicas Scale API 호출
   *
   * @param replicas - 새로운 Replicas 수
   */
  @action
  async scale(replicas: number) {
    const { replicationController: resource, api, hostedCluster } = this.props;
    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

    if (!resource) return;

    try {
      await api.scale(
        {
          name: resource.getName(),
          namespace: resource.getNs(),
        },
        replicas,
      );
    } catch (error) {
      this.sliderReplicasValue = resource.getDesiredReplicas(); // rollback to last valid value
      notificationPanelStore.addError("operations", "Error", error instanceof Error ? error.message : String(error), {
        clusterName,
      });
    }
  }

  /**
   * 🎯 목적: 슬라이더 값 변경 완료 시 호출 (마우스 놓았을 때)
   *
   * @param value - 새로운 Replicas 수
   */
  @action
  async onScaleSliderChangeCommitted(value: number[]) {
    this.sliderReplicasDisabled = true;
    await this.scale(value[0]);
    this.sliderReplicasDisabled = false;
  }

  /**
   * 🎯 목적: Edit 액션 핸들러 - YAML 편집 탭 열기
   */
  handleEdit = () => {
    const { createEditResourceTab } = this.props;
    const { renderReplicationController } = this.state;
    if (renderReplicationController) {
      createEditResourceTab(renderReplicationController);
    }
  };

  /**
   * 🎯 목적: Delete 액션 핸들러 - ReplicationController 삭제
   */
  handleDelete = () => {
    const { deleteService, onClose, openConfirmDialog, hostedCluster } = this.props;
    const { renderReplicationController } = this.state;
    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
    if (!renderReplicationController) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(renderReplicationController, "delete");
          onClose();
        } catch (error) {
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting replication controller",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete replication controller <b>{renderReplicationController.getName()}</b>?
        </p>
      ),
    });
  };

  render() {
    const { isOpen, onClose, logger } = this.props;
    const { renderReplicationController } = this.state;

    // ⚠️ ReplicationController 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!renderReplicationController) {
      return null;
    }

    if (!(renderReplicationController instanceof ReplicationController)) {
      logger.error(
        "[ReplicationControllerDetailPanel]: passed object that is not an instanceof ReplicationController",
        renderReplicationController,
      );
      return null;
    }

    // 🎯 ReplicationController 속성 데이터 추출
    const namespace = renderReplicationController.getNs();
    const desiredReplicas = renderReplicationController.getDesiredReplicas();
    const currentReplicas = renderReplicationController.getReplicas() || 0;
    const availableReplicas = renderReplicationController.getAvailableReplicas() || 0;
    const labeledReplicas = renderReplicationController.getLabeledReplicas() || 0;
    const observedGeneration = renderReplicationController.getGeneration() || 0;
    const minReadySeconds = renderReplicationController.getMinReadySeconds();

    // Selector 정보
    const selectors = renderReplicationController.getSelectorLabels();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderReplicationController.getName()}
        subtitle={`Namespace: ${namespace}`}
        object={renderReplicationController}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderReplicationController} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Spec 섹션 - Replicas Scale 슬라이더 */}
        {/* ============================================ */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Spec</h3>

          {/* Replicas & Scale Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Replicas</span>
              <span className="text-sm font-medium">{desiredReplicas}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Scale</span>
                <span className="text-xs text-muted-foreground">{this.sliderReplicasValue}</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[this.sliderReplicasValue]}
                onValueChange={(value: number[]) => (this.sliderReplicasValue = value[0])}
                onValueCommit={(value: number[]) => this.onScaleSliderChangeCommitted(value)}
                disabled={this.sliderReplicasDisabled}
                className="w-full"
              />
            </div>
          </div>

          {/* Selectors */}
          {selectors.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Selectors</span>
              <div className="flex flex-wrap gap-1">
                {selectors.map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📊 Status 섹션 - Replicas 상태 정보 */}
        {/* ============================================ */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Status</h3>

          <Table>
            <TableBody>
              {/* Replicas */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Replicas</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{currentReplicas}</span>
                </TableCell>
              </TableRow>

              {/* Available Replicas */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Available Replicas</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{availableReplicas}</span>
                </TableCell>
              </TableRow>

              {/* Labeled Replicas */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Labeled Replicas</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{labeledReplicas}</span>
                </TableCell>
              </TableRow>

              {/* Controller Generation */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Controller Generation</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{observedGeneration}</span>
                </TableCell>
              </TableRow>

              {/* Minimum Pod Readiness */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Minimum Pod Readiness</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{minReadySeconds} seconds</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* ============================================ */}
        {/* 📦 추가 섹션 - Conditions */}
        {/* ============================================ */}

        {/* Conditions */}
        <div className="mt-8">
          <KubeObjectConditionsDrawer object={renderReplicationController} />
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderReplicationController} />
      </DetailPanel>
    );
  }
}

/**
 * DI 패턴 적용된 ReplicationController Detail Panel
 */
export const ReplicationControllerDetailPanel = withInjectables<Dependencies, ReplicationControllerDetailPanelProps>(
  observer(NonInjectedReplicationControllerDetailPanel),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      api: di.inject(replicationControllerApiInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
