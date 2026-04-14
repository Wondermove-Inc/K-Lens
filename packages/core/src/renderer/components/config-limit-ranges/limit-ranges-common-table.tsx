/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: LimitRange 목록 테이블 - CommonTable 패턴 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Limit Ranges {count} items, 네임스페이스 드롭다운, 검색 입력)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable limitRangeStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → limitRangeStore.items.slice() 변환
 * - 컬럼 정의는 limit-ranges-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 * - 반응형 디자인 (Pod 패턴 준수)
 *
 * 🔄 변경이력:
 * - 2025-10-30: CommonTable 패턴으로 마이그레이션 (shadcn UI)
 * - 2025-10-31: ResourceTableLayout 적용 (상단 메뉴 공통화)
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
import { LimitRangeDetailPanel } from "./limit-range-detail-panel";
import { limitRangeColumns } from "./limit-ranges-columns";
import limitRangeStoreInjectable from "./store.injectable";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { LimitRangeStore } from "./store";

/**
 * 🎯 목적: LimitRangesCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  limitRangeStore: LimitRangeStore;
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
  limitRangeMenuBar: 65, // LimitRanges 상단 메뉴
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.limitRangeMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: LimitRange 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (limitRangeStore, dockStore, className)
 * @returns KubeDataTable 기반 LimitRange 목록 테이블
 */
const NonInjectedLimitRangesCommonTable = observer(
  ({ limitRangeStore, dockStore, className, subscribeStores }: Dependencies) => {
    // limitRangeStore.contextItems는 MobX computed getter (namespace 필터링된 데이터)
    const limitRanges = limitRangeStore.contextItems;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedLimitRange, setSelectedLimitRange] = useState<(typeof limitRanges)[0] | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof limitRanges)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: LimitRange Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([limitRangeStore], {
        onLoadFailure: (error) => console.error("[LimitRange] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [limitRangeStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - contextItems가 이미 namespace 필터링 수행
     * - MobX observable 배열을 순수 배열로 변환
     * - 검색 필터: Name, Namespace 기준
     */
    const filteredLimitRanges = React.useMemo(() => {
      // MobX observable 배열을 순수 배열로 변환 (KubeDataTable 요구사항)
      let filtered = limitRanges.slice();

      // 검색 필터 (Name, Namespace 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (lr) => lr.getName().toLowerCase().includes(search) || lr.getNs().toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [limitRanges, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: LimitRange 행 클릭 핸들러 (Detail Panel 토글)
     * @param limitRange - 클릭된 LimitRange 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (limitRange: (typeof limitRanges)[0]) => {
      if (selectedLimitRange?.getId() === limitRange.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedLimitRange(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedLimitRange(limitRange);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 LimitRange 배열
     */
    const handleSelectionChange = (selectedItems: (typeof limitRanges)[number][]) => {
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
          selectedRows.map(async (limitRange) => {
            await limitRangeStore.remove(limitRange);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[LimitRange] Failed to delete:", error);
      }
    };

    return (
      <div className={className || ""}>
        <ResourceTableLayout
          title="Limit Ranges"
          itemCount={filteredLimitRanges.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search limit ranges..."
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
          <KubeDataTable
            data={filteredLimitRanges}
            columns={limitRangeColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage="No Limit Ranges found"
            className="h-full"
            selectedItem={isPanelOpen ? selectedLimitRange : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 LimitRange Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <LimitRangeDetailPanel
          isOpen={isPanelOpen}
          limitRange={selectedLimitRange}
          onClose={() => setIsPanelOpen(false)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Limit Ranges</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Limit Range(s)?
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
 * 🎯 목적: LimitRangesCommonTable 컴포넌트 (Injectable DI 적용)
 */
export const LimitRangesCommonTable = withInjectables<Dependencies>(NonInjectedLimitRangesCommonTable, {
  getProps: (di, props) => ({
    ...props,
    limitRangeStore: di.inject(limitRangeStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
  }),
});
