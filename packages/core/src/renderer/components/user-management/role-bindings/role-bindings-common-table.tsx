/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: RoleBinding 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (상단 메뉴: 제목, 카운트, 네임스페이스 필터, 검색 입력, Add 버튼)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable roleBindingStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → roleBindingStore.contextItems.slice() 변환
 * - 컬럼 정의는 role-bindings-columns.tsx에서 import
 * - 검색 필터: getSearchFields(), getSubjectNames() 기준
 * - RoleBindings는 namespace-scoped 리소스이므로 네임스페이스 필터 표시
 *
 * 🔄 변경이력:
 * - 2025-11-05: 초기 생성 (Pods 패턴 기반, ResourceTableLayout 사용)
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
import roleStoreInjectable from "../roles/store.injectable";
import serviceAccountStoreInjectable from "../service-accounts/store.injectable";
import openRoleBindingDialogInjectable from "./dialog/open.injectable";
import { RoleBindingDetailPanel } from "./role-binding-detail-panel";
import { roleBindingColumns } from "./role-bindings-columns";
import roleBindingStoreInjectable from "./store.injectable";

import type { RoleBinding } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../../dock/dock/store";
import type { ClusterRoleStore } from "../cluster-roles/store";
import type { RoleStore } from "../roles/store";
import type { ServiceAccountStore } from "../service-accounts/store";
import type { OpenRoleBindingDialog } from "./dialog/open.injectable";
import type { RoleBindingStore } from "./store";

/**
 * 🎯 목적: RoleBindingCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  roleBindingStore: RoleBindingStore;
  roleStore: RoleStore;
  clusterRoleStore: ClusterRoleStore;
  serviceAccountStore: ServiceAccountStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  openRoleBindingDialog: OpenRoleBindingDialog;
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
  menuBar: 65, // 상단 메뉴 (제목, 네임스페이스 필터, 검색, Add 버튼)
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
 * 🎯 목적: RoleBinding 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (roleBindingStore, dockStore, openRoleBindingDialog, className)
 * @returns ResourceTableLayout + KubeDataTable 기반 RoleBinding 목록 테이블
 */
const NonInjectedRoleBindingCommonTable = observer(
  ({
    roleBindingStore,
    roleStore,
    clusterRoleStore,
    serviceAccountStore,
    dockStore,
    subscribeStores,
    openRoleBindingDialog,
    className,
  }: Dependencies) => {
    // roleBindingStore.contextItems는 MobX computed getter (namespace 필터링 자동 적용)
    const roleBindings = roleBindingStore.contextItems;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [selectedRoleBinding, setSelectedRoleBinding] = useState<RoleBinding | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<RoleBinding[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - roleBindingStore와 의존 스토어들을 구독하여 데이터 자동 로드
     * - namespace 변경 시 자동으로 재로드
     * - 언마운트 시 구독 자동 해제
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([roleBindingStore, roleStore, clusterRoleStore, serviceAccountStore], {
        onLoadFailure: (error) => {
          console.error("[RoleBindings] Failed to load role bindings:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [roleBindingStore, roleStore, clusterRoleStore, serviceAccountStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - roleBindingStore.contextItems가 이미 namespace 필터링 수행
     * - 검색 필터만 추가로 적용
     * - getSearchFields(), getSubjectNames() 기준 검색
     */
    const filteredRoleBindings = React.useMemo(() => {
      // MobX observable 배열을 순수 배열로 변환
      let filtered = roleBindings.slice();

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
    }, [roleBindings, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: RoleBinding 행 클릭 핸들러 (Detail Panel 토글)
     * @param roleBinding - 클릭된 RoleBinding 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (roleBinding: RoleBinding) => {
      if (selectedRoleBinding?.getId() === roleBinding.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedRoleBinding(undefined);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedRoleBinding(roleBinding);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 RoleBinding 배열
     */
    const handleSelectionChange = (selectedItems: RoleBinding[]) => {
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
          selectedRows.map(async (roleBinding) => {
            await roleBindingStore.remove(roleBinding);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[RoleBinding] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title="Role Bindings"
          itemCount={filteredRoleBindings.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search role bindings..."
          showNamespaceFilter={true} // namespace-scoped 리소스
          headerActions={
            <>
              <Button variant="default" onClick={() => openRoleBindingDialog()} className="gap-2 !px-4">
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
          {/* 🎯 KubeDataTable: RoleBinding 목록 테이블 */}
          {/* ============================================ */}
          <KubeDataTable
            data={filteredRoleBindings}
            columns={roleBindingColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            emptyMessage="No Role Bindings found"
            className="h-full"
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            selectedItem={selectedRoleBinding}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 DetailPanel: RoleBinding 상세 정보 */}
        {/* ============================================ */}
        <RoleBindingDetailPanel
          isOpen={!!selectedRoleBinding}
          roleBinding={selectedRoleBinding}
          onClose={() => setSelectedRoleBinding(undefined)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Role Bindings</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Role Binding(s)?
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
 * 🎯 목적: Injectable로 감싼 RoleBindingCommonTable 컴포넌트
 */
export const RoleBindingCommonTable = withInjectables<
  Dependencies,
  Omit<
    Dependencies,
    | "roleBindingStore"
    | "roleStore"
    | "clusterRoleStore"
    | "serviceAccountStore"
    | "dockStore"
    | "subscribeStores"
    | "openRoleBindingDialog"
  >
>(NonInjectedRoleBindingCommonTable, {
  getProps: (di, props) => ({
    roleBindingStore: di.inject(roleBindingStoreInjectable),
    roleStore: di.inject(roleStoreInjectable),
    clusterRoleStore: di.inject(clusterRoleStoreInjectable),
    serviceAccountStore: di.inject(serviceAccountStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    openRoleBindingDialog: di.inject(openRoleBindingDialogInjectable),
    ...props,
  }),
});
