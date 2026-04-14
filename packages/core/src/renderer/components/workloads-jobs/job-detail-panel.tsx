/**
 * 🎯 목적: Job 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - CommonTable 템플릿의 우측 패널 UI 패턴 적용 (fixed inset-y-0 right-0 w-[700px])
 *   - shadcn UI 컴포넌트 (Table, Badge, Button) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 패턴 참조, shadcn 마이그레이션)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import "./job-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Job } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { formatDuration } from "@skuberplus/utilities";
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
import { PodDetailsList } from "../workloads-pods/pod-details-list";
import { PodDetailsStatuses } from "../workloads-pods/pod-details-statuses";
import { getStatusText, getStatusVariant } from "./job-utils";
import { JobMetricsDetailsComponent } from "./metrics-details-component";
import jobStoreInjectable from "./store.injectable";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";
import type { JobStore } from "./store";

export interface JobDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Job 객체
   */
  job: Job | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  hostedCluster: HostedCluster | undefined;
  jobStore: JobStore;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * Job 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param job - 표시할 Job 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedJobDetailPanel = observer(
  ({
    isOpen,
    job,
    onClose,
    logger,
    hostedCluster,
    jobStore,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
  }: JobDetailPanelProps & Dependencies) => {
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
    const [renderJob, setRenderJob] = React.useState<Job | undefined>(job);
    const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const prevIsOpenRef = React.useRef(isOpen);

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    React.useEffect(() => {
      if (job) {
        setRenderJob(job);
      }
    }, [job]);

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    React.useEffect(() => {
      const wasOpen = prevIsOpenRef.current;

      // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderJob(undefined);
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

    // ⚠️ Job 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!renderJob) {
      return null;
    }

    if (!(renderJob instanceof Job)) {
      logger.error("[JobDetailPanel]: passed object that is not an instanceof Job", renderJob);
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(renderJob);
    };

    /**
     * Delete 액션: Job 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(renderJob, "delete");
            onClose();
          } catch (error) {
            logger.error("[JobDetailPanel] Delete failed:", error);
            // 🆕 FIX-038: clusterName 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting job",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete Job <b>{renderJob.getName()}</b>?
          </p>
        ),
      });
    };

    /**
     * Suspend 액션: Job 일시 중지 (Confirm Dialog → API 호출)
     */
    const handleSuspend = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await jobStore.api.suspend({
              name: renderJob.getName(),
              namespace: renderJob.getNs(),
            });
          } catch (err) {
            // 🆕 FIX-038: clusterName 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              err instanceof Error ? err.message : "Unknown error occurred while suspending job",
              { clusterName },
            );
          }
        },
        labelOk: "Suspend",
        message: (
          <p>
            Are you sure you want to suspend job <b>{renderJob.getName()}</b>?
          </p>
        ),
      });
    };

    // 🎯 Job 속성 데이터 추출
    const { status, spec } = renderJob;
    const startTime = status?.startTime;
    const completionTime = status?.completionTime;
    const duration = renderJob.getJobDuration();
    const succeeded = renderJob.getCompletions();
    const completions = renderJob.getDesiredCompletions();
    const parallelism = renderJob.getParallelism();
    const activePods = status?.active ?? 0;
    const backoffLimit = spec?.backoffLimit ?? 6;
    const ttlAfterFinished = spec?.ttlSecondsAfterFinished;
    const namespace = renderJob.getNs();
    const jobStatus = getStatusText(renderJob);
    const jobStatusVariant = getStatusVariant(renderJob);

    // 🎯 Job에 속한 Pod 목록 가져오기
    const childPods = jobStore.getChildPods(renderJob);

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderJob.getName()}
        subtitle={`Namespace: ${namespace}`}
        metricsComponent={<JobMetricsDetailsComponent object={renderJob} />}
        object={renderJob}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onSuspend={handleSuspend}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderJob} />

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
                <Badge variant={jobStatusVariant}>{jobStatus}</Badge>
              </TableCell>
            </TableRow>

            {/* Start Time */}
            {startTime && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Start Time</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{startTime}</span>
                </TableCell>
              </TableRow>
            )}

            {/* Completion Time */}
            {completionTime && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Completion Time</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{completionTime}</span>
                </TableCell>
              </TableRow>
            )}

            {/* Duration */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Duration</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{formatDuration(duration)}</span>
              </TableCell>
            </TableRow>

            {/* Succeeded */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Succeeded</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{succeeded}</span>
              </TableCell>
            </TableRow>

            {/* Completions */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Completions</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{completions}</span>
              </TableCell>
            </TableRow>

            {/* Parallelism */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Parallelism</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{parallelism}</span>
              </TableCell>
            </TableRow>

            {/* Active Pods */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Active Pods</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{activePods}</span>
              </TableCell>
            </TableRow>

            {/* Backoff Limit */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Backoff Limit</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{backoffLimit}</span>
              </TableCell>
            </TableRow>

            {/* TTL After Finished */}
            {ttlAfterFinished !== undefined && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">TTL After Finished</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{formatDuration(ttlAfterFinished * 1000, false)}</span>
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
          <KubeObjectConditionsDrawer object={renderJob} />
        </div>

        {/* ============================================ */}
        {/* 📦 Pod 관련 정보 섹션 */}
        {/* ============================================ */}

        {/* Pod Status */}
        <div className="mt-8">
          <span className="text-foreground text-base font-medium">Pod Status</span>
          <div className="mt-4">
            <PodDetailsStatuses pods={childPods} />
          </div>
        </div>

        {/* Pod List */}
        <div className="mt-8">
          <PodDetailsList pods={childPods} owner={renderJob} />
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderJob} />
      </DetailPanel>
    );
  },
);

/**
 * DI 패턴 적용된 Job Detail Panel
 */
export const JobDetailPanel = withInjectables<Dependencies, JobDetailPanelProps>(NonInjectedJobDetailPanel, {
  getProps: (di, props) => ({
    ...props,
    logger: di.inject(loggerInjectionToken),
    hostedCluster: di.inject(hostedClusterInjectable),
    jobStore: di.inject(jobStoreInjectable),
    createEditResourceTab: di.inject(createEditResourceTabInjectable),
    deleteService: di.inject(kubeObjectDeleteServiceInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
  }),
});
