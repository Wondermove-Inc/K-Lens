/**
 * 🎯 목적: DaemonSet 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - CommonTable 템플릿의 우측 패널 UI 패턴 적용 (fixed inset-y-0 right-0 w-[700px])
 *   - shadcn UI 컴포넌트 (Table, Badge, Button) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - DetailPanelActionsMenu로 Edit, Delete, Restart 액션 제공
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (StatefulSet/ReplicaSet 패턴 참조, shadcn 마이그레이션)
 *   - 2025-10-31: 구버전 daemonset-details.tsx 제거, shadcn 완전 마이그레이션 완료
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-11-06: Restart 액션 추가
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { daemonSetApiInjectable } from "@skuberplus/kube-api-specifics";
import { DaemonSet } from "@skuberplus/kube-object";
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
import { DaemonSetMetricsDetailsComponent } from "./metrics-details-component";
import daemonSetStoreInjectable from "./store.injectable";

import type { DaemonSetApi } from "@skuberplus/kube-api";
import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";
import type { DaemonSetStore } from "./store";

export interface DaemonSetDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 DaemonSet 객체
   */
  daemonSet: DaemonSet | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  hostedCluster: HostedCluster | undefined;
  daemonSetStore: DaemonSetStore;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  daemonSetApi: DaemonSetApi;
  openConfirmDialog: OpenConfirmDialog;
}

type Props = DaemonSetDetailPanelProps & Dependencies;

/**
 * 🎯 목적: DaemonSet 상세 정보 패널 (우측 슬라이드)
 *
 * @param props - DaemonSetDetailPanelProps & Dependencies
 * @returns 우측 슬라이드 패널 컴포넌트
 */
const NonInjectedDaemonSetDetailPanel = observer(
  ({
    isOpen,
    daemonSet,
    onClose,
    logger,
    hostedCluster,
    daemonSetStore,
    createEditResourceTab,
    deleteService,
    daemonSetApi,
    openConfirmDialog,
  }: Props) => {
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
    const [renderDaemonSet, setRenderDaemonSet] = React.useState<DaemonSet | undefined>(daemonSet);
    const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const prevIsOpenRef = React.useRef(isOpen);

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    React.useEffect(() => {
      if (daemonSet) {
        setRenderDaemonSet(daemonSet);
      }
    }, [daemonSet]);

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    React.useEffect(() => {
      const wasOpen = prevIsOpenRef.current;

      // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderDaemonSet(undefined);
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

    // ⚠️ DaemonSet 객체가 없으면 렌더링하지 않음
    if (!renderDaemonSet) {
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(renderDaemonSet);
    };

    /**
     * Delete 액션: DaemonSet 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(renderDaemonSet, "delete");
            onClose();
          } catch (error) {
            logger.error("[DaemonSetDetailPanel] Delete failed:", error);
            // 🆕 FIX-038: clusterName 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting daemonset",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete DaemonSet <b>{renderDaemonSet.getName()}</b>?
          </p>
        ),
      });
    };

    /**
     * Restart 액션: DaemonSet 재시작 (Confirm Dialog → API 호출)
     */
    const handleRestart = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await daemonSetApi.restart({
              namespace: renderDaemonSet.getNs(),
              name: renderDaemonSet.getName(),
            });
          } catch (err) {
            // 🆕 FIX-038: clusterName 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              err instanceof Error ? err.message : "Unknown error occurred while restarting DaemonSet",
              { clusterName },
            );
          }
        },
        labelOk: "Restart",
        message: (
          <p>
            Are you sure you want to restart DaemonSet <b>{renderDaemonSet.getName()}</b>?
          </p>
        ),
      });
    };

    // 🎯 DaemonSet 정보 추출
    const { spec, status } = renderDaemonSet;
    const desired = status?.desiredNumberScheduled ?? 0;
    const current = status?.currentNumberScheduled ?? 0;
    const ready = status?.numberReady ?? 0;
    const available = status?.numberAvailable ?? 0;
    const selectors = renderDaemonSet.getSelectors();
    const nodeSelectors = renderDaemonSet.getNodeSelectors();
    const images = renderDaemonSet.getImages();
    const childPods = daemonSetStore.getChildPods(renderDaemonSet);
    const strategyType = spec?.updateStrategy?.type || "RollingUpdate";

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderDaemonSet.getName()}
        subtitle={`Namespace: ${renderDaemonSet.getNs()}`}
        metricsComponent={<DaemonSetMetricsDetailsComponent object={renderDaemonSet} />}
        object={renderDaemonSet}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRestart={handleRestart}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderDaemonSet} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 🎯 DaemonSet Status (Desired, Current, Ready, Available) */}
        {/* ============================================ */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Status</h3>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium w-1/3">Desired</TableCell>
                <TableCell>{desired}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Current</TableCell>
                <TableCell>{current}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Ready</TableCell>
                <TableCell>{ready}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Available</TableCell>
                <TableCell>{available}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* ============================================ */}
        {/* 🎯 Update Strategy */}
        {/* ============================================ */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Update Strategy</h3>
          <div className="rounded-md border p-3">
            <Badge variant="secondary">{strategyType}</Badge>
          </div>
        </div>

        {/* ============================================ */}
        {/* 🎯 Selectors */}
        {/* ============================================ */}
        {selectors.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Selectors</h3>
            <div className="flex flex-wrap gap-2">
              {selectors.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* 🎯 Node Selectors */}
        {/* ============================================ */}
        {nodeSelectors.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Node Selectors</h3>
            <div className="flex flex-wrap gap-2">
              {nodeSelectors.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* 🎯 Images */}
        {/* ============================================ */}
        {images.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Images</h3>
            <div className="space-y-1">
              {images.map((image) => (
                <div key={image} className="rounded-md border p-2 text-sm font-mono">
                  {image}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* 🎯 Pod Tolerations */}
        {/* ============================================ */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Pod Tolerations</h3>
          <PodDetailsTolerations workload={renderDaemonSet} />
        </div>

        {/* ============================================ */}
        {/* 🎯 Pod Affinities */}
        {/* ============================================ */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Pod Affinities</h3>
          <PodDetailsAffinities workload={renderDaemonSet} />
        </div>

        {/* ============================================ */}
        {/* 🎯 Pod Status */}
        {/* ============================================ */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Pod Status</h3>
          <PodDetailsStatuses pods={childPods} />
        </div>

        {/* ============================================ */}
        {/* 🎯 Pod List */}
        {/* ============================================ */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Pods</h3>
          <PodDetailsList pods={childPods} owner={renderDaemonSet} />
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderDaemonSet} />
      </DetailPanel>
    );
  },
);

/**
 * 🎯 목적: DaemonSetDetailPanel 컴포넌트 (Injectable DI 적용)
 */
export const DaemonSetDetailPanel = withInjectables<Dependencies, DaemonSetDetailPanelProps>(
  NonInjectedDaemonSetDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      hostedCluster: di.inject(hostedClusterInjectable),
      daemonSetStore: di.inject(daemonSetStoreInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      daemonSetApi: di.inject(daemonSetApiInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
    }),
  },
);
