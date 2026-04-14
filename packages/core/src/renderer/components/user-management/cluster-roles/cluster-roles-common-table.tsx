/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Cluster Role 목록 테이블 - ResourceTableLayout 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (제목, 검색)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable clusterRoleStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → clusterRoleStore.items.slice() 변환
 * - 컬럼 정의는 cluster-roles-columns.tsx에서 import
 * - Cluster Role은 클러스터 레벨 리소스이므로 네임스페이스 필터 없음
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (KubeDataTable 기반 구현, Storage 패턴 참조)
 * - 2025-11-01: ResourceTableLayout 적용 (shadcn Select 네임스페이스 필터 통합)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Plus, Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useState } from "react";
import subscribeStoresInjectable from "../../../kube-watch-api/subscribe-stores.injectable";
import { KubeDataTable } from "../../common/kube-data-table/kube-data-table";
import { ResourceContextMenu } from "../../common/resource-context-menu";
import { ResourceTableLayout } from "../../common/resource-table-layout";
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
import openAddClusterRoleDialogInjectable from "./add-dialog/open.injectable";
import { ClusterRoleDetailPanel } from "./cluster-role-detail-panel";
import { clusterRoleColumns } from "./cluster-roles-columns";
import clusterRoleStoreInjectable from "./store.injectable";

import type { ClusterRole } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../../kube-watch-api/kube-watch-api";
import type { ClusterRoleStore } from "./store";

/**
 * 🎯 목적: ClusterRolesCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  clusterRoleStore: ClusterRoleStore;
  subscribeStores: SubscribeStores;
  openAddClusterRoleDialog: () => void;
  className?: string;
}

/**
 * 🎯 목적: Cluster Role 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (clusterRoleStore, subscribeStores, openAddClusterRoleDialog, className)
 * @returns KubeDataTable 기반 Cluster Role 목록 테이블
 */
const NonInjectedClusterRolesCommonTable = observer(
  ({ clusterRoleStore, subscribeStores, openAddClusterRoleDialog, className }: Dependencies) => {
    // clusterRoleStore.items는 MobX observable 배열
    const clusterRoles = clusterRoleStore.items.slice();

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [selectedClusterRole, setSelectedClusterRole] = useState<ClusterRole | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof clusterRoles)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - clusterRoleStore를 구독하여 데이터 자동 로드
     * - 언마운트 시 구독 자동 해제
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([clusterRoleStore], {
        onLoadFailure: (error) => {
          console.error("[ClusterRoles] Failed to load cluster roles:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [clusterRoleStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링 (Name 기준)
     */
    const filteredClusterRoles = useMemo(() => {
      if (!searchValue.trim()) {
        return clusterRoles;
      }

      const search = searchValue.toLowerCase();
      return clusterRoles.filter((cr) => {
        const name = cr.getName().toLowerCase();
        return name.includes(search);
      });
    }, [clusterRoles, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: ClusterRole 행 클릭 핸들러 (Detail Panel 토글)
     * @param clusterRole - 클릭된 ClusterRole 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (clusterRole: ClusterRole) => {
      if (selectedClusterRole?.getId() === clusterRole.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedClusterRole(undefined);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedClusterRole(clusterRole);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 ClusterRole 배열
     */
    const handleSelectionChange = (selectedItems: (typeof clusterRoles)[number][]) => {
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
          selectedRows.map(async (clusterRole) => {
            await clusterRoleStore.remove(clusterRole);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[ClusterRole] Failed to delete:", error);
      }
    };

    return (
      <ResourceTableLayout
        title="Cluster Roles"
        itemCount={filteredClusterRoles.length}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by name..."
        showNamespaceFilter={false}
        headerActions={
          <>
            <Button variant="default" onClick={openAddClusterRoleDialog} className="gap-2 !px-4">
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
        <KubeDataTable
          columns={clusterRoleColumns}
          enableRowSelection={true}
          enablePagination={true}
          defaultPageSize={40}
          getRowId={(item) => item.getId()}
          data={filteredClusterRoles}
          emptyMessage="No Cluster Roles found"
          onRowClick={handleRowClick}
          onSelectionChange={handleSelectionChange}
          selectedItem={selectedClusterRole}
          renderContextMenu={(item) => <ResourceContextMenu object={item} />}
        />

        <ClusterRoleDetailPanel
          isOpen={!!selectedClusterRole}
          clusterRole={selectedClusterRole}
          onClose={() => setSelectedClusterRole(undefined)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Cluster Roles</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Cluster Role(s)?
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
export const ClusterRolesCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "clusterRoleStore" | "subscribeStores" | "openAddClusterRoleDialog">
>(NonInjectedClusterRolesCommonTable, {
  getProps: (di, props) => ({
    clusterRoleStore: di.inject(clusterRoleStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    openAddClusterRoleDialog: di.inject(openAddClusterRoleDialogInjectable),
    ...props,
  }),
});
