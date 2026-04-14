/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Role 목록 테이블 - ResourceTableLayout 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (제목, 네임스페이스 필터, 검색)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable roleStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - roleStore.contextItems 사용 (namespaceStore와 자동 연동)
 * - 컬럼 정의는 roles-columns.tsx에서 import
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (KubeDataTable 기반 구현, Service Accounts 패턴 참조)
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
import openAddRoleDialogInjectable from "./add-dialog/open.injectable";
import { RoleDetailPanel } from "./role-detail-panel";
import { roleColumns } from "./roles-columns";
import roleStoreInjectable from "./store.injectable";

import type { Role } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../../kube-watch-api/kube-watch-api";
import type { RoleStore } from "./store";

/**
 * 🎯 목적: RolesCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  roleStore: RoleStore;
  subscribeStores: SubscribeStores;
  openAddRoleDialog: () => void;
  className?: string;
}

/**
 * 🎯 목적: Role 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (roleStore, subscribeStores, openAddRoleDialog, className)
 * @returns KubeDataTable 기반 Role 목록 테이블
 */
const NonInjectedRolesCommonTable = observer(
  ({ roleStore, subscribeStores, openAddRoleDialog, className }: Dependencies) => {
    // roleStore.contextItems는 namespaceStore와 자동 연동되는 MobX computed 배열
    const roles = roleStore.contextItems.slice();

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [selectedRole, setSelectedRole] = useState<Role | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof roles)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - roleStore를 구독하여 데이터 자동 로드
     * - namespace 변경 시 자동으로 재로드
     * - 언마운트 시 구독 자동 해제
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([roleStore], {
        onLoadFailure: (error) => {
          console.error("[Roles] Failed to load roles:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [roleStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링 (Name, Namespace 기준)
     */
    const filteredRoles = useMemo(() => {
      if (!searchValue.trim()) {
        return roles;
      }

      const search = searchValue.toLowerCase();
      return roles.filter((role) => {
        const name = role.getName().toLowerCase();
        const namespace = role.getNs().toLowerCase();

        return name.includes(search) || namespace.includes(search);
      });
    }, [roles, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: Role 행 클릭 핸들러 (Detail Panel 토글)
     * @param role - 클릭된 Role 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (role: Role) => {
      if (selectedRole?.getId() === role.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedRole(undefined);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedRole(role);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Role 배열
     */
    const handleSelectionChange = (selectedItems: (typeof roles)[number][]) => {
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
            await roleStore.remove(item);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[Roles] Failed to delete:", error);
      }
    };

    return (
      <ResourceTableLayout
        title="Roles"
        itemCount={filteredRoles.length}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by name or namespace..."
        showNamespaceFilter={true}
        className={className}
        headerActions={
          <>
            <Button variant="default" onClick={openAddRoleDialog} className="gap-2 !px-4">
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
          columns={roleColumns}
          enableRowSelection={true}
          enablePagination={true}
          defaultPageSize={40}
          getRowId={(item) => item.getId()}
          data={filteredRoles}
          emptyMessage="No Roles found"
          onRowClick={handleRowClick}
          onSelectionChange={handleSelectionChange}
          selectedItem={selectedRole}
          renderContextMenu={(item) => <ResourceContextMenu object={item} />}
        />

        <RoleDetailPanel isOpen={!!selectedRole} role={selectedRole} onClose={() => setSelectedRole(undefined)} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Roles</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Role(s)?
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
export const RolesCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "roleStore" | "subscribeStores" | "openAddRoleDialog">
>(NonInjectedRolesCommonTable, {
  getProps: (di, props) => ({
    roleStore: di.inject(roleStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    openAddRoleDialog: di.inject(openAddRoleDialogInjectable),
    ...props,
  }),
});
