/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Ingress 목록 테이블 - ResourceTableLayout 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (제목, 네임스페이스 필터, 검색)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - Ingress Detail Panel (행 클릭 시 상세 정보 표시)
 * - MobX observable ingressStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - ingressStore.contextItems 사용 (namespaceStore와 자동 연동)
 * - 컬럼 정의는 ingresses-columns.tsx에서 import
 * - 검색 필터: Name, Namespace, Ports 기준
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 * - 2025-11-01: ResourceTableLayout 적용 (shadcn Select 네임스페이스 필터 통합)
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
import { IngressDetailPanel } from "./ingress-detail-panel";
import ingressStoreInjectable from "./ingress-store.injectable";
import { ingressColumns } from "./ingresses-columns";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { IngressStore } from "./ingress-store";

/**
 * 🎯 목적: IngressCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  ingressStore: IngressStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  className?: string;
}

/**
 * 🎯 목적: Ingress 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (ingressStore, dockStore, subscribeStores, className)
 * @returns KubeDataTable 기반 Ingress 목록 테이블 + Detail Panel
 */
const NonInjectedIngressCommonTable = observer(
  ({ ingressStore, dockStore, subscribeStores, className }: Dependencies) => {
    // ingressStore.contextItems는 namespaceStore와 자동 연동되는 MobX computed 배열
    const ingresses = ingressStore.contextItems.slice();

    /**
     * 🎯 목적: Ingress Store 구독
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([ingressStore], {
        onLoadFailure: (error) => {
          console.error("[Ingresses] Failed to load:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [ingressStore, subscribeStores]);

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedIngress, setSelectedIngress] = useState<(typeof ingresses)[0] | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof ingresses)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 검색 필터링 (Name, Namespace, Ports 기준)
     */
    const filteredIngresses = useMemo(() => {
      if (!searchValue.trim()) {
        return ingresses;
      }

      const search = searchValue.toLowerCase();
      return ingresses.filter(
        (ing) =>
          ing.getName().toLowerCase().includes(search) ||
          ing.getNs().toLowerCase().includes(search) ||
          ing.getPorts().toLowerCase().includes(search),
      );
    }, [ingresses, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: Ingress 행 클릭 핸들러 (Detail Panel 토글)
     *
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (ingress: (typeof ingresses)[0]) => {
      if (selectedIngress?.getId() === ingress.getId()) {
        setIsPanelOpen(false);
        setSelectedIngress(undefined);
      } else {
        setSelectedIngress(ingress);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Ingress 배열
     */
    const handleSelectionChange = (selectedItems: (typeof ingresses)[number][]) => {
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
          selectedRows.map(async (ingress) => {
            await ingressStore.remove(ingress);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[Ingress] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title="Ingresses"
          itemCount={filteredIngresses.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search ingresses..."
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
            data={filteredIngresses}
            columns={ingressColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            getRowId={(row) => row.getId()}
            emptyMessage="No Ingresses found"
            selectedItem={isPanelOpen ? selectedIngress : undefined}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Ingress Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <IngressDetailPanel isOpen={isPanelOpen} ingress={selectedIngress} onClose={() => setIsPanelOpen(false)} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Ingresses</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Ingress(es)?
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
 * 🎯 목적: Injectable로 감싼 IngressCommonTable 컴포넌트
 */
export const IngressCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "ingressStore" | "dockStore" | "subscribeStores">
>(NonInjectedIngressCommonTable, {
  getProps: (di, props) => ({
    ingressStore: di.inject(ingressStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    ...props,
  }),
});
