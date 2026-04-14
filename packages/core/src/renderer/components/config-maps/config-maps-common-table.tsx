/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ConfigMap 목록 테이블 - CommonTable 패턴 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Config Maps {count} items, 네임스페이스 드롭다운, 검색 입력)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - ConfigMap Detail Panel (행 클릭 시 상세 정보 표시)
 * - MobX observable configMapStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → configMapStore.items.slice() 변환
 * - 컬럼 정의는 config-maps-columns.tsx에서 import
 * - Keys 컬럼은 배열을 ", "로 join하여 표시
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 * - 반응형 디자인 (Pod 패턴 준수)
 *
 * 🔄 변경이력:
 * - 2025-10-30: CommonTable 패턴으로 마이그레이션 (shadcn UI)
 * - 2025-10-31: ResourceTableLayout 적용 (상단 메뉴 공통화)
 * - 2025-11-02: ConfigMapDetailPanel 연결 (shadcn DetailPanel 기반)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
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
import { ConfigMapDetailPanel } from "./config-map-detail-panel";
import { configMapColumns } from "./config-maps-columns";
import configMapStoreInjectable from "./store.injectable";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { ConfigMapStore } from "./store";

/**
 * 🎯 목적: ConfigMapsCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  configMapStore: ConfigMapStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  className?: string;
}

/**
 * 🎯 목적: 레이아웃 높이 상수
 *
 * @remarks
 * 테이블 maxHeight 계산을 위한 정확한 오프셋 값
 * - calc(100vh - TOTAL_TABLE_OFFSET - dockHeight)
 */
const LAYOUT_OFFSETS = {
  clusterManagerHeader: 40, // ClusterManager Header
  statusBar: 21, // StatusBar
  mainLayoutTabs: 36, // MainTabContainer (탭)
  configMapMenuBar: 65, // ConfigMaps 상단 메뉴
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.configMapMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: ConfigMap 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (configMapStore, dockStore, subscribeStores, className)
 * @returns KubeDataTable 기반 ConfigMap 목록 테이블
 */
const NonInjectedConfigMapsCommonTable = observer(
  ({ configMapStore, dockStore, subscribeStores, className }: Dependencies) => {
    // configMapStore.contextItems는 MobX computed getter (namespace 필터링된 데이터)
    const configMaps = configMapStore.contextItems;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedConfigMap, setSelectedConfigMap] = useState<(typeof configMaps)[0] | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof configMaps)[0][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: ConfigMap Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([configMapStore], {
        onLoadFailure: (error) => console.error("[ConfigMaps] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [configMapStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - contextItems가 이미 namespace 필터링 수행
     * - MobX observable 배열을 순수 배열로 변환
     * - 검색 필터: Name, Namespace, Keys 기준
     */
    const filteredConfigMaps = React.useMemo(() => {
      // MobX observable 배열을 순수 배열로 변환 (KubeDataTable 요구사항)
      let filtered = configMaps.slice();

      // 검색 필터 (Name, Namespace, Keys 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (cm) =>
            cm.getName().toLowerCase().includes(search) ||
            cm.getNs().toLowerCase().includes(search) ||
            cm.getKeys().some((key) => key.toLowerCase().includes(search)),
        );
      }

      return filtered;
    }, [configMaps, searchValue]);

    /**
     * 🎯 목적: ConfigMap 행 클릭 핸들러 (Detail Panel 토글)
     * @param configMap - 클릭된 ConfigMap 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (configMap: (typeof configMaps)[0]) => {
      if (selectedConfigMap?.getId() === configMap.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedConfigMap(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedConfigMap(configMap);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 선택된 행 개수 계산
     */
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 행 선택 변경 핸들러
     * @param selectedConfigMaps - 선택된 ConfigMap 배열
     */
    const handleSelectionChange = (selectedConfigMaps: (typeof configMaps)[0][]) => {
      setSelectedRows(selectedConfigMaps);
    };

    /**
     * 🎯 목적: Delete 버튼 클릭 핸들러 (삭제 확인 다이얼로그 열기)
     */
    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    /**
     * 🎯 목적: 삭제 확인 핸들러 (실제 ConfigMap 삭제 수행)
     *
     * @remarks
     * - 선택된 모든 ConfigMap을 삭제
     * - configMapStore.remove() 메서드를 사용하여 Kubernetes API 호출
     * - 삭제 후 선택 상태 초기화 및 다이얼로그 닫기
     */
    const handleDeleteConfirm = async () => {
      try {
        // 각 ConfigMap 삭제 (병렬 처리)
        await Promise.all(
          selectedRows.map(async (configMap) => {
            await configMapStore.remove(configMap);
          }),
        );

        // 삭제 성공 후 선택 상태 초기화
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[ConfigMaps] Failed to delete config maps:", error);
        // TODO: 에러 토스트 메시지 표시
      }
    };

    return (
      <div className={className || ""}>
        <ResourceTableLayout
          title="Config Maps"
          itemCount={filteredConfigMaps.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search config maps..."
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
            data={filteredConfigMaps}
            columns={configMapColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage="No Config Maps found"
            className="h-full"
            selectedItem={isPanelOpen ? selectedConfigMap : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 ConfigMap Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <ConfigMapDetailPanel
          isOpen={isPanelOpen}
          configMap={selectedConfigMap}
          onClose={() => setIsPanelOpen(false)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete Confirmation Dialog: 삭제 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Config Maps</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected ConfigMap(s)?
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
 * 🎯 목적: ConfigMapsCommonTable 컴포넌트 (Injectable DI 적용)
 */
export const ConfigMapsCommonTable = withInjectables<Dependencies>(NonInjectedConfigMapsCommonTable, {
  getProps: (di, props) => ({
    ...props,
    configMapStore: di.inject(configMapStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
  }),
});
