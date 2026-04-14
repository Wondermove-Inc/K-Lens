/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterRoleBinding 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (상단 메뉴: 제목, 카운트, 검색 입력, Add 버튼)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable clusterRoleBindingStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → clusterRoleBindingStore.items.slice() 변환
 * - 컬럼 정의는 cluster-role-bindings-columns.tsx에서 import
 * - 검색 필터: getSearchFields(), getSubjectNames() 기준
 * - ClusterRoleBindings는 cluster-scoped 리소스이므로 네임스페이스 필터 없음
 *
 * 🔄 변경이력:
 * - 2025-11-05: 초기 생성 (RoleBindings 패턴 기반, ResourceTableLayout 사용)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Plus, Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import subscribeStoresInjectable from "../../../kube-watch-api/subscribe-stores.injectable";
import { KubeDataTable } from "../../common/kube-data-table/kube-data-table";
import { ResourceContextMenu } from "../../common/resource-context-menu";
import { ResourceTableLayout } from "../../common/resource-table-layout";
import dockStoreInjectable from "../../dock/dock/store.injectable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../shadcn-ui/alert-dialog";
import { Button } from "../../shadcn-ui/button";
import clusterRoleStoreInjectable from "../cluster-roles/store.injectable";
import serviceAccountStoreInjectable from "../service-accounts/store.injectable";
import { ClusterRoleBindingDetailPanel } from "./cluster-role-binding-detail-panel";
import { clusterRoleBindingColumns } from "./cluster-role-bindings-columns";
import openClusterRoleBindingDialogInjectable from "./dialog/open.injectable";
import clusterRoleBindingStoreInjectable from "./store.injectable";

import type { ClusterRoleBinding } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../../dock/dock/store";
import type { ClusterRoleStore } from "../cluster-roles/store";
import type { ServiceAccountStore } from "../service-accounts/store";
import type { OpenClusterRoleBindingDialog } from "./dialog/open.injectable";
import type { ClusterRoleBindingStore } from "./store";

/**
 * 🎯 목적: ClusterRoleBindingCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  clusterRoleBindingStore: ClusterRoleBindingStore;
  clusterRoleStore: ClusterRoleStore;
  serviceAccountStore: ServiceAccountStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  openClusterRoleBindingDialog: OpenClusterRoleBindingDialog;
  className?: string;
}

/**
 * 🎯 목적: 레이아웃 높이 상수 (Pods와 동일한 오프셋)
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
 * 🎯 목적: ClusterRoleBinding 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (clusterRoleBindingStore, dockStore, openClusterRoleBindingDialog, className)
 * @returns ResourceTableLayout + KubeDataTable 기반 ClusterRoleBinding 목록 테이블
 */
const NonInjectedClusterRoleBindingCommonTable = observer(
  ({
    clusterRoleBindingStore,
    clusterRoleStore,
    serviceAccountStore,
    dockStore,
    subscribeStores,
    openClusterRoleBindingDialog,
    className,
  }: Dependencies) => {
    // clusterRoleBindingStore.items는 MobX observable 배열 (cluster-scoped이므로 namespace 필터 없음)
    const clusterRoleBindings = clusterRoleBindingStore.items;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [selectedClusterRoleBinding, setSelectedClusterRoleBinding] = useState<ClusterRoleBinding | undefined>(
      undefined,
    );
    const [selectedRows, setSelectedRows] = useState<ClusterRoleBinding[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - clusterRoleBindingStore와 의존 스토어들을 구독하여 데이터 자동 로드
     * - 언마운트 시 구독 자동 해제
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([clusterRoleBindingStore, clusterRoleStore, serviceAccountStore], {
        onLoadFailure: (error) => {
          console.error("[ClusterRoleBindings] Failed to load cluster role bindings:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [clusterRoleBindingStore, clusterRoleStore, serviceAccountStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - getSearchFields(), getSubjectNames() 기준 검색
     */
    const filteredClusterRoleBindings = React.useMemo(() => {
      // MobX observable 배열을 순수 배열로 변환
      let filtered = clusterRoleBindings.slice();

      // 검색 필터 (getSearchFields + getSubjectNames 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (binding) =>
            binding.getSearchFields().some((field) => field && field.toLowerCase().includes(search)) ||
            (binding.getSubjectNames() && binding.getSubjectNames().toLowerCase().includes(search)),
        );
      }

      return filtered;
    }, [clusterRoleBindings, clusterRoleBindings.length, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: ClusterRoleBinding 행 클릭 핸들러 (Detail Panel 토글)
     * @param clusterRoleBinding - 클릭된 ClusterRoleBinding 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (clusterRoleBinding: ClusterRoleBinding) => {
      if (selectedClusterRoleBinding?.getId() === clusterRoleBinding.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedClusterRoleBinding(undefined);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedClusterRoleBinding(clusterRoleBinding);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 ClusterRoleBinding 배열
     */
    const handleSelectionChange = (selectedItems: ClusterRoleBinding[]) => {
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
          selectedRows.map(async (clusterRoleBinding) => {
            await clusterRoleBindingStore.remove(clusterRoleBinding);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[ClusterRoleBinding] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title="Cluster Role Bindings"
          itemCount={filteredClusterRoleBindings.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search cluster role bindings..."
          showNamespaceFilter={false} // cluster-scoped 리소스
          headerActions={
            <>
              <Button variant="default" onClick={() => openClusterRoleBindingDialog()} className="gap-2 !px-4">
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
          className={className}
        >
          {/* ============================================ */}
          {/* 🎯 KubeDataTable: ClusterRoleBinding 목록 테이블 */}
          {/* ============================================ */}
          <KubeDataTable
            data={filteredClusterRoleBindings}
            columns={clusterRoleBindingColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            emptyMessage="No Cluster Role Bindings found"
            className="h-full"
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            selectedItem={selectedClusterRoleBinding}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 DetailPanel: ClusterRoleBinding 상세 정보 */}
        {/* ============================================ */}
        <ClusterRoleBindingDetailPanel
          isOpen={!!selectedClusterRoleBinding}
          clusterRoleBinding={selectedClusterRoleBinding}
          onClose={() => setSelectedClusterRoleBinding(undefined)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Cluster Role Bindings</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Cluster Role Binding(s)?
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
 * 🎯 목적: Injectable로 감싼 ClusterRoleBindingCommonTable 컴포넌트
 */
export const ClusterRoleBindingCommonTable = withInjectables<
  Dependencies,
  Omit<
    Dependencies,
    | "clusterRoleBindingStore"
    | "clusterRoleStore"
    | "serviceAccountStore"
    | "dockStore"
    | "subscribeStores"
    | "openClusterRoleBindingDialog"
  >
>(NonInjectedClusterRoleBindingCommonTable, {
  getProps: (di, props) => ({
    clusterRoleBindingStore: di.inject(clusterRoleBindingStoreInjectable),
    clusterRoleStore: di.inject(clusterRoleStoreInjectable),
    serviceAccountStore: di.inject(serviceAccountStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    openClusterRoleBindingDialog: di.inject(openClusterRoleBindingDialogInjectable),
    ...props,
  }),
});
