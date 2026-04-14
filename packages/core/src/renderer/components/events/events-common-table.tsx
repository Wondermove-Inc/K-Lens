/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Event 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Events {count} items, 네임스페이스 드롭다운, 검색 입력)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable eventStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → eventStore.contextItems.slice() 변환
 * - 컬럼 정의는 events-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 *
 * 🔄 변경이력:
 * - 2025-11-03: 초기 생성 (KubeDataTable 마이그레이션)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { KubeDataTable } from "../common/kube-data-table/kube-data-table";
import { ResourceContextMenu } from "../common/resource-context-menu";
import { ResourceTableLayout } from "../common/resource-table-layout";
import dockStoreInjectable from "../dock/dock/store.injectable";
import namespaceStoreInjectable from "../namespaces/store.injectable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../shadcn-ui/alert-dialog";
import { Button } from "../shadcn-ui/button";
import { EventDetailPanel } from "./event-detail-panel";
import { eventColumns } from "./events-columns";
import eventStoreInjectable from "./store.injectable";

import type { KubeEvent } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { NamespaceStore } from "../namespaces/store";
import type { EventStore } from "./store";

/**
 * 🎯 목적: EventsCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  eventStore: EventStore;
  namespaceStore: NamespaceStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  className?: string;
}

/**
 * 🎯 목적: 레이아웃 높이 상수 (DockStore.maxHeight 계산 방식과 일치)
 *
 * @remarks
 * 테이블 maxHeight 계산을 위한 정확한 오프셋 값
 * - calc(100vh - TOTAL_TABLE_OFFSET - dockHeight)
 */
const LAYOUT_OFFSETS = {
  clusterManagerHeader: 40, // ClusterManager Header
  statusBar: 21, // StatusBar
  mainLayoutTabs: 36, // MainTabContainer (탭)
  eventMenuBar: 65, // EventsCommonTable 상단 메뉴 (제목, 네임스페이스, 검색)
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.eventMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: Event 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (eventStore, namespaceStore, dockStore, subscribeStores, className)
 * @returns KubeDataTable 기반 Event 목록 테이블
 */
const NonInjectedEventsCommonTable = observer(
  ({ eventStore, namespaceStore, dockStore, subscribeStores, className }: Dependencies) => {
    // eventStore.contextItems는 MobX computed getter (즉시 필터링된 데이터)
    const events = eventStore.contextItems;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [selectedEvent, setSelectedEvent] = useState<KubeEvent | undefined>(undefined);
    const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
    const [selectedRows, setSelectedRows] = useState<(typeof events)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - eventStore.contextItems가 이미 namespace 필터링 수행
     * - 검색 필터만 추가로 적용
     */
    const filteredEvents = React.useMemo(() => {
      // events는 이미 contextItems로 필터링됨
      let filtered = events.slice();

      // 검색 필터 (Message, Type, Namespace, Involved Object 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (event) =>
            (event.message && event.message.toLowerCase().includes(search)) ||
            (event.type && event.type.toLowerCase().includes(search)) ||
            event.getNs().toLowerCase().includes(search) ||
            event.involvedObject.name.toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [events, searchValue]);

    /**
     * 🎯 목적: Event Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - KubeWatchApi.subscribeStores()를 통한 중앙 집중식 구독 관리
     * - 중복 구독 방지 및 namespace 변경 자동 감지
     * - 컴포넌트 마운트 시 store.loadAll() → store.subscribe() 자동 실행
     * - 언마운트 시 구독 자동 해제로 메모리 누수 방지
     *
     * 🔄 변경이력:
     * - 2025-11-03: Store 구독 로직 추가 (KubeWatchApi.subscribeStores() 사용)
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([eventStore], {
        onLoadFailure: (error) => {
          console.error("[Events] Failed to load events:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [eventStore, subscribeStores]);

    /**
     * 🎯 목적: Event 행 클릭 핸들러 (Detail Panel 토글)
     * @param event - 클릭된 Event 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (event: KubeEvent) => {
      if (selectedEvent?.getId() === event.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedEvent(undefined);
        setIsDetailPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedEvent(event);
        setIsDetailPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: DetailPanel 닫기 핸들러
     */
    const handleCloseDetailPanel = () => {
      setIsDetailPanelOpen(false);
      setSelectedEvent(undefined);
    };

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Event 배열
     */
    const handleSelectionChange = (selectedItems: (typeof events)[number][]) => {
      setSelectedRows(selectedItems);
    };

    /**
     * 🎯 목적: Delete 버튼 클릭 핸들러 (확인 다이얼로그 열기)
     */
    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    /**
     * 🎯 목적: Delete 확인 후 실제 삭제 실행
     */
    const handleDeleteConfirm = async () => {
      try {
        await Promise.all(
          selectedRows.map(async (item) => {
            await eventStore.remove(item);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[Event] Failed to delete:", error);
      }
    };

    return (
      <ResourceTableLayout
        title="Events"
        itemCount={filteredEvents.length}
        showNamespaceFilter={true}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search events..."
        className={className}
        headerActions={
          selectedCount > 0 ? (
            <Button
              variant="secondary"
              onClick={handleDeleteClick}
              className="!bg-secondary !text-destructive gap-2 !px-4"
            >
              <Trash2 className="!text-destructive h-4 w-4" />
              Delete ({selectedCount})
            </Button>
          ) : null
        }
      >
        {/* ============================================ */}
        {/* 🎯 KubeDataTable: Event 목록 테이블 */}
        {/* ============================================ */}
        <KubeDataTable
          data={filteredEvents}
          columns={eventColumns}
          enableColumnResizing={true}
          enableRowSelection={true}
          enablePagination={true}
          defaultPageSize={40}
          getRowId={(item) => item.getId()}
          dockHeight={dockStore.isOpen ? dockStore.height : 0}
          tableOffset={TOTAL_TABLE_OFFSET}
          emptyMessage="No Events found"
          className="h-full"
          onRowClick={handleRowClick}
          onSelectionChange={handleSelectionChange}
          selectedItem={isDetailPanelOpen ? selectedEvent : undefined}
          renderContextMenu={(item) => <ResourceContextMenu object={item} />}
        />

        {/* ============================================ */}
        {/* 🎯 DetailPanel: Event 상세 정보 */}
        {/* ============================================ */}
        <EventDetailPanel isOpen={isDetailPanelOpen} event={selectedEvent} onClose={handleCloseDetailPanel} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Events</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Event(s)?
                <br />
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ResourceTableLayout>
    );
  },
);

/**
 * 🎯 목적: Injectable로 감싼 EventsCommonTable 컴포넌트
 *
 * @remarks
 * - eventStore: Event 목록 및 상태 관리
 * - namespaceStore: 전역 네임스페이스 필터 관리
 * - dockStore: Dock 높이 정보 제공 (테이블 maxHeight 계산용)
 * - subscribeStores: KubeWatchApi의 중앙 집중식 구독 관리자
 */
export const EventsCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "eventStore" | "namespaceStore" | "dockStore" | "subscribeStores">
>(NonInjectedEventsCommonTable, {
  getProps: (di, props) => ({
    eventStore: di.inject(eventStoreInjectable),
    namespaceStore: di.inject(namespaceStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    ...props,
  }),
});
