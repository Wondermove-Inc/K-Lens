/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Storage Class 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (상단 메뉴: 제목, 카운트, 검색 입력, Add 버튼)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable storageClassStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → storageClassStore.items.slice() 변환
 * - 컬럼 정의는 storage-classes-columns.tsx에서 import
 * - Storage Class는 cluster-scoped 리소스이므로 네임스페이스 필터 없음
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (KubeDataTable 기반 구현, StatefulSets 패턴 참조)
 * - 2025-11-05: ResourceTableLayout 패턴으로 마이그레이션
 */

// import { Button } from "@skuberplus/storybook-shadcn"; // Add 버튼 복구 시 주석 해제
import { withInjectables } from "@ogre-tools/injectable-react";
import { Trash2 } from "lucide-react";
// import { Plus } from "lucide-react"; // Add 버튼 복구 시 주석 해제
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
import { Skeleton } from "../shadcn-ui/skeleton";
import { StorageClassDetailPanel } from "./storage-class-detail-panel";
import { storageClassColumns } from "./storage-classes-columns";
import storageClassStoreInjectable from "./store.injectable";

import type { StorageClass } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { StorageClassStore } from "./store";

/**
 * 🎯 목적: StorageClassesCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  storageClassStore: StorageClassStore;
  subscribeStores: SubscribeStores;
  dockStore: DockStore;
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
  scMenuBar: 65, // StorageClassesCommonTable 상단 메뉴 (제목, 검색)
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.scMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: Storage Class 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (storageClassStore, dockStore, className)
 * @returns KubeDataTable 기반 Storage Class 목록 테이블
 */
const NonInjectedStorageClassesCommonTable = observer(
  ({ storageClassStore, subscribeStores, dockStore, className }: Dependencies) => {
    // storageClassStore.items는 MobX observable 배열
    const storageClasses = storageClassStore.items;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [selectedSc, setSelectedSc] = useState<StorageClass | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof storageClasses)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - storageClassStore를 구독하여 데이터 자동 로드
     * - 언마운트 시 구독 자동 해제
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([storageClassStore], {
        onLoadFailure: (error) => {
          console.error("[StorageClasses] Failed to load storage classes:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [storageClassStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - MobX observable 배열을 순수 배열로 변환 (KubeDataTable 요구사항)
     * - 검색 필터: Name, Provisioner 기준
     * - ⚠️ useMemo dependency에 .length 추가: MobX observable 배열 내용 변경 감지
     */
    const filteredStorageClasses = React.useMemo(() => {
      // MobX observable 배열을 순수 배열로 변환
      let filtered = storageClasses.slice();

      // 검색 필터 (Name, Provisioner 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter((sc) => {
          const name = sc.getName().toLowerCase();
          const provisioner = sc.provisioner.toLowerCase();

          return name.includes(search) || provisioner.includes(search);
        });
      }

      return filtered;
    }, [storageClasses, storageClasses.length, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 동일 행 재클릭 시 DetailPanel 토글 (열림/닫힘)
     */
    const handleRowClick = React.useCallback((sc: StorageClass) => {
      setSelectedSc((current) => (current?.getId() === sc.getId() ? undefined : sc));
    }, []);

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 StorageClass 배열
     */
    const handleSelectionChange = (selectedItems: (typeof storageClasses)[number][]) => {
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
          selectedRows.map(async (sc) => {
            await storageClassStore.remove(sc);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[StorageClass] Failed to delete:", error);
      }
    };

    return (
      <ResourceTableLayout
        title="Storage Classes"
        itemCount={filteredStorageClasses.length}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by name or provisioner..."
        showNamespaceFilter={false} // cluster-scoped 리소스
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
        className={className}
      >
        {/* ============================================ */}
        {/* 🎯 KubeDataTable: Storage Class 목록 테이블 */}
        {/* 📝 로딩 상태 확인: store.isLoaded가 false일 때 Skeleton 표시 */}
        {/* ============================================ */}
        {!storageClassStore.isLoaded ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <KubeDataTable
            data={filteredStorageClasses}
            columns={storageClassColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            emptyMessage="No Storage Classes found"
            className="h-full"
            selectedItem={selectedSc}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        )}

        {/* ============================================ */}
        {/* 🎯 DetailPanel: StorageClass 상세 정보 표시 */}
        {/* ============================================ */}
        <StorageClassDetailPanel
          isOpen={!!selectedSc}
          storageClass={selectedSc}
          onClose={() => setSelectedSc(undefined)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Storage Classes</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Storage Class{selectedCount > 1 ? "es" : ""}?
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
 * 🎯 목적: Injectable DI 패턴으로 Dependencies 주입
 */
export const StorageClassesCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "storageClassStore" | "subscribeStores" | "dockStore">
>(NonInjectedStorageClassesCommonTable, {
  getProps: (di, props) => ({
    storageClassStore: di.inject(storageClassStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    dockStore: di.inject(dockStoreInjectable),
    ...props,
  }),
});
