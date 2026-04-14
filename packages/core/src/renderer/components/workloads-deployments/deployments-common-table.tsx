/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Deployment 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Deployments {count} items, 네임스페이스 드롭다운, 검색 입력)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - Deployment Detail Panel (행 클릭 시 상세 정보 표시)
 * - MobX observable deploymentStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → deploymentStore.items.slice() 변환
 * - 컬럼 정의는 deployments-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (Pod CommonTable 패턴 기반, Deployment 적용)
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
import namespaceStoreInjectable from "../namespaces/store.injectable";
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
import { DeploymentDetailPanel } from "./deployment-detail-panel";
import { deploymentColumns } from "./deployments-columns";
import deploymentStoreInjectable from "./store.injectable";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { NamespaceStore } from "../namespaces/store";
import type { DeploymentStore } from "./store";

/**
 * 🎯 목적: DeploymentCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  deploymentStore: DeploymentStore;
  namespaceStore: NamespaceStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  className?: string;
}

/**
 * 🎯 목적: 레이아웃 높이 상수 (Pod Table과 동일)
 *
 * @remarks
 * 테이블 maxHeight 계산을 위한 정확한 오프셋 값
 * - calc(100vh - TOTAL_TABLE_OFFSET - dockHeight)
 */
const LAYOUT_OFFSETS = {
  clusterManagerHeader: 40, // ClusterManager Header
  statusBar: 21, // StatusBar
  mainLayoutTabs: 36, // MainTabContainer (탭)
  deploymentMenuBar: 65, // DeploymentCommonTable 상단 메뉴 (제목, 네임스페이스, 검색)
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.deploymentMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: Deployment 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (deploymentStore, dockStore, subscribeStores, className)
 * @returns KubeDataTable 기반 Deployment 목록 테이블 + Detail Panel
 */
const NonInjectedDeploymentCommonTable = observer(
  ({ deploymentStore, namespaceStore, dockStore, subscribeStores, className }: Dependencies) => {
    // deploymentStore.contextItems는 MobX computed getter (즉시 필터링된 데이터)
    const deployments = deploymentStore.contextItems;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedDeployment, setSelectedDeployment] = useState<(typeof deployments)[0] | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof deployments)[0][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - deployments는 이미 contextItems로 필터링됨
     * - Deployment는 메트릭 없음 (Pod와 차이점)
     */
    const filteredDeployments = React.useMemo(() => {
      // deployments는 이미 contextItems로 필터링됨
      let filtered = deployments.slice();

      // 검색 필터 (Name, Namespace, Conditions 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (deployment) =>
            deployment.getName().toLowerCase().includes(search) ||
            deployment.getNs().toLowerCase().includes(search) ||
            deployment.getConditionsText().toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [deployments, searchValue]);

    /**
     * 🎯 목적: Deployment Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - KubeWatchApi.subscribeStores()를 통한 중앙 집중식 구독 관리
     * - 중복 구독 방지 및 namespace 변경 자동 감지
     * - 컴포넌트 마운트 시 store.loadAll() → store.subscribe() 자동 실행
     * - 언마운트 시 구독 자동 해제로 메모리 누수 방지
     *
     * 🔄 변경이력:
     * - 2025-10-31: store.subscribe() 직접 호출에서 KubeWatchApi.subscribeStores() 사용으로 변경
     *               (AbortSignal 에러 해결 및 중복 구독 방지)
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([deploymentStore], {
        onLoadFailure: (error) => {
          console.error("[Deployments] Failed to load deployments:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [deploymentStore, subscribeStores]);

    /**
     * 🎯 목적: Deployment 행 클릭 핸들러 (Detail Panel 토글)
     * @param deployment - 클릭된 Deployment 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (deployment: (typeof deployments)[0]) => {
      if (selectedDeployment?.getId() === deployment.getId()) {
        setIsPanelOpen(false);
        setSelectedDeployment(undefined);
      } else {
        setSelectedDeployment(deployment);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 선택된 행 개수 계산
     */
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 행 선택 변경 핸들러
     * @param selectedDeployments - 선택된 Deployment 배열
     */
    const handleSelectionChange = (selectedDeployments: (typeof deployments)[0][]) => {
      setSelectedRows(selectedDeployments);
    };

    /**
     * 🎯 목적: Delete 버튼 클릭 핸들러 (삭제 확인 다이얼로그 열기)
     */
    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    /**
     * 🎯 목적: 삭제 확인 핸들러 (실제 Deployment 삭제 수행)
     *
     * @remarks
     * - 선택된 모든 Deployment를 삭제
     * - deploymentStore.remove() 메서드를 사용하여 Kubernetes API 호출
     * - 삭제 후 선택 상태 초기화 및 다이얼로그 닫기
     */
    const handleDeleteConfirm = async () => {
      try {
        // 각 Deployment 삭제 (병렬 처리)
        await Promise.all(
          selectedRows.map(async (deployment) => {
            await deploymentStore.remove(deployment);
          }),
        );

        // 삭제 성공 후 선택 상태 초기화
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[Deployments] Failed to delete deployments:", error);
        // TODO: 에러 토스트 메시지 표시
      }
    };

    return (
      <div className={className || ""}>
        <ResourceTableLayout
          title="Deployments"
          itemCount={filteredDeployments.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search deployments..."
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
          {/* 🎯 KubeDataTable: Deployment 목록 테이블 */}
          {/* ============================================ */}
          <KubeDataTable
            data={filteredDeployments}
            columns={deploymentColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage="No Deployments found"
            className="h-full"
            selectedItem={isPanelOpen ? selectedDeployment : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Deployment Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <DeploymentDetailPanel
          isOpen={isPanelOpen}
          deployment={selectedDeployment}
          onClose={() => setIsPanelOpen(false)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete Confirmation Dialog: 삭제 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Deployments</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Deployment(s)?
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
 * 🎯 목적: Injectable로 감싼 DeploymentCommonTable 컴포넌트
 *
 * @remarks
 * - deploymentStore: Deployment 목록 및 상태 관리
 * - namespaceStore: 전역 네임스페이스 필터 관리
 * - dockStore: Dock 높이 정보 제공 (테이블 maxHeight 계산용)
 * - subscribeStores: KubeWatchApi의 중앙 집중식 구독 관리자
 */
export const DeploymentCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "deploymentStore" | "namespaceStore" | "dockStore" | "subscribeStores">
>(NonInjectedDeploymentCommonTable, {
  getProps: (di, props) => ({
    deploymentStore: di.inject(deploymentStoreInjectable),
    namespaceStore: di.inject(namespaceStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    ...props,
  }),
});
