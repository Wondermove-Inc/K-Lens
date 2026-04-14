/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./cronjob-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { CronJob } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle/Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { formatDuration } from "@skuberplus/utilities/dist";
import kebabCase from "lodash/kebabCase";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { BadgeBoolean } from "../badge";
import { DurationAbsoluteTimestamp } from "../events";
import { LinkToJob } from "../kube-object-link";
import jobStoreInjectable from "../workloads-jobs/store.injectable";
import cronJobStoreInjectable from "./store.injectable";
import { getScheduleFullDescription } from "./utils";

import type { Job } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { JobStore } from "../workloads-jobs/store";
import type { CronJobStore } from "./store";

export interface CronJobDetailsProps extends KubeObjectDetailsProps<CronJob> {}

interface Dependencies {
  subscribeStores: SubscribeStores;
  jobStore: JobStore;
  cronJobStore: CronJobStore;
  logger: Logger;
}

class NonInjectedCronJobDetails extends Component<CronJobDetailsProps & Dependencies> {
  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.jobStore])]);
  }

  render() {
    const { object: cronJob, jobStore, cronJobStore } = this.props;

    if (!cronJob) {
      return null;
    }

    if (!(cronJob instanceof CronJob)) {
      this.props.logger.error("[CronJobDetails]: passed object that is not an instanceof CronJob", cronJob);

      return null;
    }

    const childJobs = jobStore.getJobsByOwner(cronJob).sort((a, b) => {
      const aTime = a.status?.startTime ? new Date(a.status.startTime).getTime() : 0;
      const bTime = b.status?.startTime ? new Date(b.status.startTime).getTime() : 0;
      return bTime - aTime;
    });

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="CronJobDetails">
        <DetailPanelField label="Schedule">{getScheduleFullDescription(cronJob)}</DetailPanelField>
        <DetailPanelField label="Timezone">{cronJob.spec.timeZone}</DetailPanelField>
        <DetailPanelField label="Starting Deadline Seconds" hidden={!cronJob.spec.startingDeadlineSeconds}>
          {formatDuration(cronJob.spec.startingDeadlineSeconds || 0)}
        </DetailPanelField>
        <DetailPanelField label="Concurrency Policy" hidden={!cronJob.spec.concurrencyPolicy}>
          {cronJob.spec.concurrencyPolicy}
        </DetailPanelField>
        <DetailPanelField label="Resumed">
          <BadgeBoolean value={!cronJob.spec.suspend} />
        </DetailPanelField>
        <DetailPanelField label="Successful Jobs History Limit" hidden={!cronJob.spec.successfulJobsHistoryLimit}>
          {cronJob.spec.successfulJobsHistoryLimit}
        </DetailPanelField>
        <DetailPanelField label="Failed Jobs History Limit" hidden={!cronJob.spec.failedJobsHistoryLimit}>
          {cronJob.spec.failedJobsHistoryLimit}
        </DetailPanelField>
        <DetailPanelField label="Last Schedule" hidden={!cronJob.status?.lastScheduleTime}>
          <DurationAbsoluteTimestamp timestamp={cronJob.status?.lastScheduleTime} />
        </DetailPanelField>
        <DetailPanelField label="Last Successful Run" hidden={!cronJob.status?.lastSuccessfulTime}>
          <DurationAbsoluteTimestamp timestamp={cronJob.status?.lastSuccessfulTime} />
        </DetailPanelField>
        <DetailPanelField label="Active">{cronJobStore.getActiveJobsNum(cronJob)}</DetailPanelField>

        {cronJob.spec.jobTemplate && (
          <DetailPanelSection title="Template">
            <DetailPanelField label="Parallelism">{cronJob.getJobParallelism()}</DetailPanelField>
            <DetailPanelField label="Completions">{cronJob.getJobDesiredCompletions()}</DetailPanelField>
            <DetailPanelField label="Completion Mode" hidden={!cronJob.spec.jobTemplate.spec?.completionMode}>
              {cronJob.spec.jobTemplate.spec?.completionMode}
            </DetailPanelField>
            <DetailPanelField label="Resumed">
              <BadgeBoolean value={!cronJob.spec.jobTemplate.spec?.suspend} />
            </DetailPanelField>
            <DetailPanelField label="Backoff Limit" hidden={cronJob.spec.jobTemplate.spec?.backoffLimit !== undefined}>
              {cronJob.spec.jobTemplate.spec?.backoffLimit}
            </DetailPanelField>
            <DetailPanelField
              label="TTL Seconds After Finished"
              hidden={cronJob.spec.jobTemplate.spec?.ttlSecondsAfterFinished !== undefined}
            >
              {formatDuration(cronJob.spec.jobTemplate.spec?.ttlSecondsAfterFinished || 0)}
            </DetailPanelField>
            <DetailPanelField
              label="Active Deadline Seconds"
              hidden={!cronJob.spec.jobTemplate.spec?.activeDeadlineSeconds}
            >
              {formatDuration(cronJob.spec.jobTemplate.spec?.activeDeadlineSeconds || 0)}
            </DetailPanelField>
          </DetailPanelSection>
        )}

        {childJobs.length > 0 && (
          <DetailPanelSection title="Jobs">
            {childJobs.map((job: Job) => {
              const selectors = job.getSelectors();
              const condition = job.getCondition();

              return (
                <div className="job" key={job.getId()}>
                  <div className="title flex gaps">
                    <Icon small material="list" />
                    <span>
                      <LinkToJob name={job.getName()} namespace={job.getNs()} />
                    </span>
                  </div>
                  <DetailPanelField label="Condition">
                    {condition && (
                      <Badge variant="outline" className={kebabCase(condition.type)}>
                        {condition.type}
                      </Badge>
                    )}
                  </DetailPanelField>
                  <DetailPanelField label="Selector">
                    <div className="flex flex-wrap gap-1">
                      {selectors.map((label) => (
                        <Badge key={label} variant="outline" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </DetailPanelField>
                  <DetailPanelField label="Start Time">
                    {job.status?.startTime && <DurationAbsoluteTimestamp timestamp={job.status?.startTime} />}
                  </DetailPanelField>
                  <DetailPanelField label="Duration">{formatDuration(job.getJobDuration() || 0)}</DetailPanelField>
                </div>
              );
            })}
          </DetailPanelSection>
        )}
      </div>
    );
  }
}

export const CronJobDetails = withInjectables<Dependencies, CronJobDetailsProps>(observer(NonInjectedCronJobDetails), {
  getProps: (di, props) => ({
    ...props,
    subscribeStores: di.inject(subscribeStoresInjectable),
    cronJobStore: di.inject(cronJobStoreInjectable),
    jobStore: di.inject(jobStoreInjectable),
    logger: di.inject(loggerInjectionToken),
  }),
});
