/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CustomResourceDefinition 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (상단 메뉴: 제목, 카운트, 검색 입력, Group 필터)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable customResourceDefinitionStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → customResourceDefinitionStore.items.slice() 변환
 * - 컬럼 정의는 custom-resource-definitions-columns.tsx에서 import
 * - Group 필터: Multi-select 방식 (여러 그룹 동시 선택 가능)
 * - CustomResourceDefinitions는 cluster-scoped 리소스이므로 네임스페이스 필터 없음
 *
 * 🔄 변경이력:
 * - 2025-11-05: 초기 생성 (RoleBindings 패턴 기반, Group 필터 추가)
 * - 2025-12-01: Group Select → shadcn DropdownMenu 마이그레이션 (테마 토큰 적용)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@skuberplus/storybook-shadcn/src/components/ui/dropdown-menu";
import { iter } from "@skuberplus/utilities";
import { ChevronDown, Folder, Trash2 } from "lucide-react";
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
import { CustomResourceDefinitionDetailPanel } from "./custom-resource-definition-detail-panel";
import { customResourceDefinitionColumns } from "./custom-resource-definitions-columns";
import selectedCustomResourceDefinitionGroupsUrlParamInjectable from "./selected-groups-url-param.injectable";
import customResourceDefinitionStoreInjectable from "./store.injectable";

import type { CustomResourceDefinition } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { PageParam } from "../../navigation/page-param";
import type { DockStore } from "../dock/dock/store";
import type { CustomResourceDefinitionStore } from "./store";

/**
 * 🎯 목적: CustomResourceDefinitionCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  customResourceDefinitionStore: CustomResourceDefinitionStore;
  subscribeStores: SubscribeStores;
  dockStore: DockStore;
  selectedGroups: PageParam<Set<string>>;
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
  menuBar: 65, // 상단 메뉴 (제목, 검색, Group 필터)
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
 * 🎯 목적: CustomResourceDefinition 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (customResourceDefinitionStore, dockStore, selectedGroups, className)
 * @returns ResourceTableLayout + KubeDataTable 기반 CustomResourceDefinition 목록 테이블
 */
