/**
 * 🎯 목적: Deployment 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - 공통 DetailPanel 컴포넌트 사용 (packages/storybook-shadcn/src/components/ui/detail-panel.tsx)
 *   - shadcn UI 컴포넌트 (Table, Badge) 사용
 *   - Deployment 전용 정보: Replicas 상태, Strategy, Selectors
 *   - DetailPanelActionsMenu로 Edit, Delete, Restart, Scale 액션 제공
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod Detail Panel 패턴 기반)
 *   - 2025-11-04: 공통 DetailPanel 컴포넌트로 리팩토링 (235줄 감소)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-11-06: Restart, Scale 액션 추가
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { deploymentApiInjectable } from "@skuberplus/kube-api-specifics";
import { Deployment } from "@skuberplus/kube-object";
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
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { DeploymentMetricsDetailsComponent } from "./metrics-details-component";
import openDeploymentScaleDialogInjectable from "./scale/open.injectable";

import type { DeploymentApi } from "@skuberplus/kube-api";
import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";
import type { OpenDeploymentScaleDialog } from "./scale/open.injectable";

export interface DeploymentDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Deployment 객체
   */
  deployment: Deployment | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  hostedCluster: HostedCluster | undefined;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  deploymentApi: DeploymentApi;
  openDeploymentScaleDialog: OpenDeploymentScaleDialog;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * Deployment 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param deployment - 표시할 Deployment 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedDeploymentDetailPanel = observer((props: DeploymentDetailPanelProps & Dependencies) => {
  const {
    isOpen,
    deployment,
    onClose,
    logger,
    hostedCluster,
    createEditResourceTab,
    deleteService,
    deploymentApi,
    openDeploymentScaleDialog,
    openConfirmDialog,
  } = props;

  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
  const [renderDeployment, setRenderDeployment] = React.useState<Deployment | undefined>(deployment);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const prevIsOpenRef = React.useRef(isOpen);

  // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
  React.useEffect(() => {
    if (deployment) {
      setRenderDeployment(deployment);
    }
  }, [deployment]);

  // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
  React.useEffect(() => {
    const wasOpen = prevIsOpenRef.current;

    // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
    if (!isOpen && wasOpen) {
      clearTimerRef.current = setTimeout(() => {
        setRenderDeployment(undefined);
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

  // ⚠️ 렌더 대상 Deployment가 없으면 렌더링하지 않음
  if (!renderDeployment) {
    return null;
  }

  if (deployment && !(deployment instanceof Deployment)) {
    logger.error("[DeploymentDetailPanel]: passed object that is not an instanceof Deployment", deployment);
    return null;
  }

  // 🎯 Deployment 속성 데이터 추출
  const { status, spec } = renderDeployment;
  const namespace = renderDeployment.getNs();
  const replicas = renderDeployment.getReplicas();
  const readyReplicas = status?.readyReplicas || 0;
  const updatedReplicas = status?.updatedReplicas || 0;
  const availableReplicas = status?.availableReplicas || 0;
  const unavailableReplicas = status?.unavailableReplicas || 0;
  const observedGeneration = status?.observedGeneration || 0;

  // Strategy 정보
  const strategyType = spec.strategy?.type || "RollingUpdate";
  const maxSurge = spec.strategy?.rollingUpdate?.maxSurge || 0;
  const maxUnavailable = spec.strategy?.rollingUpdate?.maxUnavailable || 0;

  // Selector 및 Label 정보
  const selectors = renderDeployment.getSelectors();
  const templateLabels = renderDeployment.getTemplateLabels();

  // ============================================
  // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
  // ============================================

  /**
   * Edit 액션: YAML 편집 탭 열기
   */
  const handleEdit = () => {
    createEditResourceTab(renderDeployment);
  };

  /**
   * Delete 액션: Deployment 삭제 (Confirm Dialog → API 호출)
   */
  const handleDelete = () => {
    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(renderDeployment, "delete");
          onClose();
        } catch (error) {
          logger.error("[DeploymentDetailPanel] Delete failed:", error);
          // 🆕 FIX-038: clusterName 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting deployment",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete deployment <b>{renderDeployment.getName()}</b>?
        </p>
      ),
    });
  };

  /**
   * Restart 액션: Deployment 재시작 (Confirm Dialog → API 호출)
   */
  const handleRestart = () => {
    openConfirmDialog({
      ok: async () => {
        try {
          await deploymentApi.restart({
            namespace: renderDeployment.getNs(),
            name: renderDeployment.getName(),
          });
        } catch (err) {
          // 🆕 FIX-038: clusterName 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            err instanceof Error ? err.message : "Unknown error occurred while restarting deployment",
            { clusterName },
          );
        }
      },
      labelOk: "Restart",
      message: (
        <p>
          Are you sure you want to restart deployment <b>{renderDeployment.getName()}</b>?
        </p>
      ),
    });
  };

  /**
   * Scale 액션: Scale Dialog 열기
   */
  const handleScale = () => {
    openDeploymentScaleDialog(renderDeployment);
  };

  return (
    <DetailPanel
      isOpen={isOpen}
      onClose={onClose}
      title={renderDeployment.getName()}
      subtitle={`Namespace: ${namespace}`}
      metricsComponent={<DeploymentMetricsDetailsComponent object={renderDeployment} />}
      object={renderDeployment}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onRestart={handleRestart}
      onScale={handleScale}
    >
      {/* ============================================ */}
      {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
      {/* ============================================ */}
      <KubeObjectMetaSection object={renderDeployment} />

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
              <span className="text-foreground text-sm">Ready</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">{readyReplicas}</span>
            </TableCell>
          </TableRow>

          {/* Updated Replicas */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Updated</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">{updatedReplicas}</span>
            </TableCell>
          </TableRow>

          {/* Available Replicas */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Available</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">{availableReplicas}</span>
            </TableCell>
          </TableRow>

          {/* Unavailable Replicas */}
          {unavailableReplicas > 0 && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Unavailable</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{unavailableReplicas}</span>
              </TableCell>
            </TableRow>
          )}

          {/* Strategy Type */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Strategy</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <Badge variant="outline">{strategyType}</Badge>
            </TableCell>
          </TableRow>

          {/* Max Surge (RollingUpdate만 표시) */}
          {strategyType === "RollingUpdate" && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Max Surge</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{maxSurge}</span>
              </TableCell>
            </TableRow>
          )}

          {/* Max Unavailable (RollingUpdate만 표시) */}
          {strategyType === "RollingUpdate" && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Max Unavailable</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{maxUnavailable}</span>
              </TableCell>
            </TableRow>
          )}

          {/* Observed Generation */}
          <TableRow>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">Observed Generation</span>
            </TableCell>
            <TableCell className="border-border border-b px-2 py-[14px]">
              <span className="text-foreground text-sm">{observedGeneration}</span>
            </TableCell>
          </TableRow>

          {/* Selectors */}
          {selectors.length > 0 && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Selectors</span>
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

          {/* Template Labels */}
          {templateLabels.length > 0 && (
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Template Labels</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <div className="flex flex-wrap gap-1">
                  {templateLabels.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* ============================================ */}
      {/* 📦 추가 섹션 - Conditions */}
      {/* ============================================ */}

      {/* Conditions */}
      <div className="mt-8">
        <KubeObjectConditionsDrawer object={renderDeployment} />
      </div>

      {/* ============================================ */}
      {/* 📋 Events 섹션 */}
      {/* ============================================ */}
      <KubeEventDetailsSection object={renderDeployment} />
    </DetailPanel>
  );
});

/**
 * DI 패턴 적용된 Deployment Detail Panel
 */
export const DeploymentDetailPanel = withInjectables<Dependencies, DeploymentDetailPanelProps>(
  NonInjectedDeploymentDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      hostedCluster: di.inject(hostedClusterInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      deploymentApi: di.inject(deploymentApiInjectable),
      openDeploymentScaleDialog: di.inject(openDeploymentScaleDialogInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
    }),
  },
);
