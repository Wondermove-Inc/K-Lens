/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Persistent Volume 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (상단 메뉴: 제목, 카운트, 검색 입력, Add 버튼)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable persistentVolumeStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → persistentVolumeStore.items.slice() 변환
 * - 컬럼 정의는 persistent-volumes-columns.tsx에서 import
 * - PV는 cluster-scoped 리소스이므로 네임스페이스 필터 없음
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
import { PersistentVolumeDetailPanel } from "./persistent-volume-detail-panel";
import { persistentVolumeColumns } from "./persistent-volumes-columns";
import persistentVolumeStoreInjectable from "./store.injectable";

import type { PersistentVolume } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { PersistentVolumeStore } from "./store";

/**
 * 🎯 목적: PersistentVolumesCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  persistentVolumeStore: PersistentVolumeStore;
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
  pvMenuBar: 65, // PersistentVolumesCommonTable 상단 메뉴 (제목, 검색)
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.pvMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: Persistent Volume 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (persistentVolumeStore, dockStore, className)
 * @returns KubeDataTable 기반 Persistent Volume 목록 테이블
 */
const NonInjectedPersistentVolumesCommonTable = observer(
  ({ persistentVolumeStore, subscribeStores, dockStore, className }: Dependencies) => {
    // persistentVolumeStore.items는 MobX observable 배열
    const persistentVolumes = persistentVolumeStore.items;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [selectedPv, setSelectedPv] = useState<PersistentVolume | undefined>(undefined);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedRows, setSelectedRows] = useState<(typeof persistentVolumes)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - persistentVolumeStore를 구독하여 데이터 자동 로드
     * - 언마운트 시 구독 자동 해제
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([persistentVolumeStore], {
        onLoadFailure: (error) => {
          console.error("[PersistentVolumes] Failed to load persistent volumes:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [persistentVolumeStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - MobX observable 배열을 순수 배열로 변환 (KubeDataTable 요구사항)
     * - 검색 필터: Name, StorageClass, Claim 기준
     * - ⚠️ useMemo dependency에 .length 추가: MobX observable 배열 내용 변경 감지
     */
    const filteredPersistentVolumes = React.useMemo(() => {
      // MobX observable 배열을 순수 배열로 변환
      let filtered = persistentVolumes.slice();

      // 검색 필터 (Name, StorageClass, Claim 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter((pv) => {
          const name = pv.getName().toLowerCase();
          const storageClass = pv.getStorageClass().toLowerCase();
          const claimName = pv.getClaimRefName()?.toLowerCase() || "";

          return name.includes(search) || storageClass.includes(search) || claimName.includes(search);
        });
      }

      return filtered;
    }, [persistentVolumes, persistentVolumes.length, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 PersistentVolume 배열
     */
    const handleSelectionChange = (selectedItems: (typeof persistentVolumes)[number][]) => {
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
          selectedRows.map(async (pv) => {
            await persistentVolumeStore.remove(pv);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[PersistentVolume] Failed to delete:", error);
      }
    };

    /**
     * 🎯 목적: 테이블 행 클릭 핸들러 (토글 동작)
     * 📝 주의사항:
     * - 같은 행 클릭 시: 패널 닫기
     * - 다른 행 클릭 시: 패널 열고 해당 행 표시
     */
    const handleRowClick = (pv: PersistentVolume) => {
      if (selectedPv?.getId() === pv.getId()) {
        // 같은 행 클릭 → 패널 닫기
        setIsPanelOpen(false);
        setSelectedPv(undefined);
      } else {
        // 다른 행 클릭 → 패널 열고 해당 행 표시
        setSelectedPv(pv);
        setIsPanelOpen(true);
      }
    };

    return (
      <ResourceTableLayout
        title="Persistent Volumes"
        itemCount={filteredPersistentVolumes.length}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by name, storage class, or claim..."
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
        {/* 🎯 KubeDataTable: Persistent Volume 목록 테이블 */}
        {/* 📝 로딩 상태 확인: store.isLoaded가 false일 때 Skeleton 표시 */}
        {/* ============================================ */}
        {!persistentVolumeStore.isLoaded ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <KubeDataTable
            data={filteredPersistentVolumes}
            columns={persistentVolumeColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            emptyMessage="No Persistent Volumes found"
            className="h-full"
            selectedItem={selectedPv}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        )}

        {/* ============================================ */}
        {/* 🎯 DetailPanel: PV 상세 정보 표시 */}
        {/* ============================================ */}
        <PersistentVolumeDetailPanel
          isOpen={isPanelOpen}
          pv={selectedPv}
          onClose={() => {
            setIsPanelOpen(false);
            setSelectedPv(undefined);
          }}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Persistent Volumes</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Persistent Volume(s)?
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
export const PersistentVolumesCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "persistentVolumeStore" | "subscribeStores" | "dockStore">
>(NonInjectedPersistentVolumesCommonTable, {
  getProps: (di, props) => ({
    persistentVolumeStore: di.inject(persistentVolumeStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    dockStore: di.inject(dockStoreInjectable),
    ...props,
  }),
});
