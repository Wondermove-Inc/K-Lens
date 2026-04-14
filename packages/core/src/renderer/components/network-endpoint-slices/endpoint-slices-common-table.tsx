/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Endpoint Slice 목록 테이블 - ResourceTableLayout 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (제목, 네임스페이스 필터, 검색)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - Endpoint Slice Detail Panel (행 클릭 시 상세 정보 표시)
 * - MobX observable endpointSliceStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - endpointSliceStore.contextItems 사용 (namespaceStore와 자동 연동)
 * - 컬럼 정의는 endpoint-slices-columns.tsx에서 import
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
import { EndpointSliceDetailPanel } from "./endpoint-slice-detail-panel";
import { endpointSliceColumns } from "./endpoint-slices-columns";
import endpointSliceStoreInjectable from "./store.injectable";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { EndpointSliceStore } from "./store";

/**
 * 🎯 목적: EndpointSliceCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  endpointSliceStore: EndpointSliceStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  className?: string;
}

/**
 * 🎯 목적: Endpoint Slice 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (endpointSliceStore, dockStore, subscribeStores, className)
 * @returns KubeDataTable 기반 Endpoint Slice 목록 테이블 + Detail Panel
 */
const NonInjectedEndpointSliceCommonTable = observer(
  ({ endpointSliceStore, dockStore, subscribeStores, className }: Dependencies) => {
    // endpointSliceStore.contextItems는 namespaceStore와 자동 연동되는 MobX computed 배열
    const endpointSlices = endpointSliceStore.contextItems.slice();

    /**
     * 🎯 목적: Endpoint Slice Store 구독
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([endpointSliceStore], {
        onLoadFailure: (error) => {
          console.error("[Endpoint Slices] Failed to load:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [endpointSliceStore, subscribeStores]);

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedEndpointSlice, setSelectedEndpointSlice] = useState<(typeof endpointSlices)[0] | undefined>(
      undefined,
    );
    const [selectedRows, setSelectedRows] = useState<(typeof endpointSlices)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 검색 필터링 (Name, Namespace, Address Type, Ports, Endpoints 기준)
     */
    const filteredEndpointSlices = useMemo(() => {
      if (!searchValue.trim()) {
        return endpointSlices;
      }

      const search = searchValue.toLowerCase();
      return endpointSlices.filter(
        (es) =>
          es.getName().toLowerCase().includes(search) ||
          es.getNs().toLowerCase().includes(search) ||
          (es.addressType && es.addressType.toLowerCase().includes(search)) ||
          es.getPortsString().toLowerCase().includes(search) ||
          es.getEndpointsString().toLowerCase().includes(search),
      );
    }, [endpointSlices, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: Endpoint Slice 행 클릭 핸들러 (Detail Panel 토글)
     *
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (endpointSlice: (typeof endpointSlices)[0]) => {
      if (selectedEndpointSlice?.getId() === endpointSlice.getId()) {
        setIsPanelOpen(false);
        setSelectedEndpointSlice(undefined);
      } else {
        setSelectedEndpointSlice(endpointSlice);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Endpoint Slice 배열
     */
    const handleSelectionChange = (selectedItems: (typeof endpointSlices)[number][]) => {
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
          selectedRows.map(async (endpointSlice) => {
            await endpointSliceStore.remove(endpointSlice);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[EndpointSlice] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title="Endpoint Slices"
          itemCount={filteredEndpointSlices.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search endpoint slices..."
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
            data={filteredEndpointSlices}
            columns={endpointSliceColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            getRowId={(row) => row.getId()}
            emptyMessage="No Endpoint Slices found"
            selectedItem={isPanelOpen ? selectedEndpointSlice : undefined}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Endpoint Slice Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <EndpointSliceDetailPanel
          isOpen={isPanelOpen}
          endpointSlice={selectedEndpointSlice}
          onClose={() => setIsPanelOpen(false)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Endpoint Slices</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Endpoint Slice(s)?
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
 * 🎯 목적: Injectable로 감싼 EndpointSliceCommonTable 컴포넌트
 */
export const EndpointSliceCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "endpointSliceStore" | "dockStore" | "subscribeStores">
>(NonInjectedEndpointSliceCommonTable, {
  getProps: (di, props) => ({
    endpointSliceStore: di.inject(endpointSliceStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    ...props,
  }),
});
