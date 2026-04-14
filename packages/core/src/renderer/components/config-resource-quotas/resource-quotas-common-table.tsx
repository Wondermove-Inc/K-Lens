/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ResourceQuota 목록 테이블 - CommonTable 패턴 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Resource Quotas {count} items, 네임스페이스 드롭다운, 검색 입력, Add 버튼)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - AddQuotaDialog 통합 (Add 버튼 클릭 시 열림)
 * - MobX observable resourceQuotaStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → resourceQuotaStore.items.slice() 변환
 * - 컬럼 정의는 resource-quotas-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 * - 반응형 디자인 (Pod 패턴 준수)
 *
 * 🔄 변경이력:
 * - 2025-10-30: CommonTable 패턴으로 마이그레이션 (shadcn UI + Add 버튼)
 * - 2025-10-31: ResourceTableLayout 적용 (상단 메뉴 공통화)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Plus, Trash2 } from "lucide-react";
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
import openAddQuotaDialogInjectable from "./add-dialog/open.injectable";
import { ResourceQuotaDetailPanel } from "./resource-quota-detail-panel";
import { resourceQuotaColumns } from "./resource-quotas-columns";
import resourceQuotaStoreInjectable from "./store.injectable";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { ResourceQuotaStore } from "./store";

/**
 * 🎯 목적: ResourceQuotasCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  resourceQuotaStore: ResourceQuotaStore;
  dockStore: DockStore;
  openAddQuotaDialog: () => void;
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
  quotaMenuBar: 65, // ResourceQuotas 상단 메뉴
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.quotaMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: ResourceQuota 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (resourceQuotaStore, dockStore, openAddQuotaDialog, className)
 * @returns KubeDataTable 기반 ResourceQuota 목록 테이블
 */
const NonInjectedResourceQuotasCommonTable = observer(
  ({ resourceQuotaStore, dockStore, openAddQuotaDialog, className, subscribeStores }: Dependencies) => {
    // resourceQuotaStore.contextItems는 MobX computed getter (namespace 필터링된 데이터)
    const quotas = resourceQuotaStore.contextItems;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedQuota, setSelectedQuota] = useState<(typeof quotas)[0] | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof quotas)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: ResourceQuota Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([resourceQuotaStore], {
        onLoadFailure: (error) => console.error("[ResourceQuota] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [resourceQuotaStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - contextItems가 이미 namespace 필터링 수행
     * - MobX observable 배열을 순수 배열로 변환
     * - 검색 필터: Name, Namespace 기준
     */
    const filteredQuotas = React.useMemo(() => {
      // MobX observable 배열을 순수 배열로 변환 (KubeDataTable 요구사항)
      let filtered = quotas.slice();

      // 검색 필터 (Name, Namespace 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (quota) => quota.getName().toLowerCase().includes(search) || quota.getNs().toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [quotas, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: ResourceQuota 행 클릭 핸들러 (Detail Panel 토글)
     * @param quota - 클릭된 ResourceQuota 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (quota: (typeof quotas)[0]) => {
      if (selectedQuota?.getId() === quota.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedQuota(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedQuota(quota);
        setIsPanelOpen(true);
      }
    };

    const handleSelectionChange = (selectedItems: (typeof quotas)[number][]) => {
      setSelectedRows(selectedItems);
    };

    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
      try {
        await Promise.all(
          selectedRows.map(async (quota) => {
            await resourceQuotaStore.remove(quota);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[ResourceQuota] Failed to delete:", error);
      }
    };

    return (
      <div className={className || ""}>
        <ResourceTableLayout
          title="Resource Quotas"
          itemCount={filteredQuotas.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search quotas..."
          className={className}
          headerActions={
            <>
              <Button variant="default" onClick={openAddQuotaDialog} className="gap-2 !px-4">
                <Plus className="h-4 w-4" />
                Add
              </Button>
              {selectedCount > 0 && (
                <Button
                  variant="secondary"
                  onClick={handleDeleteClick}
                  className="!bg-secondary !text-destructive gap-2 !px-4"
                >
                  <Trash2 className="!text-destructive h-4 w-4" />
                  Delete ({selectedCount})
                </Button>
              )}
            </>
          }
        >
          <KubeDataTable
            data={filteredQuotas}
            columns={resourceQuotaColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage="No Resource Quotas found"
            className="h-full"
            selectedItem={isPanelOpen ? selectedQuota : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 ResourceQuota Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <ResourceQuotaDetailPanel isOpen={isPanelOpen} quota={selectedQuota} onClose={() => setIsPanelOpen(false)} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Resource Quotas</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Resource Quota(s)?
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
 * 🎯 목적: ResourceQuotasCommonTable 컴포넌트 (Injectable DI 적용)
 */
export const ResourceQuotasCommonTable = withInjectables<Dependencies>(NonInjectedResourceQuotasCommonTable, {
  getProps: (di, props) => ({
    ...props,
    resourceQuotaStore: di.inject(resourceQuotaStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    openAddQuotaDialog: di.inject(openAddQuotaDialogInjectable),
  }),
});
