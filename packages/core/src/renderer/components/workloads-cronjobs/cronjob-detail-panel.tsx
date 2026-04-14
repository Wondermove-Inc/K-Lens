/**
 * 🎯 목적: CronJob 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - Deployment Detail Panel 패턴 재사용
 *   - shadcn UI 컴포넌트 (Table, Badge, Button) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - CronJob 전용 정보: Schedule, Suspend, Template, Active Jobs
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Deployment Detail Panel 패턴 기반)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-11-11: Trigger, Suspend 액션 버튼 추가 (Confirm Dialog, API 호출)
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { CronJob } from "@skuberplus/kube-object";
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
import cronJobStoreInjectable from "./store.injectable";
import openCronJobTriggerDialogInjectable from "./trigger-dialog/open.injectable";
import { humanizeSchedule } from "./utils";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";
import type { CronJobStore } from "./store";
import type { OpenCronJobTriggerDialog } from "./trigger-dialog/open.injectable";

export interface CronJobDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 CronJob 객체
   */
  cronJob: CronJob | undefined;

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
  openCronJobTriggerDialog: OpenCronJobTriggerDialog;
  cronJobStore: CronJobStore;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * CronJob 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param cronJob - 표시할 CronJob 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedCronJobDetailPanel = observer(
  ({
    isOpen,
    cronJob,
    onClose,
    logger,
    hostedCluster,
    createEditResourceTab,
    deleteService,
    openCronJobTriggerDialog,
    cronJobStore,
    openConfirmDialog,
  }: CronJobDetailPanelProps & Dependencies) => {
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
    const [renderCronJob, setRenderCronJob] = React.useState<CronJob | undefined>(cronJob);
    const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const prevIsOpenRef = React.useRef(isOpen);

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    React.useEffect(() => {
      if (cronJob) {
        setRenderCronJob(cronJob);
      }
    }, [cronJob]);

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    React.useEffect(() => {
      const wasOpen = prevIsOpenRef.current;

      // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderCronJob(undefined);
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

    // ⚠️ CronJob 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!renderCronJob) {
      return null;
    }

    if (!(renderCronJob instanceof CronJob)) {
      logger.error("[CronJobDetailPanel]: passed object that is not an instanceof CronJob", renderCronJob);
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(renderCronJob);
    };

    /**
     * Delete 액션: CronJob 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(renderCronJob, "delete");
            onClose();
          } catch (error) {
            logger.error("[CronJobDetailPanel] Delete failed:", error);
            // 🆕 FIX-038: clusterName 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting cronjob",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete CronJob <b>{renderCronJob.getName()}</b>?
          </p>
        ),
      });
    };

    /**
     * Trigger 액션: Trigger Dialog 열기
     */
    const handleTrigger = () => {
      openCronJobTriggerDialog(renderCronJob);
    };

    /**
     * Suspend 액션: CronJob 일시 중지 (Confirm Dialog → API 호출)
     */
    const handleSuspend = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await cronJobStore.api.suspend({
              name: renderCronJob.getName(),
              namespace: renderCronJob.getNs(),
            });
          } catch (err) {
            // 🆕 FIX-038: clusterName 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              err instanceof Error ? err.message : "Unknown error occurred while suspending CronJob",
              { clusterName },
            );
          }
        },
        labelOk: "Suspend",
        message: (
          <p>
            Are you sure you want to suspend CronJob <b>{renderCronJob.getName()}</b>?
          </p>
        ),
      });
    };

    // 🎯 CronJob 속성 데이터 추출
    const { status, spec } = renderCronJob;
    const namespace = renderCronJob.getNs();
    const schedule = renderCronJob.getSchedule();
    const humanizedSchedule = humanizeSchedule(schedule);
    const neverRan = renderCronJob.isNeverRun();
    const suspended = renderCronJob.isSuspend();
    const timezone = spec.timeZone || "-";
    const startingDeadlineSeconds = spec.startingDeadlineSeconds;
    const concurrencyPolicy = spec.concurrencyPolicy || "Allow";
    const successfulJobsHistoryLimit = spec.successfulJobsHistoryLimit;
    const failedJobsHistoryLimit = spec.failedJobsHistoryLimit;

    // Active Jobs 정보
    const activeJobs = status?.active || [];
    const activeJobsCount = activeJobs.length;

    // Last Schedule Time
    const lastScheduleTime = status?.lastScheduleTime || "-";
    const lastSuccessfulTime = status?.lastSuccessfulTime || "-";

    // Job Template 정보
    const jobTemplate = spec.jobTemplate;
    const parallelism = jobTemplate?.spec?.parallelism;
    const completions = jobTemplate?.spec?.completions;
    const completionMode = jobTemplate?.spec?.completionMode || "NonIndexed";
    const jobSuspended = jobTemplate?.spec?.suspend || false;
    const backoffLimit = jobTemplate?.spec?.backoffLimit;
    const ttlSecondsAfterFinished = jobTemplate?.spec?.ttlSecondsAfterFinished;
    const activeDeadlineSeconds = jobTemplate?.spec?.activeDeadlineSeconds;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderCronJob.getName()}
        subtitle={`Namespace: ${namespace}`}
        object={renderCronJob}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTrigger={handleTrigger}
        onSuspend={handleSuspend}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderCronJob} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 기본 정보 테이블 - shadcn Table 컴포넌트 사용 */}
        {/* ============================================ */}
        <div>
          <h3 className="text-base font-medium mb-2">Basic Information</h3>
          <Table>
            <TableBody>
              {/* Schedule */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Schedule</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <div className="flex flex-col gap-1">
                    <span className="text-foreground text-sm font-mono">{schedule}</span>
                    <span className="text-muted-foreground text-xs">
                      {humanizedSchedule}
                      {neverRan && " (never ran)"}
                    </span>
                  </div>
                </TableCell>
              </TableRow>

              {/* Timezone */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Timezone</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{timezone}</span>
                </TableCell>
              </TableRow>

              {/* Suspend */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Suspend</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <Badge variant={suspended ? "destructive" : "default"} className="text-xs">
                    {suspended ? "Suspended" : "Active"}
                  </Badge>
                </TableCell>
              </TableRow>

              {/* Starting Deadline Seconds */}
              {startingDeadlineSeconds !== undefined && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Starting Deadline Seconds</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{startingDeadlineSeconds}</span>
                  </TableCell>
                </TableRow>
              )}

              {/* Concurrency Policy */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Concurrency Policy</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <Badge variant="outline">{concurrencyPolicy}</Badge>
                </TableCell>
              </TableRow>

              {/* Successful Jobs History Limit */}
              {successfulJobsHistoryLimit !== undefined && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Successful Jobs History Limit</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{successfulJobsHistoryLimit}</span>
                  </TableCell>
                </TableRow>
              )}

              {/* Failed Jobs History Limit */}
              {failedJobsHistoryLimit !== undefined && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Failed Jobs History Limit</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{failedJobsHistoryLimit}</span>
                  </TableCell>
                </TableRow>
              )}

              {/* Last Schedule Time */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Last Schedule Time</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{lastScheduleTime}</span>
                </TableCell>
              </TableRow>

              {/* Last Successful Time */}
              {lastSuccessfulTime !== "-" && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Last Successful Time</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{lastSuccessfulTime}</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ============================================ */}
        {/* 📦 Job Template 정보 */}
        {/* ============================================ */}
        <div>
          <h3 className="text-base font-medium mb-2">Job Template</h3>
          <Table>
            <TableBody>
              {/* Parallelism */}
              {parallelism !== undefined && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Parallelism</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{parallelism}</span>
                  </TableCell>
                </TableRow>
              )}

              {/* Completions */}
              {completions !== undefined && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Completions</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{completions}</span>
                  </TableCell>
                </TableRow>
              )}

              {/* Completion Mode */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Completion Mode</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <Badge variant="outline">{completionMode}</Badge>
                </TableCell>
              </TableRow>

              {/* Job Suspended */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Job Suspended</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <Badge variant={jobSuspended ? "destructive" : "default"} className="text-xs">
                    {jobSuspended ? "Suspended" : "Active"}
                  </Badge>
                </TableCell>
              </TableRow>

              {/* Backoff Limit */}
              {backoffLimit !== undefined && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Backoff Limit</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{backoffLimit}</span>
                  </TableCell>
                </TableRow>
              )}

              {/* TTL Seconds After Finished */}
              {ttlSecondsAfterFinished !== undefined && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">TTL Seconds After Finished</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{ttlSecondsAfterFinished}</span>
                  </TableCell>
                </TableRow>
              )}

              {/* Active Deadline Seconds */}
              {activeDeadlineSeconds !== undefined && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">Active Deadline Seconds</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-foreground text-sm">{activeDeadlineSeconds}</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ============================================ */}
        {/* 🏃 Active Jobs */}
        {/* ============================================ */}
        <div>
          <h3 className="text-base font-medium mb-2">Active Jobs</h3>
          {activeJobsCount === 0 ? (
            <p className="text-sm text-muted-foreground">No active jobs</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeJobs.map((job, index) => (
                <Badge key={index} variant="default" className="text-xs">
                  {job.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderCronJob} />
      </DetailPanel>
    );
  },
);

/**
 * DI 패턴 적용된 CronJob Detail Panel
 */
export const CronJobDetailPanel = withInjectables<Dependencies, CronJobDetailPanelProps>(
  NonInjectedCronJobDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      hostedCluster: di.inject(hostedClusterInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openCronJobTriggerDialog: di.inject(openCronJobTriggerDialogInjectable),
      cronJobStore: di.inject(cronJobStoreInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
    }),
  },
);
