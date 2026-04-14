/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: DaemonSet 목록 테이블 - CommonTable 패턴 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (DaemonSets {count} items, 네임스페이스 드롭다운, 검색 입력)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - DaemonSet Detail Panel (우측 슬라이드 패널)
 * - MobX observable daemonSetStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → daemonSetStore.items.slice() 변환
 * - 컬럼 정의는 daemonsets-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 * - 멀티디바이스 대응 (Pod CommonTable 패턴)
 *
 * 🔄 변경이력:
 * - 2025-10-30: CommonTable 패턴으로 마이그레이션 (shadcn UI + Detail Panel)
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
import eventStoreInjectable from "../events/store.injectable";
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
import { DaemonSetDetailPanel } from "./daemonset-detail-panel";
import { daemonSetColumns } from "./daemonsets-columns";
import daemonSetStoreInjectable from "./store.injectable";

import type { DaemonSet } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { EventStore } from "../events/store";
import type { NamespaceStore } from "../namespaces/store";
import type { DaemonSetStore } from "./store";

/**
 * 🎯 목적: DaemonSetsCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  daemonSetStore: DaemonSetStore;
  namespaceStore: NamespaceStore;
  eventStore: EventStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  className?: string;
}

/**
 * 🎯 목적: 레이아웃 높이 상수
 *
 * @remarks
 * 테이블 maxHeight 계산을 위한 정확한 오프셋 값
 * - calc(100vh - TOTAL_TABLE_OFFSET - dockHeight)
 */
const LAYOUT_OFFSETS = {
  clusterManagerHeader: 40, // ClusterManager Header
  statusBar: 21, // StatusBar
  mainLayoutTabs: 36, // MainTabContainer (탭)
  daemonSetMenuBar: 65, // DaemonSets 상단 메뉴
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.daemonSetMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: DaemonSet 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (daemonSetStore, eventStore, dockStore, subscribeStores, className)
 * @returns KubeDataTable 기반 DaemonSet 목록 테이블 + Detail Panel
 */
const NonInjectedDaemonSetsCommonTable = observer(
  ({ daemonSetStore, namespaceStore, eventStore, dockStore, subscribeStores, className }: Dependencies) => {
    // daemonSetStore.contextItems는 MobX computed getter (즉시 필터링된 데이터)
    const daemonSets = daemonSetStore.contextItems;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedDaemonSet, setSelectedDaemonSet] = useState<DaemonSet | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<DaemonSet[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - daemonSets는 이미 contextItems로 필터링됨
     * - 검색 필터: Name, Namespace, Labels 기준
     */
    const filteredDaemonSets = React.useMemo(() => {
      // daemonSets는 이미 contextItems로 필터링됨
      let filtered = daemonSets.slice();

      // 검색 필터 (Name, Namespace 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (ds) => ds.getName().toLowerCase().includes(search) || ds.getNs().toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [daemonSets, searchValue]);

    /**
     * 🎯 목적: DaemonSet Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - KubeWatchApi.subscribeStores()를 통한 중앙 집중식 구독 관리
     * - 중복 구독 방지 및 namespace 변경 자동 감지
     * - 컴포넌트 마운트 시 store.loadAll() → store.subscribe() 자동 실행
     * - 언마운트 시 구독 자동 해제로 메모리 누수 방지
     *
     * 🔄 변경이력:
     * - 2025-10-31: Store 구독 로직 추가 (KubeWatchApi.subscribeStores() 사용)
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([daemonSetStore], {
        onLoadFailure: (error) => {
          console.error("[DaemonSets] Failed to load daemonsets:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [daemonSetStore, subscribeStores]);

    /**
     * 🎯 목적: DaemonSet 행 클릭 핸들러 (Detail Panel 토글)
     *
     * @param daemonSet - 클릭된 DaemonSet 객체
     *
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (daemonSet: DaemonSet) => {
      if (selectedDaemonSet?.getId() === daemonSet.getId()) {
        setIsPanelOpen(false);
        setSelectedDaemonSet(undefined);
      } else {
        setSelectedDaemonSet(daemonSet);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: Detail Panel 닫기 핸들러
     */
    const handleClosePanel = () => {
      setIsPanelOpen(false);
      setSelectedDaemonSet(undefined);
    };

    /**
     * 🎯 목적: 선택된 행 개수 계산
     */
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 행 선택 변경 핸들러
     * @param selectedDaemonSets - 선택된 DaemonSet 배열
     */
    const handleSelectionChange = (selectedDaemonSets: DaemonSet[]) => {
      setSelectedRows(selectedDaemonSets);
    };

    /**
     * 🎯 목적: Delete 버튼 클릭 핸들러 (삭제 확인 다이얼로그 열기)
     */
    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    /**
     * 🎯 목적: 삭제 확인 핸들러 (실제 DaemonSet 삭제 수행)
     *
     * @remarks
     * - 선택된 모든 DaemonSet을 삭제
     * - daemonSetStore.remove() 메서드를 사용하여 Kubernetes API 호출
     * - 삭제 후 선택 상태 초기화 및 다이얼로그 닫기
     */
    const handleDeleteConfirm = async () => {
      try {
        // 각 DaemonSet 삭제 (병렬 처리)
        await Promise.all(
          selectedRows.map(async (daemonSet) => {
            await daemonSetStore.remove(daemonSet);
          }),
        );

        // 삭제 성공 후 선택 상태 초기화
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[DaemonSets] Failed to delete daemonsets:", error);
        // TODO: 에러 토스트 메시지 표시
      }
    };

    return (
      <div className={className || ""}>
        <ResourceTableLayout
          title="Daemon Sets"
          itemCount={filteredDaemonSets.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search daemon sets..."
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
          {/* 🎯 KubeDataTable: DaemonSet 목록 테이블 */}
          {/* ============================================ */}
          <KubeDataTable
            data={filteredDaemonSets}
            columns={daemonSetColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage="No DaemonSets found"
            className="h-full"
            selectedItem={isPanelOpen ? selectedDaemonSet : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 DaemonSet Detail Panel (우측 슬라이드) */}
        {/* ============================================ */}
        <DaemonSetDetailPanel isOpen={isPanelOpen} daemonSet={selectedDaemonSet} onClose={handleClosePanel} />

        {/* ============================================ */}
        {/* 🎯 Delete Confirmation Dialog: 삭제 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Daemon Sets</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected DaemonSet(s)?
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
      </div>
    );
  },
);

/**
 * 🎯 목적: DaemonSetsCommonTable 컴포넌트 (Injectable DI 적용)
 *
 * @remarks
 * - daemonSetStore: DaemonSet 목록 및 상태 관리
 * - namespaceStore: 전역 네임스페이스 필터 관리
 * - eventStore: 이벤트 데이터 관리
 * - dockStore: Dock 높이 정보 제공 (테이블 maxHeight 계산용)
 * - subscribeStores: KubeWatchApi의 중앙 집중식 구독 관리자
 */
export const DaemonSetsCommonTable = withInjectables<Dependencies>(NonInjectedDaemonSetsCommonTable, {
  getProps: (di, props) => ({
    ...props,
    daemonSetStore: di.inject(daemonSetStoreInjectable),
    namespaceStore: di.inject(namespaceStoreInjectable),
    eventStore: di.inject(eventStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
  }),
});
