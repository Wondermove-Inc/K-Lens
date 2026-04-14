/**
 * 🎯 목적: StatefulSet 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - CommonTable 템플릿의 우측 패널 UI 패턴 적용 (fixed inset-y-0 right-0 w-[700px])
 *   - shadcn UI 컴포넌트 (Table, Badge, Button) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - DetailPanelActionsMenu로 Edit, Delete, Restart, Scale 액션 제공
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod Detail Panel 패턴 적용)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-11-06: Restart, Scale 액션 추가
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import "./statefulset-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { statefulSetApiInjectable } from "@skuberplus/kube-api-specifics";
import { StatefulSet } from "@skuberplus/kube-object";
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
import { StatefulSetMetricsDetailsComponent } from "./metrics-details-component";
import openStatefulSetScaleDialogInjectable from "./scale/open-dialog.injectable";
import statefulSetStoreInjectable from "./store.injectable";

import type { StatefulSetApi } from "@skuberplus/kube-api";
import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";
import type { OpenStatefulSetScaleDialog } from "./scale/open-dialog.injectable";
import type { StatefulSetStore } from "./store";

export interface StatefulSetDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 StatefulSet 객체
   */
  statefulSet: StatefulSet | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  hostedCluster: HostedCluster | undefined;
  statefulSetStore: StatefulSetStore;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  statefulSetApi: StatefulSetApi;
  openStatefulSetScaleDialog: OpenStatefulSetScaleDialog;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * StatefulSet 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param statefulSet - 표시할 StatefulSet 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedStatefulSetDetailPanel = observer((props: StatefulSetDetailPanelProps & Dependencies) => {
  const {
    isOpen,
    statefulSet,
    onClose,
    logger,
    hostedCluster,
    statefulSetStore,
    createEditResourceTab,
    deleteService,
    statefulSetApi,
    openStatefulSetScaleDialog,
    openConfirmDialog,
  } = props;

  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
  const [renderStatefulSet, setRenderStatefulSet] = React.useState<StatefulSet | undefined>(statefulSet);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const prevIsOpenRef = React.useRef(isOpen);

  // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
  React.useEffect(() => {
    if (statefulSet) {
      setRenderStatefulSet(statefulSet);
    }
  }, [statefulSet]);

  // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
  React.useEffect(() => {
    const wasOpen = prevIsOpenRef.current;

    // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
    if (!isOpen && wasOpen) {
      clearTimerRef.current = setTimeout(() => {
        setRenderStatefulSet(undefined);
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

  // ⚠️ StatefulSet 객체가 없거나 유효하지 않으면 렌더링하지 않음
  if (!renderStatefulSet) {
    return null;
  }

  if (!(renderStatefulSet instanceof StatefulSet)) {
    logger.error("[StatefulSetDetailPanel]: passed object that is not an instanceof StatefulSet", renderStatefulSet);
    return null;
  }

  // 🎯 StatefulSet 속성 데이터 추출
  const images = renderStatefulSet.getImages();
  const selectors = renderStatefulSet.getSelectors();
  const nodeSelector = renderStatefulSet.getNodeSelectors();
  const childPods = statefulSetStore.getChildPods(renderStatefulSet);
  const namespace = renderStatefulSet.getNs();
  const replicas = renderStatefulSet.getReplicas();
  const readyReplicas = renderStatefulSet.status?.readyReplicas || 0;
  const currentReplicas = renderStatefulSet.status?.currentReplicas || 0;
  const observedGeneration = renderStatefulSet.status?.observedGeneration;
  const currentRevision = renderStatefulSet.status?.currentRevision;
  const updateRevision = renderStatefulSet.status?.updateRevision;

  // ============================================
  // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
  // ============================================

  /**
   * Edit 액션: YAML 편집 탭 열기
   */
  const handleEdit = () => createEditResourceTab(renderStatefulSet);

  /**
   * Delete 액션: StatefulSet 삭제
   */
  const handleDelete = () => {
    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(renderStatefulSet, "delete");
          onClose();
        } catch (error) {
          logger.error("[StatefulSetDetailPanel] Delete failed:", error);
          // 🆕 FIX-038: clusterName 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting statefulset",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete StatefulSet <b>{renderStatefulSet.getName()}</b>?
        </p>
      ),
    });
  };

  /**
   * Restart 액션: StatefulSet 재시작 (Confirm Dialog → API 호출)
   */
  const handleRestart = () => {
    openConfirmDialog({
      ok: async () => {
        try {
          await statefulSetApi.restart({
            namespace: renderStatefulSet.getNs(),
            name: renderStatefulSet.getName(),
          });
        } catch (err) {
          // 🆕 FIX-038: clusterName 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            err instanceof Error ? err.message : "Unknown error occurred while restarting StatefulSet",
            { clusterName },
          );
        }
      },
      labelOk: "Restart",
      message: (
        <p>
          Are you sure you want to restart StatefulSet <b>{renderStatefulSet.getName()}</b>?
        </p>
      ),
    });
  };

  /**
   * Scale 액션: Scale Dialog 열기
   */
  const handleScale = () => {
    openStatefulSetScaleDialog(renderStatefulSet);
  };

  return (
    <DetailPanel
      isOpen={isOpen}
      onClose={onClose}
      title={renderStatefulSet.getName()}
      subtitle={`Namespace: ${namespace}`}
      metricsComponent={<StatefulSetMetricsDetailsComponent object={renderStatefulSet} />}
      object={renderStatefulSet}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onRestart={handleRestart}
      onScale={handleScale}
    >
      {/* ============================================ */}
      {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
      {/* ============================================ */}
      <KubeObjectMetaSection object={renderStatefulSet} />

      <Separator className="my-6" />

      {/* ============================================ */}
      {/* 📋 속성 테이블 - shadcn Table 컴포넌트 사용 */}
      {/* ============================================ */}
      <Table>
        <TableBody>
          {/* Replicas */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Replicas</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">{replicas}</span>
            </TableCell>
          </TableRow>

          {/* Ready Replicas */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Ready Replicas</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">{readyReplicas}</span>
            </TableCell>
          </TableRow>

          {/* Current Replicas */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Current Replicas</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">{currentReplicas}</span>
            </TableCell>
          </TableRow>

          {/* Observed Generation */}
          {observedGeneration !== undefined && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Observed Generation</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{observedGeneration}</span>
              </TableCell>
            </TableRow>
          )}

          {/* Current Revision */}
          {currentRevision && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Current Revision</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{currentRevision}</span>
              </TableCell>
            </TableRow>
          )}

          {/* Update Revision */}
          {updateRevision && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Update Revision</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{updateRevision}</span>
              </TableCell>
            </TableRow>
          )}

          {/* Selectors */}
          {selectors.length > 0 && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Selector</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <div className="flex flex-wrap gap-1">
                  {selectors.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* Node Selector */}
          {nodeSelector.length > 0 && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Node Selector</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <div className="flex flex-wrap gap-1">
                  {nodeSelector.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* Images */}
          {images.length > 0 && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Images</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <div className="flex flex-col gap-1">
                  {images.map((image) => (
                    <span key={image} className="text-foreground text-sm">
                      {image}
                    </span>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* ============================================ */}
      {/* 📦 추가 섹션 - 기존 컴포넌트 재사용 */}
      {/* ============================================ */}

      {/* Tolerations */}
      <div className="mt-8">
        <PodDetailsTolerations workload={renderStatefulSet} />
      </div>

      {/* Affinities */}
      <div className="mt-8">
        <PodDetailsAffinities workload={renderStatefulSet} />
      </div>

      {/* Pod Status */}
      <div className="mt-8">
        <span className="text-foreground text-base font-medium">Pod Status</span>
        <div className="mt-4">
          <PodDetailsStatuses pods={childPods} />
        </div>
      </div>

      {/* Pod List */}
      <div className="mt-8">
        <PodDetailsList pods={childPods} owner={renderStatefulSet} />
      </div>

      {/* ============================================ */}
      {/* 📋 Events 섹션 */}
      {/* ============================================ */}
      <KubeEventDetailsSection object={renderStatefulSet} />
    </DetailPanel>
  );
});

/**
 * DI 패턴 적용된 StatefulSet Detail Panel
 */
export const StatefulSetDetailPanel = withInjectables<Dependencies, StatefulSetDetailPanelProps>(
  NonInjectedStatefulSetDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      hostedCluster: di.inject(hostedClusterInjectable),
      statefulSetStore: di.inject(statefulSetStoreInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      statefulSetApi: di.inject(statefulSetApiInjectable),
      openStatefulSetScaleDialog: di.inject(openStatefulSetScaleDialogInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
    }),
  },
);
