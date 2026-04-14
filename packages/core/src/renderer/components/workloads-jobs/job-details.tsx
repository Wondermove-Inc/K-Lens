/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./job-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Job } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { formatDuration } from "@skuberplus/utilities/dist";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { BadgeBoolean } from "../badge";
import { DurationAbsoluteTimestamp } from "../events";
import { KubeObjectConditionsDrawer } from "../kube-object-conditions";
import { PodDetailsAffinities } from "../workloads-pods/pod-details-affinities";
import { PodDetailsList } from "../workloads-pods/pod-details-list";
import { PodDetailsStatuses } from "../workloads-pods/pod-details-statuses";
import { PodDetailsTolerations } from "../workloads-pods/pod-details-tolerations";
import podStoreInjectable from "../workloads-pods/store.injectable";
import { getStatusText, getStatusVariant } from "./jobs";
import jobStoreInjectable from "./store.injectable";

import type { Logger } from "@skuberplus/logger";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { PodStore } from "../workloads-pods/store";
import type { JobStore } from "./store";

export interface JobDetailsProps extends KubeObjectDetailsProps<Job> {}

interface Dependencies {
  subscribeStores: SubscribeStores;
  podStore: PodStore;
  jobStore: JobStore;
  logger: Logger;
}

class NonInjectedJobDetails extends Component<JobDetailsProps & Dependencies> {
  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.podStore])]);
  }

  render() {
    const { object: job, jobStore, logger } = this.props;

    if (!job) {
      return null;
    }

    if (!(job instanceof Job)) {
      logger.error("[JobDetails]: passed object that is not an instanceof Job", job);

      return null;
    }

    const selectors = job.getSelectors();
    const nodeSelector = job.getNodeSelectors();
    const childPods = jobStore.getChildPods(job);

    // 🎯 shadcn DetailPanelField로 마이그레이션 완료
    return (
      <div className="JobDetails">
        {selectors.length > 0 && (
          <DetailPanelField label="Selector">
            <div className="flex flex-wrap gap-1">
              {selectors.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}
        {nodeSelector.length > 0 && (
          <DetailPanelField label="Node Selector">
            <div className="flex flex-wrap gap-1">
              {nodeSelector.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </DetailPanelField>
        )}
        <DetailPanelField label="Status">
          <Badge variant={getStatusVariant(job)}>{getStatusText(job)}</Badge>
        </DetailPanelField>
        <DetailPanelField label="Parallelism">{job.getParallelism()}</DetailPanelField>
        <DetailPanelField label="Completions">{job.getDesiredCompletions()}</DetailPanelField>
        <DetailPanelField label="Completion Mode" hidden={!job.spec.completionMode}>
          {job.spec.completionMode}
        </DetailPanelField>
        <DetailPanelField label="Resumed">
          <BadgeBoolean value={!job.spec.suspend} />
        </DetailPanelField>
        <DetailPanelField label="Backoff Limit" hidden={job.spec.backoffLimit !== undefined}>
          {job.spec.backoffLimit}
        </DetailPanelField>
        <DetailPanelField label="TTL Seconds After Finished" hidden={job.spec.ttlSecondsAfterFinished !== undefined}>
          {formatDuration(job.spec.ttlSecondsAfterFinished || 0)}
        </DetailPanelField>
        <DetailPanelField label="Start Time" hidden={!job.status?.startTime}>
          <DurationAbsoluteTimestamp timestamp={job.status?.startTime} />
        </DetailPanelField>
        <DetailPanelField label="Completed At" hidden={!job.status?.completionTime}>
          <DurationAbsoluteTimestamp timestamp={job.status?.completionTime} />
        </DetailPanelField>
        <DetailPanelField label="Duration" hidden={!job.status?.startTime || !job.status?.completionTime}>
          {formatDuration(job.getJobDuration())}
        </DetailPanelField>
        <DetailPanelField label="Active Deadline Seconds" hidden={!job.spec.activeDeadlineSeconds}>
          {formatDuration(job.spec.activeDeadlineSeconds || 0)}
        </DetailPanelField>
        <DetailPanelField label="Pods Statuses">
          {job.status?.ready === undefined
            ? `${job.status?.active || 0} Active / ${job.status?.succeeded || 0} Succeeded / ${job.status?.failed || 0} Failed`
            : `${job.status?.active || 0} Active (${job.status?.ready || 0} Ready) / ${job.status?.succeeded || 0} Succeeded / ${job.status?.failed || 0} Failed`}
        </DetailPanelField>
        <DetailPanelField label="Completed Indexes" hidden={!job.status?.completedIndexes}>
          {job.status?.completedIndexes}
        </DetailPanelField>
        <PodDetailsTolerations workload={job} />
        <PodDetailsAffinities workload={job} />
        <DetailPanelField label="Pod Status">
          <PodDetailsStatuses pods={childPods} />
        </DetailPanelField>
        <KubeObjectConditionsDrawer object={job} />
        <PodDetailsList pods={childPods} owner={job} />
      </div>
    );
  }
}

export const JobDetails = withInjectables<Dependencies, JobDetailsProps>(observer(NonInjectedJobDetails), {
  getProps: (di, props) => ({
    ...props,
    subscribeStores: di.inject(subscribeStoresInjectable),
    podStore: di.inject(podStoreInjectable),
    jobStore: di.inject(jobStoreInjectable),
    logger: di.inject(loggerInjectionToken),
  }),
});