const NonInjectedCustomResourceDefinitionCommonTable = observer(
  ({ customResourceDefinitionStore, subscribeStores, dockStore, selectedGroups, className }: Dependencies) => {
    const ALL_GROUPS = "All groups";

    // customResourceDefinitionStore.items는 MobX observable 배열 (cluster-scoped이므로 namespace 필터 없음)
    const customResourceDefinitions = customResourceDefinitionStore.items;

    /**
     * 🎯 목적: Kubernetes Watch API 구독 (실시간 업데이트)
     *
     * @remarks
     * - customResourceDefinitionStore의 변경사항을 Watch API로 구독
     * - 컴포넌트 언마운트 시 구독 해제
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([customResourceDefinitionStore], {
        onLoadFailure: (error) => {
          console.error("[CRD] Failed to load custom resource definitions:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [customResourceDefinitionStore, subscribeStores]);

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [selectedCrd, setSelectedCrd] = useState<CustomResourceDefinition | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof customResourceDefinitions)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 현재 선택된 그룹 Set (MobX observable)
     */
    const currentSelectedGroups = selectedGroups.get();

    /**
     * 🎯 목적: Group 필터링
     *
     * @remarks
     * - URL 파라미터로 선택된 그룹 목록 관리
     * - 선택된 그룹이 없으면 모든 그룹 표시
     */
    const filteredByGroup = useMemo(() => {
      if (currentSelectedGroups.size === 0) {
        return customResourceDefinitions.slice(); // 모든 그룹 표시
      }

      return customResourceDefinitions.filter((crd) => currentSelectedGroups.has(crd.getGroup()));
    }, [customResourceDefinitions, customResourceDefinitions.length, currentSelectedGroups]);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - getResourceKind(), getGroup(), getVersion(), getScope() 기준 검색
     */
    const filteredCustomResourceDefinitions = useMemo(() => {
      let filtered = filteredByGroup;

      // 검색 필터
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (crd) =>
            crd.getResourceKind().toLowerCase().includes(search) ||
            crd.getGroup().toLowerCase().includes(search) ||
            crd.getVersion().toLowerCase().includes(search) ||
            crd.getScope().toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [filteredByGroup, searchValue]);

    /**
     * 🎯 목적: 그룹 목록 가져오기
     */
    const groupList = useMemo(
      () => Object.keys(customResourceDefinitionStore.groups),
      [customResourceDefinitionStore.groups],
    );

    /**
     * 🎯 목적: 현재 선택 상태 확인
     */
    const isAllSelected = currentSelectedGroups.size === 0;

    /**
     * 🎯 목적: 개별 그룹 토글
     *
     * @param group - 토글할 그룹 이름
     */
    const toggleGroup = (group: string) => {
      const next = new Set(currentSelectedGroups);

      if (isAllSelected) {
        // "All" 상태에서 클릭하면 해당 그룹만 선택
        next.clear();
        next.add(group);
      } else {
        if (next.has(group)) {
          next.delete(group);
        } else {
          next.add(group);
        }
      }

      // 모든 그룹이 선택되거나 아무것도 선택되지 않으면 All 상태로
      if (next.size === 0 || next.size === groupList.length) {
        selectedGroups.clear();
      } else {
        selectedGroups.setRaw([...next]);
      }
    };

    /**
     * 🎯 목적: Group Select Placeholder 생성
     */
    const getPlaceholder = () => {
      if (currentSelectedGroups.size === 0) {
        return ALL_GROUPS;
      }

      const prefix = currentSelectedGroups.size === 1 ? "Group" : "Groups";

      return `${prefix}: ${iter.join(currentSelectedGroups.values(), ", ")}`;
    };

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 CustomResourceDefinition 배열
     */
    const handleSelectionChange = (selectedItems: (typeof customResourceDefinitions)[number][]) => {
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
          selectedRows.map(async (crd) => {
            await customResourceDefinitionStore.remove(crd);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[CustomResourceDefinition] Failed to delete:", error);
      }
    };

    return (
      <ResourceTableLayout
        title="Custom Resources"
        itemCount={filteredCustomResourceDefinitions.length}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search custom resource definitions..."
        showNamespaceFilter={false} // cluster-scoped 리소스
        headerActions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  id="crd-input"
                  variant="outline"
                  className="inline-flex h-9 min-w-[180px] items-center justify-between gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
                >
                  {getPlaceholder()}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[220px] max-h-[300px] overflow-y-auto">
                <DropdownMenuCheckboxItem
                  checked={isAllSelected}
                  className="font-medium"
                  onSelect={(e) => {
                    e.preventDefault();
                    selectedGroups.clear();
                  }}
                >
                  {ALL_GROUPS}
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {groupList.map((group) => (
                  <DropdownMenuCheckboxItem
                    key={group}
                    checked={isAllSelected || currentSelectedGroups.has(group)}
                    onSelect={(e) => {
                      e.preventDefault();
                      toggleGroup(group);
                    }}
                  >
                    <Folder className="h-4 w-4 mr-2" />
                    {group}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
          </div>
        }
        className={className}
      >
        {/* ============================================ */}
        {/* 🎯 KubeDataTable: CustomResourceDefinition 목록 테이블 */}
        {/* ============================================ */}
        <KubeDataTable
          data={filteredCustomResourceDefinitions}
          columns={customResourceDefinitionColumns}
          enableColumnResizing={true}
          enableRowSelection={true}
          enablePagination={true}
          defaultPageSize={40}
          getRowId={(item) => item.getId()}
          dockHeight={dockStore.isOpen ? dockStore.height : 0}
          tableOffset={TOTAL_TABLE_OFFSET}
          emptyMessage="No Custom Resource Definitions found"
          className="h-full"
          onRowClick={(crd) => {
            if (selectedCrd?.getId() === crd.getId()) {
              // 같은 행 클릭 시 패널 닫기
              setSelectedCrd(undefined);
            } else {
              // 다른 행 클릭 시 패널 열기/전환
              setSelectedCrd(crd);
            }
          }}
          onSelectionChange={handleSelectionChange}
          selectedItem={selectedCrd}
          renderContextMenu={(item) => <ResourceContextMenu object={item} />}
        />

        {/* ============================================ */}
        {/* 🎯 DetailPanel: CustomResourceDefinition 상세 정보 */}
        {/* ============================================ */}
        <CustomResourceDefinitionDetailPanel
          isOpen={!!selectedCrd}
          crd={selectedCrd}
          onClose={() => setSelectedCrd(undefined)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Custom Resource Definitions</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Custom Resource Definition(s)?
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
 * 🎯 목적: Injectable로 감싼 CustomResourceDefinitionCommonTable 컴포넌트
 */
export const CustomResourceDefinitionCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "customResourceDefinitionStore" | "subscribeStores" | "dockStore" | "selectedGroups">
>(NonInjectedCustomResourceDefinitionCommonTable, {
  getProps: (di, props) => ({
    customResourceDefinitionStore: di.inject(customResourceDefinitionStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    dockStore: di.inject(dockStoreInjectable),
    selectedGroups: di.inject(selectedCustomResourceDefinitionGroupsUrlParamInjectable),
    ...props,
  }),
});
