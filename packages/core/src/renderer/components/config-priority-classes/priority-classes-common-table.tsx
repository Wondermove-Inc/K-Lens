/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Priority Classes 공통 테이블 컴포넌트 (shadcn UI + TanStack Table 사용)
 *
 * 📱 반응형 디자인:
 * - 모바일 (<640px): flex-col, w-full
 * - 태블릿 (≥640px): sm:flex-row, sm:w-48
 * - 데스크톱 (≥768px): md:w-64
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
import { PriorityClassDetailPanel } from "./priority-class-detail-panel";
import { priorityClassColumns } from "./priority-classes-columns";
import priorityClassStoreInjectable from "./store.injectable";

import type { PriorityClass } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { PriorityClassStore } from "./store";

export interface PriorityClassesCommonTableProps {
  title?: string;
}

interface Dependencies {
  priorityClassStore: PriorityClassStore;
  subscribeStores: SubscribeStores;
}

const NonInjectedPriorityClassesCommonTable = observer(
  ({
    title = "Priority Classes",
    priorityClassStore,
    subscribeStores,
  }: PriorityClassesCommonTableProps & Dependencies) => {
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedPriorityClass, setSelectedPriorityClass] = useState<PriorityClass | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<PriorityClass[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // 🔄 Kubernetes API 구독: Priority Classes 데이터 자동 로딩
    useEffect(() => {
      const unsubscribe = subscribeStores([priorityClassStore], {
        onLoadFailure: (error) => console.error("[PriorityClasses] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [priorityClassStore, subscribeStores]);

    const priorityClasses = priorityClassStore.items.slice();

    const filteredPriorityClasses = useMemo(() => {
      let filtered = priorityClasses;

      // 검색 필터 (Name 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter((pc) => pc.getName().toLowerCase().includes(search));
      }

      return filtered;
    }, [priorityClasses, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: PriorityClass 행 클릭 핸들러 (Detail Panel 토글)
     * @param pc - 클릭된 PriorityClass 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (pc: PriorityClass) => {
      if (selectedPriorityClass?.getId() === pc.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedPriorityClass(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedPriorityClass(pc);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 PriorityClass 배열
     */
    const handleSelectionChange = (selectedItems: PriorityClass[]) => {
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
          selectedRows.map(async (pc) => {
            await priorityClassStore.remove(pc);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[PriorityClass] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title={title}
          itemCount={filteredPriorityClasses.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search priority classes..."
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
            data={filteredPriorityClasses}
            columns={priorityClassColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            getRowId={(row) => row.getId()}
            emptyMessage="No Priority Classes found"
            selectedItem={isPanelOpen ? selectedPriorityClass : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 PriorityClass Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <PriorityClassDetailPanel
          isOpen={isPanelOpen}
          priorityClass={selectedPriorityClass}
          onClose={() => setIsPanelOpen(false)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Priority Classes</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Priority Class(es)?
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

export const PriorityClassesCommonTable = withInjectables<Dependencies, PriorityClassesCommonTableProps>(
  NonInjectedPriorityClassesCommonTable,
  {
    getProps: (di, props) => ({
      ...props,
      priorityClassStore: di.inject(priorityClassStoreInjectable),
      subscribeStores: di.inject(subscribeStoresInjectable),
    }),
  },
);
