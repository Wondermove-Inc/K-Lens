/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Leases 공통 테이블 컴포넌트 (shadcn UI + TanStack Table 사용)
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 *   - 2025-10-31: ResourceTableLayout 적용 (네임스페이스 필터, 검색 추가)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useState } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { KubeDataTable } from "../common/kube-data-table/kube-data-table";
import { ResourceContextMenu } from "../common/resource-context-menu";
import { ResourceTableLayout } from "../common/resource-table-layout";
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
import { LeaseDetailPanel } from "./lease-detail-panel";
import { leaseColumns } from "./leases-columns";
import leaseStoreInjectable from "./store.injectable";

import type { Lease } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { LeaseStore } from "./store";

export interface LeasesCommonTableProps {
  title?: string;
}

interface Dependencies {
  leaseStore: LeaseStore;
  subscribeStores: SubscribeStores;
}

const NonInjectedLeasesCommonTable = observer(
  ({ title = "Leases", leaseStore, subscribeStores }: LeasesCommonTableProps & Dependencies) => {
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedLease, setSelectedLease] = useState<Lease | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<Lease[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // 🔄 Kubernetes API 구독: Leases 데이터 자동 로딩
    useEffect(() => {
      const unsubscribe = subscribeStores([leaseStore], {
        onLoadFailure: (error) => console.error("[Leases] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [leaseStore, subscribeStores]);

    const leases = leaseStore.contextItems.slice();

    const filteredLeases = useMemo(() => {
      let filtered = leases;

      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (lease) => lease.getName().toLowerCase().includes(search) || lease.getNs().toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [leases, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: Lease 행 클릭 핸들러 (Detail Panel 열기)
     * @param lease - 클릭된 Lease 객체
     */
    const handleRowClick = (lease: Lease) => {
      setSelectedLease(lease);
      setIsPanelOpen(true);
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Lease 배열
     */
    const handleSelectionChange = (selectedItems: Lease[]) => {
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
          selectedRows.map(async (lease) => {
            await leaseStore.remove(lease);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[Lease] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title={title}
          itemCount={filteredLeases.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search leases..."
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
            data={filteredLeases}
            columns={leaseColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            getRowId={(row) => row.getId()}
            emptyMessage="No Leases found"
            selectedItem={isPanelOpen ? selectedLease : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Lease Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <LeaseDetailPanel isOpen={isPanelOpen} lease={selectedLease} onClose={() => setIsPanelOpen(false)} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Leases</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Lease(s)?
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
      </>
    );
  },
);

export const LeasesCommonTable = withInjectables<Dependencies, LeasesCommonTableProps>(NonInjectedLeasesCommonTable, {
  getProps: (di, props) => ({
    ...props,
    leaseStore: di.inject(leaseStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
  }),
});
