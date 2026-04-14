/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: VPA 공통 테이블 컴포넌트 (shadcn UI + TanStack Table 사용)
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
import verticalPodAutoscalerStoreInjectable from "./store.injectable";
import { verticalPodAutoscalerColumns } from "./vpa-columns";
import { VpaDetailPanel } from "./vpa-detail-panel";

import type { VerticalPodAutoscaler } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { VerticalPodAutoscalerStore } from "./store";

export interface VerticalPodAutoscalersCommonTableProps {
  /**
   * 테이블 헤더 타이틀
   */
  title?: string;
}

interface Dependencies {
  verticalPodAutoscalerStore: VerticalPodAutoscalerStore;
  subscribeStores: SubscribeStores;
}

/**
 * VPA 공통 테이블 컴포넌트 (Injectable 없는 순수 컴포넌트)
 */
const NonInjectedVerticalPodAutoscalersCommonTable = observer(
  ({
    title = "Vertical Pod Autoscalers",
    verticalPodAutoscalerStore,
    subscribeStores,
  }: VerticalPodAutoscalersCommonTableProps & Dependencies) => {
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedVpa, setSelectedVpa] = useState<VerticalPodAutoscaler | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<VerticalPodAutoscaler[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // 🔄 Kubernetes API 구독: VPA 데이터 자동 로딩
    useEffect(() => {
      const unsubscribe = subscribeStores([verticalPodAutoscalerStore], {
        onLoadFailure: (error) => console.error("[VPA] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [verticalPodAutoscalerStore, subscribeStores]);

    const vpas = verticalPodAutoscalerStore.contextItems.slice() as VerticalPodAutoscaler[];

    const filteredVPAs = useMemo(() => {
      let filtered = vpas;

      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (vpa) => vpa.getName().toLowerCase().includes(search) || vpa.getNs().toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [vpas, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: VPA 행 클릭 핸들러 (Detail Panel 토글)
     * @param vpa - 클릭된 VerticalPodAutoscaler 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (vpa: VerticalPodAutoscaler) => {
      if (selectedVpa?.getId() === vpa.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedVpa(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedVpa(vpa);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 VPA 배열
     */
    const handleSelectionChange = (selectedItems: VerticalPodAutoscaler[]) => {
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
          selectedRows.map(async (vpa) => {
            await verticalPodAutoscalerStore.remove(vpa);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[VPA] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title={title}
          itemCount={filteredVPAs.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search VPAs..."
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
            data={filteredVPAs}
            columns={verticalPodAutoscalerColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            getRowId={(row) => row.getId()}
            emptyMessage="No Vertical Pod Autoscalers found"
            selectedItem={isPanelOpen ? selectedVpa : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 VPA Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <VpaDetailPanel isOpen={isPanelOpen} vpa={selectedVpa} onClose={() => setIsPanelOpen(false)} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Vertical Pod Autoscalers</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Vertical Pod Autoscaler(s)?
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
 * 🎯 목적: Injectable로 감싼 VerticalPodAutoscalersCommonTable 컴포넌트
 */
export const VerticalPodAutoscalersCommonTable = withInjectables<Dependencies, VerticalPodAutoscalersCommonTableProps>(
  NonInjectedVerticalPodAutoscalersCommonTable,
  {
    getProps: (di, props) => ({
      ...props,
      verticalPodAutoscalerStore: di.inject(verticalPodAutoscalerStoreInjectable),
      subscribeStores: di.inject(subscribeStoresInjectable),
    }),
  },
);
