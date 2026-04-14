/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CustomResource 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (상단 메뉴: 제목, 검색, Delete 버튼)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - CustomResourceDetailPanel (행 클릭 시 상세 정보 표시)
 * - MobX observable store 연동 (동적으로 apiManager.getStore() 사용)
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - CRD별로 다른 store를 사용하므로 crd prop으로 동적 결정
 * - 컬럼 정의도 crd 기반으로 동적 생성
 * - Namespace 필터는 namespaced CRD만 표시
 *
 * 🔄 변경이력:
 * - 2025-12-17: 초기 생성 (Pods 패턴 기반)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useState } from "react";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
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
import { CustomResourceDetailPanel } from "./custom-resource-detail-panel";
import { createCustomResourceColumns } from "./custom-resources-columns";

import type { CustomResourceDefinition, KubeObject } from "@skuberplus/kube-object";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";

/**
 * 🎯 목적: CustomResourceCommonTable Props 인터페이스
 */
interface CustomResourceCommonTableProps {
  crd: CustomResourceDefinition;
  className?: string;
}

interface Dependencies {
  apiManager: ApiManager;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
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
  menuBar: 65, // 상단 메뉴 (제목, 검색)
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
 * 🎯 목적: CustomResource 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - crd, apiManager, dockStore, className
 * @returns KubeDataTable 기반 CustomResource 목록 테이블 + Detail Panel
 */
const NonInjectedCustomResourceCommonTable = observer(
  ({ crd, apiManager, dockStore, subscribeStores, className }: CustomResourceCommonTableProps & Dependencies) => {
    // 🎯 동적 store 가져오기 (CRD 기반)
    const store = apiManager.getStore(crd.getResourceApiBase());
    const isNamespaced = crd.isNamespaced();

    /**
     * 🎯 목적: CRD 전용 store 로드 및 watch 구독
     *
     * @remarks
     * - shadcn 마이그레이션 시 KubeObjectListLayout 자동 구독이 사라졌으므로 수동 구독 필요
     * - CRD별 동적 store이므로 store 변경 시마다 재구독
     */
    useEffect(() => {
      if (!store) return undefined;

      const unsubscribe = subscribeStores([store], {
        onLoadFailure: (error) => {
          console.error(`[CustomResource] Failed to load ${crd.getPluralName()}:`, error);
        },
      });

      return () => unsubscribe();
    }, [crd, store, subscribeStores]);

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedResource, setSelectedResource] = useState<KubeObject | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<KubeObject[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // 🎯 동적 컬럼 생성 (CRD 변경 시 재계산)
    const columns = useMemo(() => {
      return createCustomResourceColumns(crd);
    }, [crd]);

    /**
     * 🎯 목적: 데이터 필터링
     *
     * @remarks
     * - store.contextItems는 namespace 필터가 적용된 결과 (namespaced CRD)
     * - store.items는 전체 리소스 (cluster-scoped CRD)
     * - 검색 필터 추가 적용
     */
    const filteredResources = useMemo(() => {
      if (!store) return [];

      // contextItems는 namespace 필터가 적용된 결과
      const resources = isNamespaced ? store.contextItems.slice() : store.items.slice();

      // 검색 필터
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        return resources.filter(
          (resource) =>
            resource.getName().toLowerCase().includes(search) ||
            (isNamespaced && (resource.getNs() ?? "").toLowerCase().includes(search)),
        );
      }

      return resources;
    }, [
      store,
      store?.contextItems,
      store?.contextItems?.length,
      store?.items,
      store?.items?.length,
      searchValue,
      isNamespaced,
    ]);

    /**
     * 🎯 목적: 행 클릭 핸들러 (Detail Panel 토글)
     * @param resource - 클릭된 CustomResource 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (resource: KubeObject) => {
      if (selectedResource?.getId() === resource.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setIsPanelOpen(false);
        setSelectedResource(undefined);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedResource(resource);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 선택된 행 개수 계산
     */
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 행 선택 변경 핸들러
     * @param selectedItems - 선택된 리소스 배열
     */
    const handleSelectionChange = (selectedItems: KubeObject[]) => {
      setSelectedRows(selectedItems);
    };

    /**
     * 🎯 목적: Delete 버튼 클릭 핸들러 (삭제 확인 다이얼로그 열기)
     */
    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    /**
     * 🎯 목적: 삭제 확인 핸들러 (실제 리소스 삭제 수행)
     *
     * @remarks
     * - 선택된 모든 리소스를 삭제
     * - store.remove() 메서드를 사용하여 Kubernetes API 호출
     * - 삭제 후 선택 상태 초기화 및 다이얼로그 닫기
     */
    const handleDeleteConfirm = async () => {
      if (!store) return;

      try {
        // 각 리소스 삭제 (병렬 처리)
        await Promise.all(
          selectedRows.map(async (resource) => {
            await store.remove(resource);
          }),
        );

        // 삭제 성공 후 선택 상태 초기화
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error(`[CustomResource] Failed to delete ${crd.getPluralName()}:`, error);
      }
    };

    if (!store) {
      return null;
    }

    return (
      <div className={className || ""}>
        <ResourceTableLayout
          title={crd.getResourceKind()}
          itemCount={filteredResources.length}
          showNamespaceFilter={isNamespaced}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder={`Search ${crd.getPluralName()}...`}
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
          {/* ============================================ */}
          {/* 🎯 KubeDataTable: CustomResource 목록 테이블 */}
          {/* ============================================ */}
          <KubeDataTable
            data={filteredResources}
            columns={columns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(resource) => resource.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage={`No ${crd.getPluralName()} found`}
            className="h-full"
            selectedItem={isPanelOpen ? selectedResource : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 CustomResource Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <CustomResourceDetailPanel
          isOpen={isPanelOpen}
          resource={selectedResource}
          crd={crd}
          onClose={() => setIsPanelOpen(false)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete Confirmation Dialog: 삭제 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {crd.getPluralName()}</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected {crd.getResourceKind()}(s)?
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
 * 🎯 목적: Injectable로 감싼 CustomResourceCommonTable 컴포넌트
 *
 * @remarks
 * - apiManager: 동적 store 획득을 위한 API 관리자
 * - dockStore: Dock 높이 정보 제공 (테이블 maxHeight 계산용)
 */
export const CustomResourceCommonTable = withInjectables<Dependencies, CustomResourceCommonTableProps>(
  NonInjectedCustomResourceCommonTable,
  {
    getProps: (di, props) => ({
      apiManager: di.inject(apiManagerInjectable),
      dockStore: di.inject(dockStoreInjectable),
      subscribeStores: di.inject(subscribeStoresInjectable),
      ...props,
    }),
  },
);
