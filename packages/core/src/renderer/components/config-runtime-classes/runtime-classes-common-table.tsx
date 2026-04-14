/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Runtime Classes 공통 테이블 컴포넌트 (shadcn UI + TanStack Table 사용)
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 *   - 2025-10-31: ResourceTableLayout 적용 (검색 추가, cluster-scoped 리소스)
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
import { RuntimeClassDetailPanel } from "./runtime-class-detail-panel";
import { runtimeClassColumns } from "./runtime-classes-columns";
import runtimeClassStoreInjectable from "./store.injectable";

import type { RuntimeClass } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { RuntimeClassStore } from "./store";

export interface RuntimeClassesCommonTableProps {
  title?: string;
}

interface Dependencies {
  runtimeClassStore: RuntimeClassStore;
  subscribeStores: SubscribeStores;
}

const NonInjectedRuntimeClassesCommonTable = observer(
  ({
    title = "Runtime Classes",
    runtimeClassStore,
    subscribeStores,
  }: RuntimeClassesCommonTableProps & Dependencies) => {
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedRuntimeClass, setSelectedRuntimeClass] = useState<RuntimeClass | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<RuntimeClass[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // 🔄 Kubernetes API 구독: Runtime Classes 데이터 자동 로딩
    useEffect(() => {
      const unsubscribe = subscribeStores([runtimeClassStore], {
        onLoadFailure: (error) => console.error("[RuntimeClasses] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [runtimeClassStore, subscribeStores]);

    const runtimeClasses = runtimeClassStore.items.slice();

    const filteredRuntimeClasses = useMemo(() => {
      let filtered = runtimeClasses;

      // 검색 필터 (Name 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter((rc) => rc.getName().toLowerCase().includes(search));
      }

      return filtered;
    }, [runtimeClasses, searchValue]);

    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: RuntimeClass 행 클릭 핸들러 (Detail Panel 토글)
     * @param rc - 클릭된 RuntimeClass 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (rc: RuntimeClass) => {
      if (selectedRuntimeClass?.getId() === rc.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedRuntimeClass(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedRuntimeClass(rc);
        setIsPanelOpen(true);
      }
    };

    const handleSelectionChange = (selectedItems: RuntimeClass[]) => {
      setSelectedRows(selectedItems);
    };

    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
      try {
        await Promise.all(
          selectedRows.map(async (rc) => {
            await runtimeClassStore.remove(rc);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[RuntimeClass] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title={title}
          itemCount={filteredRuntimeClasses.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search runtime classes..."
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
            data={filteredRuntimeClasses}
            columns={runtimeClassColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            getRowId={(row) => row.getId()}
            emptyMessage="No Runtime Classes found"
            selectedItem={isPanelOpen ? selectedRuntimeClass : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 RuntimeClass Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <RuntimeClassDetailPanel
          isOpen={isPanelOpen}
          runtimeClass={selectedRuntimeClass}
          onClose={() => setIsPanelOpen(false)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Runtime Classes</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Runtime Class(es)?
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

export const RuntimeClassesCommonTable = withInjectables<Dependencies, RuntimeClassesCommonTableProps>(
  NonInjectedRuntimeClassesCommonTable,
  {
    getProps: (di, props) => ({
      ...props,
      runtimeClassStore: di.inject(runtimeClassStoreInjectable),
      subscribeStores: di.inject(subscribeStoresInjectable),
    }),
  },
);
