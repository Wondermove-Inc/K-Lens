/**
 * 🎯 목적: ReplicaSet 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - CommonTable 템플릿의 우측 패널 UI 패턴 적용 (fixed inset-y-0 right-0 w-[700px])
 *   - shadcn UI 컴포넌트 (Table, Badge, Button) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - DetailPanelActionsMenu로 Edit, Delete, Scale 액션 제공
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Deployment/StatefulSet 패턴 참조, shadcn 마이그레이션)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-11-06: Scale 액션 추가
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import "./replicaset-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { ReplicaSet } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { observer } from "mobx-react";
import React from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { PodDetailsAffinities } from "../workloads-pods/pod-details-affinities";
import { PodDetailsList } from "../workloads-pods/pod-details-list";
import { PodDetailsStatuses } from "../workloads-pods/pod-details-statuses";
import { PodDetailsTolerations } from "../workloads-pods/pod-details-tolerations";
import { ReplicaSetMetricsDetailsComponent } from "./metrics-details-component";
import openReplicaSetScaleDialogInjectable from "./scale-dialog/open.injectable";
import replicaSetStoreInjectable from "./store.injectable";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";
import type { OpenReplicaSetScaleDialog } from "./scale-dialog/open.injectable";
import type { ReplicaSetStore } from "./store";

export interface ReplicaSetDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 ReplicaSet 객체
   */
  replicaSet: ReplicaSet | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  hostedCluster: HostedCluster | undefined;
  replicaSetStore: ReplicaSetStore;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openReplicaSetScaleDialog: OpenReplicaSetScaleDialog;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * ReplicaSet 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param replicaSet - 표시할 ReplicaSet 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedReplicaSetDetailPanel = observer(
  ({
    isOpen,
    replicaSet,
    onClose,
    logger,
    hostedCluster,
    replicaSetStore,
    createEditResourceTab,
    deleteService,
    openReplicaSetScaleDialog,
    openConfirmDialog,
  }: ReplicaSetDetailPanelProps & Dependencies) => {
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
    const [renderReplicaSet, setRenderReplicaSet] = React.useState<ReplicaSet | undefined>(replicaSet);
    const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const prevIsOpenRef = React.useRef(isOpen);

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    React.useEffect(() => {
      if (replicaSet) {
        setRenderReplicaSet(replicaSet);
      }
    }, [replicaSet]);

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    React.useEffect(() => {
      const wasOpen = prevIsOpenRef.current;

      // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderReplicaSet(undefined);
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

    // ⚠️ ReplicaSet 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!renderReplicaSet) {
      return null;
    }

    if (!(renderReplicaSet instanceof ReplicaSet)) {
      logger.error("[ReplicaSetDetailPanel]: passed object that is not an instanceof ReplicaSet", renderReplicaSet);
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(renderReplicaSet);
    };

    /**
     * Delete 액션: ReplicaSet 삭제 (Confirm Dialog → API 호출)
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(renderReplicaSet, "delete");
            onClose();
          } catch (error) {
            logger.error("[ReplicaSetDetailPanel] Delete failed:", error);
            // 🆕 FIX-038: clusterName 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting replicaset",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete replicaset <b>{renderReplicaSet.getName()}</b>?
          </p>
        ),
      });
    };

    /**
     * Scale 액션: Scale Dialog 열기
     */
    const handleScale = () => {
      openReplicaSetScaleDialog(renderReplicaSet);
    };

    // 🎯 ReplicaSet 속성 데이터 추출
    const { status } = renderReplicaSet;
    const availableReplicas = status?.availableReplicas ?? 0;
    const replicas = status?.replicas ?? 0;
    const desired = renderReplicaSet.getDesired();
    const current = renderReplicaSet.getCurrent();
    const ready = renderReplicaSet.getReady();
    const selectors = renderReplicaSet.getSelectors();
    const nodeSelectors = renderReplicaSet.getNodeSelectors();
    const images = renderReplicaSet.getImages();
    const childPods = replicaSetStore.getChildPods(renderReplicaSet);
    const namespace = renderReplicaSet.getNs();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderReplicaSet.getName()}
        subtitle={`Namespace: ${namespace}`}
        metricsComponent={<ReplicaSetMetricsDetailsComponent object={renderReplicaSet} />}
        object={renderReplicaSet}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onScale={handleScale}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderReplicaSet} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Replicas 상태 테이블 */}
        {/* ============================================ */}
        <Table>
          <TableBody>
            {/* Desired */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Desired</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{desired}</span>
              </TableCell>
            </TableRow>

            {/* Current */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Current</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{current}</span>
              </TableCell>
            </TableRow>

            {/* Ready */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Ready</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{ready}</span>
              </TableCell>
            </TableRow>

            {/* Available */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Available</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{availableReplicas}</span>
              </TableCell>
            </TableRow>

            {/* Total */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Total</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{replicas}</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* ============================================ */}
        {/* 🏷️ Selectors 섹션 */}
        {/* ============================================ */}
        {selectors.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Selectors</h3>
            <div className="flex flex-wrap gap-2">
              {selectors.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* 🏷️ Node Selectors 섹션 */}
        {/* ============================================ */}
        {nodeSelectors.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Node Selectors</h3>
            <div className="flex flex-wrap gap-2">
              {nodeSelectors.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* 🖼️ Images 섹션 */}
        {/* ============================================ */}
        {images.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Images</h3>
            <div className="flex flex-col gap-1">
              {images.map((image) => (
                <span key={image} className="text-sm text-foreground">
                  {image}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* 📦 Pod Tolerations & Affinities 섹션 */}
        {/* ============================================ */}
        <div className="space-y-4">
          <PodDetailsTolerations workload={renderReplicaSet} />
          <PodDetailsAffinities workload={renderReplicaSet} />
        </div>

        {/* ============================================ */}
        {/* 📊 Pod Status 섹션 */}
        {/* ============================================ */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Pod Status</h3>
          <PodDetailsStatuses pods={childPods} />
        </div>

        {/* ============================================ */}
        {/* 📋 Pod List 섹션 */}
        {/* ============================================ */}
        <div className="space-y-2">
          <PodDetailsList pods={childPods} owner={renderReplicaSet} />
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderReplicaSet} />
      </DetailPanel>
    );
  },
);

/**
 * DI 패턴 적용된 ReplicaSet Detail Panel
 */
export const ReplicaSetDetailPanel = withInjectables<Dependencies, ReplicaSetDetailPanelProps>(
  NonInjectedReplicaSetDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      hostedCluster: di.inject(hostedClusterInjectable),
      replicaSetStore: di.inject(replicaSetStoreInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openReplicaSetScaleDialog: di.inject(openReplicaSetScaleDialogInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
    }),
  },
);
