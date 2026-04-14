/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Namespace 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Namespaces {count} items, 검색 입력, Add Namespace 버튼)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable namespaceStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📱 반응형 디자인:
 * - 모바일 (<640px): 세로 레이아웃, 전체 너비
 * - 태블릿 (≥640px): 가로 레이아웃, 검색 192px
 * - 데스크톱 (≥768px): 검색 256px
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → namespaceStore.items.slice() 변환
 * - 컬럼 정의는 namespaces-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 * - 검색 필터: getSearchFields(), getStatus() 기준
 * - Namespaces는 Cluster-scoped 리소스이므로 네임스페이스 필터 없음
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
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
import openAddNamespaceDialogInjectable from "./add-dialog/open.injectable";
import { NamespaceDetailPanel } from "./namespace-detail-panel";
import { namespaceColumns } from "./namespaces-columns";
import requestDeleteNamespaceInjectable from "./request-delete-namespace.injectable";
import namespaceStoreInjectable from "./store.injectable";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { RequestDeleteNamespace } from "./request-delete-namespace.injectable";
import type { NamespaceStore } from "./store";

/**
 * 🎯 목적: NamespaceCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  namespaceStore: NamespaceStore;
  subscribeStores: SubscribeStores;
  dockStore: DockStore;
  openAddNamespaceDialog: () => void;
  requestDeleteNamespace: RequestDeleteNamespace;
  className?: string;
}

/**
 * 🎯 목적: 레이아웃 높이 상수 (Pod과 동일한 오프셋)
 *
 * @remarks
 * 테이블 maxHeight 계산을 위한 정확한 오프셋 값
 * - calc(100vh - TOTAL_TABLE_OFFSET - dockHeight)
 */
const LAYOUT_OFFSETS = {
  clusterManagerHeader: 40, // ClusterManager Header
  statusBar: 21, // StatusBar
  mainLayoutTabs: 36, // MainTabContainer (탭)
  menuBar: 65, // 상단 메뉴 (제목, 검색, Add 버튼)
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.menuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: Namespace 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (namespaceStore, dockStore, openAddNamespaceDialog, requestDeleteNamespace, className)
 * @returns KubeDataTable 기반 Namespace 목록 테이블
 */
const NonInjectedNamespaceCommonTable = observer(
  ({
    namespaceStore,
    subscribeStores,
    dockStore,
    openAddNamespaceDialog,
    requestDeleteNamespace,
    className,
  }: Dependencies) => {
    // namespaceStore.items는 MobX observable 배열
    const namespaces = namespaceStore.items;

    /**
     * 🎯 목적: Kubernetes Watch API 구독 (실시간 업데이트)
     *
     * @remarks
     * - namespaceStore의 변경사항을 Watch API로 구독
     * - 컴포넌트 언마운트 시 구독 해제
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([namespaceStore], {
        onLoadFailure: (error) => {
          console.error("[Namespaces] Failed to load namespaces:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [namespaceStore, subscribeStores]);

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedNamespace, setSelectedNamespace] = useState<(typeof namespaces)[0] | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof namespaces)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - MobX observable 배열을 순수 배열로 변환 (KubeDataTable 요구사항)
     * - getSearchFields(), getStatus() 기준 검색
     */
    const filteredNamespaces = React.useMemo(() => {
      // MobX observable 배열을 순수 배열로 변환
      let filtered = namespaces.slice();

      // 검색 필터 (getSearchFields + Status 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (ns) =>
            ns.getSearchFields().some((field) => field && field.toLowerCase().includes(search)) ||
            ns.getStatus().toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [namespaces, searchValue]);

    /**
     * 🎯 목적: Namespace 행 클릭 핸들러 (Detail Panel 토글)
     * @param namespace - 클릭된 Namespace 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (namespace: (typeof namespaces)[0]) => {
      if (selectedNamespace?.getId() === namespace.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedNamespace(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedNamespace(namespace);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: Detail Panel 닫기 핸들러
     */
    const handleClosePanel = () => {
      setIsPanelOpen(false);
      setSelectedNamespace(undefined);
    };

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Namespace 배열
     */
    const handleSelectionChange = (selectedItems: (typeof namespaces)[number][]) => {
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
          selectedRows.map(async (item) => {
            await namespaceStore.remove(item);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[Namespace] Failed to delete:", error);
      }
    };

    return (
      <div className={`flex h-full w-full flex-col ${className || ""}`}>
        <ResourceTableLayout
          title="Namespaces"
          itemCount={filteredNamespaces.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search namespaces..."
          showNamespaceFilter={false}
          headerActions={
            <>
              <Button variant="default" onClick={openAddNamespaceDialog} className="gap-2 !px-4">
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
          {/* ============================================ */}
          {/* 🎯 KubeDataTable: Namespace 목록 테이블 */}
          {/* ============================================ */}
          <div className="flex-1">
            <KubeDataTable
              data={filteredNamespaces}
              columns={namespaceColumns}
              enableColumnResizing={true}
              enableRowSelection={true}
              enablePagination={true}
              defaultPageSize={40}
              getRowId={(item) => item.getId()}
              onRowClick={handleRowClick}
              onSelectionChange={handleSelectionChange}
              dockHeight={dockStore.isOpen ? dockStore.height : 0}
              tableOffset={TOTAL_TABLE_OFFSET}
              emptyMessage="No Namespaces found"
              className="h-full"
              selectedItem={isPanelOpen ? selectedNamespace : undefined}
              renderContextMenu={(item) => <ResourceContextMenu object={item} />}
            />
          </div>
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 우측 슬라이드 패널: Namespace 상세 정보 */}
        {/* ============================================ */}
        <NamespaceDetailPanel isOpen={isPanelOpen} namespace={selectedNamespace} onClose={handleClosePanel} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Namespaces</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Namespace(s)?
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
 * 🎯 목적: Injectable로 감싼 NamespaceCommonTable 컴포넌트
 */
export const NamespaceCommonTable = withInjectables<
  Dependencies,
  Omit<
    Dependencies,
    "namespaceStore" | "subscribeStores" | "dockStore" | "openAddNamespaceDialog" | "requestDeleteNamespace"
  >
>(NonInjectedNamespaceCommonTable, {
  getProps: (di, props) => ({
    namespaceStore: di.inject(namespaceStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    dockStore: di.inject(dockStoreInjectable),
    openAddNamespaceDialog: di.inject(openAddNamespaceDialogInjectable),
    requestDeleteNamespace: di.inject(requestDeleteNamespaceInjectable),
    ...props,
  }),
});
