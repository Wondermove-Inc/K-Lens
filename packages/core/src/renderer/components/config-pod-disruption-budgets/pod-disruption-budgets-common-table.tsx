/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: PDB 공통 테이블 컴포넌트 (shadcn UI + TanStack Table 사용)
 *
 * 📱 반응형 디자인:
 * - 모바일 (<640px): flex-col, w-full (세로 배치, 전체 너비)
 * - 태블릿 (≥640px): sm:flex-row, sm:w-48 (가로 배치, 192px 너비)
 * - 데스크톱 (≥768px): md:w-64 (256px 너비)
 *
 * 📝 주의사항:
 *   - MobX store의 items를 pure array로 변환 (.slice())
 *   - KubeDataTable에 정렬/필터/페이지네이션 위임
 *   - 선택된 행은 rowSelection state로 관리
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
import { PdbDetailPanel } from "./pdb-detail-panel";
import { podDisruptionBudgetColumns } from "./pod-disruption-budgets-columns";
import podDisruptionBudgetStoreInjectable from "./store.injectable";

import type { PodDisruptionBudget } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { PodDisruptionBudgetStore } from "./store";

export interface PodDisruptionBudgetsCommonTableProps {
  /**
   * 테이블 헤더 타이틀
   */
  title?: string;
}

interface Dependencies {
  podDisruptionBudgetStore: PodDisruptionBudgetStore;
  subscribeStores: SubscribeStores;
}

/**
 * PDB 공통 테이블 컴포넌트 (Injectable 없는 순수 컴포넌트)
 */
const NonInjectedPodDisruptionBudgetsCommonTable = observer(
  ({
    title = "Pod Disruption Budgets",
    podDisruptionBudgetStore,
    subscribeStores,
  }: PodDisruptionBudgetsCommonTableProps & Dependencies) => {
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedPdb, setSelectedPdb] = useState<PodDisruptionBudget | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<PodDisruptionBudget[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // 🔄 Kubernetes API 구독: PDB 데이터 자동 로딩
    useEffect(() => {
      const unsubscribe = subscribeStores([podDisruptionBudgetStore], {
        onLoadFailure: (error) => console.error("[PDB] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [podDisruptionBudgetStore, subscribeStores]);

    const pdbs = podDisruptionBudgetStore.contextItems.slice();

    const filteredPDBs = useMemo(() => {
      let filtered = pdbs;

      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (pdb) => pdb.getName().toLowerCase().includes(search) || pdb.getNs().toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [pdbs, searchValue]);

    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: PDB 행 클릭 핸들러 (Detail Panel 토글)
     * @param pdb - 클릭된 PodDisruptionBudget 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (pdb: PodDisruptionBudget) => {
      if (selectedPdb?.getId() === pdb.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedPdb(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedPdb(pdb);
        setIsPanelOpen(true);
      }
    };

    const handleSelectionChange = (selectedItems: PodDisruptionBudget[]) => {
      setSelectedRows(selectedItems);
    };

    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
      try {
        await Promise.all(
          selectedRows.map(async (pdb) => {
            await podDisruptionBudgetStore.remove(pdb);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[PDB] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title={title}
          itemCount={filteredPDBs.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search pod disruption budgets..."
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
            data={filteredPDBs}
            columns={podDisruptionBudgetColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage="No Pod Disruption Budgets found"
            selectedItem={isPanelOpen ? selectedPdb : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 PDB Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <PdbDetailPanel isOpen={isPanelOpen} pdb={selectedPdb} onClose={() => setIsPanelOpen(false)} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Pod Disruption Budgets</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Pod Disruption Budget(s)?
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

/**
 * 🎯 목적: Injectable로 감싼 PodDisruptionBudgetsCommonTable 컴포넌트
 */
export const PodDisruptionBudgetsCommonTable = withInjectables<Dependencies, PodDisruptionBudgetsCommonTableProps>(
  NonInjectedPodDisruptionBudgetsCommonTable,
  {
    getProps: (di, props) => ({
      ...props,
      podDisruptionBudgetStore: di.inject(podDisruptionBudgetStoreInjectable),
      subscribeStores: di.inject(subscribeStoresInjectable),
    }),
  },
);
