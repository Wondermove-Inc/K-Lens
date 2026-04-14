/**
 * 🎯 목적: Kubernetes Events 섹션 (shadcn UI 스타일)
 *
 * 표시 필드:
 * - Type: Event 타입 (Normal, Warning)
 * - Reason: Event 이유
 * - Message: Event 메시지
 * - Age: Event 발생 시간
 *
 * 📝 주의사항:
 * - shadcn Table 컴포넌트 사용 (Tailwind 토큰만 사용)
 * - KubeObject 인터페이스 호환 (getId)
 * - eventStore 주입으로 Events 데이터 로드
 * - 디테일 패널 열릴 때 fieldSelector로 직접 조회 (kubectl describe 수준 정확도)
 * - Watch 이벤트와 병합하여 실시간 업데이트 지원
 *
 * 🔄 변경이력:
 * - 2025-11-04: 초기 생성 (OLD KubeEventDetails → NEW shadcn 스타일 컴포넌트)
 * - 2026-01-19: 하이브리드 온디맨드 + Watch 방식으로 개선 (디테일 패널 이벤트 정확도 향상)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { KubeEvent, KubeObject } from "@skuberplus/kube-object";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
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
import { CheckCircle, Loader2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import eventStoreInjectable from "../events/store.injectable";
import { KubeObjectAge } from "../kube-object/age";

import type { EventStore } from "../events/store";

export interface KubeEventDetailsSectionProps {
  /**
   * Kubernetes 리소스 객체
   */
  object: KubeObject;
}

interface Dependencies {
  eventStore: EventStore;
}

/**
 * 🎯 목적: 직접 조회 이벤트와 Watch 이벤트를 병합 (중복 제거)
 *
 * @param directEvents - API 직접 조회로 가져온 이벤트
 * @param watchEvents - Watch 기반 메모리 캐시 이벤트
 * @returns 중복 제거된 병합 이벤트 배열
 */
function mergeEvents(directEvents: KubeEvent[], watchEvents: KubeEvent[]): KubeEvent[] {
  const eventMap = new Map<string, KubeEvent>();

  // 직접 조회 이벤트를 먼저 추가
  for (const event of directEvents) {
    eventMap.set(event.getId(), event);
  }

  // Watch 이벤트 중 새로운 것만 추가
  for (const event of watchEvents) {
    if (!eventMap.has(event.getId())) {
      eventMap.set(event.getId(), event);
    }
  }

  // 시간순 정렬 (최신 이벤트가 위로)
  return Array.from(eventMap.values()).sort((a, b) => b.getCreationTimestamp() - a.getCreationTimestamp());
}

/**
 * Kubernetes Events 섹션 컴포넌트 (MobX observer)
 *
 * @param object - Kubernetes 리소스 객체
 * @returns shadcn 스타일의 Events 테이블
 *
 * 📝 구현 방식:
 * - 패널 열릴 때: fieldSelector로 API 직접 조회 (정확한 이벤트)
 * - 실시간 업데이트: Watch 이벤트와 병합 (5초 배치)
 */
const NonInjectedKubeEventDetailsSection = observer(
  ({ object, eventStore }: KubeEventDetailsSectionProps & Dependencies) => {
    const [directEvents, setDirectEvents] = useState<KubeEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 🎯 패널 열릴 때 API에서 직접 조회
    useEffect(() => {
      let cancelled = false;

      setIsLoading(true);
      setDirectEvents([]);

      eventStore
        .loadEventsForObject(object)
        .then((events) => {
          if (!cancelled) {
            setDirectEvents(events);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [object.getId(), eventStore]);

    // 🎯 Watch 이벤트와 병합
    const watchEvents = eventStore.getEventsByObject(object);
    const events = isLoading ? [] : mergeEvents(directEvents, watchEvents);

    // 🎯 로딩 상태 표시
    if (isLoading) {
      return (
        <div className="mt-8">
          <span className="text-foreground text-base font-medium">Events</span>
          <div className="mt-4 flex h-[200px] items-center justify-center border from-muted/50 to-background bg-gradient-to-br rounded-md">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading events...</span>
            </div>
          </div>
        </div>
      );
    }

    // 🎯 Events가 없으면 Empty 상태 표시
    if (events.length === 0) {
      return (
        <div className="mt-8">
          <span className="text-foreground text-base font-medium">Events</span>
          <Empty className="mt-4 h-[200px] border from-muted/50 to-background bg-gradient-to-br">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CheckCircle />
              </EmptyMedia>
              <EmptyTitle>No Events</EmptyTitle>
              <EmptyDescription>No events found for this resource</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      );
    }

    return (
      <div className="mt-8">
        {/* ============================================ */}
        {/* 📋 섹션 제목 */}
        {/* ============================================ */}
        <span className="text-foreground text-base font-medium">Events</span>

        {/* ============================================ */}
        {/* 📋 Events 테이블 */}
        {/* ============================================ */}
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm font-medium">Type</span>
                </TableHead>
                <TableHead className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm font-medium">Reason</span>
                </TableHead>
                <TableHead className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm font-medium">Message</span>
                </TableHead>
                <TableHead className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm font-medium">Age</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const eventType = event.type || "Normal";
                const isWarning = eventType === "Warning";

                return (
                  <TableRow key={event.getId()}>
                    {/* Type */}
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <Badge variant={isWarning ? "destructive" : "secondary"} className="text-xs">
                        {eventType}
                      </Badge>
                    </TableCell>

                    {/* Reason */}
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">{event.reason || "-"}</span>
                    </TableCell>

                    {/* Message */}
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">{event.message || "-"}</span>
                    </TableCell>

                    {/* Age */}
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">
                        <KubeObjectAge object={event} compact={true} />
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  },
);

/**
 * DI 패턴 적용된 Kubernetes Events 섹션
 */
export const KubeEventDetailsSection = withInjectables<Dependencies, KubeEventDetailsSectionProps>(
  NonInjectedKubeEventDetailsSection,
  {
    getProps: (di, props) => ({
      ...props,
      eventStore: di.inject(eventStoreInjectable),
    }),
  },
);
