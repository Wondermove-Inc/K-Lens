/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Service Account 목록 테이블 - ResourceTableLayout 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (제목, 네임스페이스 필터, 검색)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable serviceAccountStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - serviceAccountStore.contextItems 사용 (namespaceStore와 자동 연동)
 * - 컬럼 정의는 service-accounts-columns.tsx에서 import
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (KubeDataTable 기반 구현, PVC 패턴 참조)
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
import openCreateServiceAccountDialogInjectable from "./create-dialog/open.injectable";
import { ServiceAccountDetailPanel } from "./service-account-detail-panel";
import { serviceAccountColumns } from "./service-accounts-columns";
import serviceAccountStoreInjectable from "./store.injectable";

import type { ServiceAccount } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../../kube-watch-api/kube-watch-api";
import type { ServiceAccountStore } from "./store";

/**
 * 🎯 목적: ServiceAccountsCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  serviceAccountStore: ServiceAccountStore;
  subscribeStores: SubscribeStores;
  openCreateServiceAccountDialog: () => void;
  className?: string;
}

/**
 * 🎯 목적: Service Account 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (serviceAccountStore, subscribeStores, openCreateServiceAccountDialog, className)
 * @returns KubeDataTable 기반 Service Account 목록 테이블
 */
const NonInjectedServiceAccountsCommonTable = observer(
  ({ serviceAccountStore, subscribeStores, openCreateServiceAccountDialog, className }: Dependencies) => {
    // serviceAccountStore.contextItems는 namespaceStore와 자동 연동되는 MobX computed 배열
    const serviceAccounts = serviceAccountStore.contextItems.slice();

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [selectedServiceAccount, setSelectedServiceAccount] = useState<ServiceAccount | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<ServiceAccount[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - serviceAccountStore를 구독하여 데이터 자동 로드
     * - namespace 변경 시 자동으로 재로드
     * - 언마운트 시 구독 자동 해제
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([serviceAccountStore], {
        onLoadFailure: (error) => {
          console.error("[ServiceAccounts] Failed to load service accounts:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [serviceAccountStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링 (Name, Namespace 기준)
     */
    const filteredServiceAccounts = useMemo(() => {
      if (!searchValue.trim()) {
        return serviceAccounts;
      }

      const search = searchValue.toLowerCase();
      return serviceAccounts.filter((sa) => {
        const name = sa.getName().toLowerCase();
        const namespace = sa.getNs().toLowerCase();

        return name.includes(search) || namespace.includes(search);
      });
    }, [serviceAccounts, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: Service Account 행 클릭 핸들러 (Detail Panel 토글)
     * @param serviceAccount - 클릭된 Service Account 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (serviceAccount: ServiceAccount) => {
      if (selectedServiceAccount?.getId() === serviceAccount.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedServiceAccount(undefined);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedServiceAccount(serviceAccount);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Service Account 배열
     */
    const handleSelectionChange = (selectedItems: ServiceAccount[]) => {
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
          selectedRows.map(async (serviceAccount) => {
            await serviceAccountStore.remove(serviceAccount);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[ServiceAccount] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title="Service Accounts"
          itemCount={filteredServiceAccounts.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search by name or namespace..."
          showNamespaceFilter={true}
          className={className}
          headerActions={
            <>
              <Button variant="default" onClick={openCreateServiceAccountDialog} className="gap-2 !px-4">
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
            columns={serviceAccountColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            data={filteredServiceAccounts}
            emptyMessage="No Service Accounts found"
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            selectedItem={selectedServiceAccount}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        <ServiceAccountDetailPanel
          isOpen={!!selectedServiceAccount}
          serviceAccount={selectedServiceAccount}
          onClose={() => setSelectedServiceAccount(undefined)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Service Accounts</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Service Account(s)?
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
 * 🎯 목적: Injectable DI 패턴으로 Dependencies 주입
 */
export const ServiceAccountsCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "serviceAccountStore" | "subscribeStores" | "openCreateServiceAccountDialog">
>(NonInjectedServiceAccountsCommonTable, {
  getProps: (di, props) => ({
    serviceAccountStore: di.inject(serviceAccountStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    openCreateServiceAccountDialog: di.inject(openCreateServiceAccountDialogInjectable),
    ...props,
  }),
});
