/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Network Policy 목록 테이블 - ResourceTableLayout 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (제목, 네임스페이스 필터, 검색)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - Network Policy Detail Panel (행 클릭 시 상세 정보 표시)
 * - MobX observable networkPolicyStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - networkPolicyStore.contextItems 사용 (namespaceStore와 자동 연동)
 * - 컬럼 정의는 network-policies-columns.tsx에서 import
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 * - 2025-11-01: ResourceTableLayout 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useState } from "react";
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
import { networkPolicyColumns } from "./network-policies-columns";
import { NetworkPolicyDetailPanel } from "./network-policy-detail-panel";
import networkPolicyStoreInjectable from "./store.injectable";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { NetworkPolicyStore } from "./store";

/**
 * 🎯 목적: NetworkPolicyCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  networkPolicyStore: NetworkPolicyStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  className?: string;
}

/**
 * 🎯 목적: Network Policy 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (networkPolicyStore, dockStore, subscribeStores, className)
 * @returns KubeDataTable 기반 Network Policy 목록 테이블 + Detail Panel
 */
const NonInjectedNetworkPolicyCommonTable = observer(
  ({ networkPolicyStore, dockStore, subscribeStores, className }: Dependencies) => {
    // networkPolicyStore.contextItems는 namespaceStore와 자동 연동되는 MobX computed 배열
    const networkPolicies = networkPolicyStore.contextItems.slice();

    /**
     * 🎯 목적: Network Policy Store 구독
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([networkPolicyStore], {
        onLoadFailure: (error) => {
          console.error("[Network Policies] Failed to load:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [networkPolicyStore, subscribeStores]);

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedNetworkPolicy, setSelectedNetworkPolicy] = useState<(typeof networkPolicies)[0] | undefined>(
      undefined,
    );
    const [selectedRows, setSelectedRows] = useState<(typeof networkPolicies)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 검색 필터링 (Name, Namespace, Policy Types 기준)
     */
    const filteredNetworkPolicies = useMemo(() => {
      if (!searchValue.trim()) {
        return networkPolicies;
      }

      const search = searchValue.toLowerCase();
      return networkPolicies.filter(
        (np) =>
          np.getName().toLowerCase().includes(search) ||
          np.getNs().toLowerCase().includes(search) ||
          np.getTypes().some((type) => type.toLowerCase().includes(search)),
      );
    }, [networkPolicies, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: Network Policy 행 클릭 핸들러 (Detail Panel 토글)
     *
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (networkPolicy: (typeof networkPolicies)[0]) => {
      if (selectedNetworkPolicy?.getId() === networkPolicy.getId()) {
        setIsPanelOpen(false);
        setSelectedNetworkPolicy(undefined);
      } else {
        setSelectedNetworkPolicy(networkPolicy);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Network Policy 배열
     */
    const handleSelectionChange = (selectedItems: (typeof networkPolicies)[number][]) => {
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
          selectedRows.map(async (networkPolicy) => {
            await networkPolicyStore.remove(networkPolicy);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[NetworkPolicy] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title="Network Policies"
          itemCount={filteredNetworkPolicies.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search network policies..."
          showNamespaceFilter={true}
          className={className}
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
            data={filteredNetworkPolicies}
            columns={networkPolicyColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            getRowId={(row) => row.getId()}
            emptyMessage="No Network Policies found"
            selectedItem={isPanelOpen ? selectedNetworkPolicy : undefined}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Network Policy Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <NetworkPolicyDetailPanel
          isOpen={isPanelOpen}
          networkPolicy={selectedNetworkPolicy}
          onClose={() => setIsPanelOpen(false)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Network Policies</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Network Polic{selectedCount > 1 ? "ies" : "y"}?
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
 * 🎯 목적: Injectable로 감싼 NetworkPolicyCommonTable 컴포넌트
 */
export const NetworkPolicyCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "networkPolicyStore" | "dockStore" | "subscribeStores">
>(NonInjectedNetworkPolicyCommonTable, {
  getProps: (di, props) => ({
    networkPolicyStore: di.inject(networkPolicyStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    ...props,
  }),
});
