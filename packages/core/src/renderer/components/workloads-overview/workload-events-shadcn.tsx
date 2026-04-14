/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Workloads Overview 이벤트 테이블 (shadcn UI 기반)
 *
 * 📝 주의사항:
 * - shadcn Table 컴포넌트 사용
 * - cluster-issues.tsx 참고하여 구현
 * - compact 모드 지원 (기본 10개 제한)
 * - Type, Message, Object, Count, Age, Last Seen 표시
 *
 * 🔄 변경이력:
 * - 2025-11-05: 초기 생성 (기존 Events 컴포넌트를 shadcn UI로 마이그레이션)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@skuberplus/storybook-shadcn/src/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@skuberplus/storybook-shadcn/src/components/ui/table";
import { AlertCircle, CheckCircle } from "lucide-react";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import navigateToEventsInjectable from "../../../common/front-end-routing/routes/cluster/events/navigate-to-events.injectable";
import { ReactiveDuration } from "../duration/reactive-duration";
import eventStoreInjectable from "../events/store.injectable";
import { KubeObjectAge } from "../kube-object/age";

import type { KubeEvent } from "@skuberplus/kube-object";

import type { EventStore } from "../events/store";

export interface WorkloadEventsShadcnProps {
  className?: string;
  compact?: boolean;
  compactLimit?: number;
}

interface Dependencies {
  eventStore: EventStore;
  navigateToEvents: () => void;
}

/**
 * 🎯 목적: Workloads Overview 이벤트 테이블 컴포넌트
 */
class NonInjectedWorkloadEventsShadcn extends React.Component<WorkloadEventsShadcnProps & Dependencies> {
  constructor(props: WorkloadEventsShadcnProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  /**
   * 🎯 목적: 정렬된 이벤트 목록 (최신순)
   */
  @computed get sortedEvents(): KubeEvent[] {
    const { eventStore } = this.props;
    const events = eventStore.contextItems;

    // Age 기준 정렬 (최신 순)
    return events.slice().sort((a, b) => b.getCreationTimestamp() - a.getCreationTimestamp());
  }

  /**
   * 🎯 목적: Compact 모드일 때 제한된 이벤트 목록
   */
  @computed get visibleEvents(): KubeEvent[] {
    const { compact = false, compactLimit = 10 } = this.props;

    if (compact) {
      return this.sortedEvents.slice(0, compactLimit);
    }

    return this.sortedEvents;
  }

  /**
   * 🎯 목적: 테이블 콘텐츠 렌더링
   */
  renderContent() {
    const { eventStore, navigateToEvents } = this.props;
    const { visibleEvents, sortedEvents } = this;

    // 로딩 중
    if (!eventStore.isLoaded) {
      return (
        <Empty className="h-[300px] border-0 bg-transparent">
          <EmptyHeader>
            <EmptyTitle>Loading Events...</EmptyTitle>
            <EmptyDescription>Collecting cluster events...</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    // 이벤트 없음
    if (sortedEvents.length === 0) {
      return (
        <Empty className="h-[300px] border-0 bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle />
            </EmptyMedia>
            <EmptyTitle>No Events</EmptyTitle>
            <EmptyDescription>No events found in the selected namespaces</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    const allEventsShown = visibleEvents.length === sortedEvents.length;

    return (
      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 🎯 THEME-024: Semantic color for events info icon */}
            <AlertCircle className="h-4 w-4 text-status-info" />
            <h3 className="text-sm font-medium">
              Events
              {!allEventsShown && (
                <span className="ml-2 text-sm text-muted-foreground">
                  ({visibleEvents.length} of{" "}
                  <a onClick={navigateToEvents} className="cursor-pointer text-status-info hover:underline">
                    {sortedEvents.length}
                  </a>
                  )
                </span>
              )}
            </h3>
          </div>
        </div>

        {/* 테이블 */}
        <Table containerClassName="rounded-md border overflow-auto max-h-[400px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[10%]">Type</TableHead>
              <TableHead className="w-[35%]">Message</TableHead>
              <TableHead className="w-[20%]">Object</TableHead>
              <TableHead className="w-[10%]">Count</TableHead>
              <TableHead className="w-[15%]">Age</TableHead>
              <TableHead className="w-[10%]">Last Seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleEvents.map((event) => {
              const isWarning = event.isWarning();
              return (
                <TableRow
                  key={event.getId()}
                  className={isWarning ? "bg-warning/10 hover:bg-warning/20" : "hover:bg-muted/50"}
                >
                  <TableCell>
                    <span className={isWarning ? "text-warning font-medium" : ""}>{event.type}</span>
                  </TableCell>
                  <TableCell className="max-w-0 truncate" title={event.message}>
                    {event.message}
                  </TableCell>
                  <TableCell className="truncate" title={event.involvedObject.name}>
                    {event.involvedObject.name}
                  </TableCell>
                  <TableCell>{event.count}</TableCell>
                  <TableCell>
                    <KubeObjectAge key="age" object={event} />
                  </TableCell>
                  <TableCell>
                    {event.lastTimestamp ? (
                      <ReactiveDuration key="last-seen" timestamp={event.lastTimestamp} compact />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  render() {
    return <div className={`flex flex-col ${this.props.className || ""}`}>{this.renderContent()}</div>;
  }
}

export const WorkloadEventsShadcn = withInjectables<Dependencies, WorkloadEventsShadcnProps>(
  observer(NonInjectedWorkloadEventsShadcn),
  {
    getProps: (di, props) => ({
      ...props,
      eventStore: di.inject(eventStoreInjectable),
      navigateToEvents: di.inject(navigateToEventsInjectable),
    }),
  },
);
