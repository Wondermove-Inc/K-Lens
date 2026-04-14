/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Pod 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Pods {count} items, 네임스페이스 드롭다운, 검색 입력)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - Pod Detail Drawer (행 클릭 시 상세 정보 표시)
 * - MobX observable podStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → podStore.items.slice() 변환
 * - 컬럼 정의는 pods-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 *
 * 🔄 변경이력:
 * - 2025-10-28: Step 1-5 - 수동 구현 (shadcn/ui Table)
 * - 2025-10-29: KubeDataTable 마이그레이션 (컬럼 리사이징 추가, 코드 80% 감소)
 * - 2026-02-06: PodTableContent 분리 (observer 범위 축소로 CPU 최적화)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useState } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import appActivityStateInjectable from "../../utils/app-activity-state.injectable";
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
import { PodDetailPanel } from "./pod-detail-panel";
import { type PodWithMetrics, podColumns } from "./pods-columns";
import podStoreInjectable from "./store.injectable";

import type { Pod } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { AppActivityState } from "../../utils/app-activity-state.injectable";
import type { DockStore } from "../dock/dock/store";
import type { NamespaceStore } from "../namespaces/store";
import type { PodStore } from "./store";

/**
 * 🎯 목적: PodCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  podStore: PodStore;
  namespaceStore: NamespaceStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  appActivityState: AppActivityState;
  className?: string;
}

/**
 * 메트릭 갱신 간격 (초)
 * 🎯 디테일 패널과 동기화 (60초)
 */
const REFRESH_METRICS_INTERVAL = 60;

/**
 * 🎯 목적: 레이아웃 높이 상수 (DockStore.maxHeight 계산 방식과 일치)
 *
 * @remarks
 * 테이블 maxHeight 계산을 위한 정확한 오프셋 값
 * - calc(100vh - TOTAL_TABLE_OFFSET - dockHeight)
 */
const LAYOUT_OFFSETS = {
  clusterManagerHeader: 40, // ClusterManager Header
  statusBar: 21, // StatusBar
  mainLayoutTabs: 36, // MainTabContainer (탭)
  podMenuBar: 65, // PodCommonTable 상단 메뉴 (제목, 네임스페이스, 검색)
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.podMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: PodTableContent Props 인터페이스
 */
interface PodTableContentProps {
  podStore: PodStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  appActivityState: AppActivityState;
  searchValue: string;
  selectedPod: PodWithMetrics | undefined;
  isPanelOpen: boolean;
  onRowClick: (pod: PodWithMetrics) => void;
  onSelectionChange: (pods: Pod[]) => void;
  onItemCountChange: (count: number) => void;
}

/**
 * 🎯 목적: Pod 테이블 내용 컴포넌트 (MobX observer 적용)
 *
 * @remarks
 * - observer 범위를 테이블 영역으로 제한하여 CPU 최적화
 * - Watch 이벤트 발생 시 이 컴포넌트만 리렌더링됨
 * - 상위 컴포넌트(메뉴바, 다이얼로그 등)는 리렌더링되지 않음
 */
const PodTableContent = observer(
  ({
    podStore,
    dockStore,
    subscribeStores,
    appActivityState,
    searchValue,
    selectedPod,
    isPanelOpen,
    onRowClick,
    onSelectionChange,
    onItemCountChange,
  }: PodTableContentProps) => {
    // podStore.contextItems는 MobX computed getter (즉시 필터링된 데이터)
    const pods = podStore.contextItems;

    // Read MobX observable in render body so `observer` tracks it
    const isAppActive = appActivityState.isActive;

    /**
     * 🎯 목적: 검색 필터링 + 메트릭 데이터 전처리
     *
     * 📝 useMemo 제거 이유:
     * - MobX observer 컴포넌트에서 useMemo + observable 의존성은 충돌 발생
     * - kubeMetrics.length만 의존성으로 넣으면 내용 변경 시 재계산 안 됨
     * - observer가 이미 MobX 레벨에서 최적화하므로 useMemo 불필요
     */
    const filteredPodsWithMetrics = (() => {
      let filtered = pods.slice();

      // 검색 필터 (Name, Namespace, Status 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (pod) =>
            pod.getName().toLowerCase().includes(search) ||
            pod.getNs().toLowerCase().includes(search) ||
            pod.getStatus().toLowerCase().includes(search),
        );
      }

      // 🎯 메트릭 스냅샷 캡처 (Race Condition 방지)
      // 📝 렌더링 중 kubeMetrics.replace() 호출 시 불일치 방지
      const metricsSnapshot = podStore.kubeMetrics.slice();

      // 🎯 메트릭 데이터 전처리: 각 Pod에 메트릭 추가
      // 📝 Object.create 사용: Pod 클래스 프로토타입 유지 (getName, getId 등 메서드 필요)
      //    spread operator {...pod}는 메서드를 복사하지 않음
      const podsWithMetrics: PodWithMetrics[] = filtered.map((pod) => {
        const metrics = podStore.getPodKubeMetrics(pod, metricsSnapshot);
        const wrapper = Object.create(Object.getPrototypeOf(pod), Object.getOwnPropertyDescriptors(pod));
        wrapper.metrics = metrics;
        return wrapper as PodWithMetrics;
      });

      return podsWithMetrics;
    })();

    // 🎯 아이템 카운트 변경 시 상위 컴포넌트에 알림
    useEffect(() => {
      onItemCountChange(filteredPodsWithMetrics.length);
    }, [filteredPodsWithMetrics.length, onItemCountChange]);

    /**
     * 🎯 목적: Pod Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([podStore], {
        onLoadFailure: (error) => {
          console.error("[Pods] Failed to load pods:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [podStore, subscribeStores]);

    /**
     * 🎯 목적: Pod 메트릭 주기적 갱신 (앱 가시성 연동)
     */
    useEffect(() => {
      if (!isAppActive) {
        return;
      }

      void podStore.loadKubeMetrics();

      const intervalId = setInterval(() => {
        void podStore.loadKubeMetrics();
      }, REFRESH_METRICS_INTERVAL * 1000);

      return () => {
        clearInterval(intervalId);
      };
    }, [podStore, isAppActive]);

    return (
      <KubeDataTable
        data={filteredPodsWithMetrics}
        columns={podColumns}
        enableColumnResizing={true}
        enableRowSelection={true}
        enablePagination={true}
        defaultPageSize={40}
        getRowId={(pod) => pod.getId()}
        dockHeight={dockStore.isOpen ? dockStore.height : 0}
        tableOffset={TOTAL_TABLE_OFFSET}
        onRowClick={onRowClick}
        onSelectionChange={onSelectionChange}
        emptyMessage="No Pods found"
        className="h-full"
        selectedItem={isPanelOpen ? selectedPod : undefined}
        renderContextMenu={(pod) => <ResourceContextMenu object={pod} />}
      />
    );
  },
);

/**
 * 🎯 목적: Pod 목록을 KubeDataTable로 렌더링
 *
 * @remarks
 * - observer를 테이블 영역(PodTableContent)으로 제한
 * - 메뉴바, 다이얼로그 등은 MobX 반응에서 제외되어 불필요한 리렌더링 방지
 */
const NonInjectedPodCommonTable = ({
  podStore,
  namespaceStore,
  dockStore,
  subscribeStores,
  appActivityState,
  className,
}: Dependencies) => {
  // 🎯 상태 관리 (observer 외부에서 관리)
  const [searchValue, setSearchValue] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedPod, setSelectedPod] = useState<PodWithMetrics | undefined>(undefined);
  const [selectedRows, setSelectedRows] = useState<Pod[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemCount, setItemCount] = useState(0);

  /**
   * 🎯 목적: Pod 행 클릭 핸들러 (Detail Panel 토글)
   */
  const handleRowClick = useCallback(
    (pod: PodWithMetrics) => {
      if (selectedPod?.getId() === pod.getId()) {
        setIsPanelOpen(false);
        setSelectedPod(undefined);
      } else {
        setSelectedPod(pod);
        setIsPanelOpen(true);
      }
    },
    [selectedPod],
  );

  /**
   * 🎯 목적: 행 선택 변경 핸들러
   */
  const handleSelectionChange = useCallback((selectedPods: Pod[]) => {
    setSelectedRows(selectedPods);
  }, []);

  /**
   * 🎯 목적: 아이템 카운트 변경 핸들러
   */
  const handleItemCountChange = useCallback((count: number) => {
    setItemCount(count);
  }, []);

  /**
   * 🎯 목적: 선택된 행 개수 계산
   */
  const selectedCount = selectedRows.length;

  /**
   * 🎯 목적: Delete 버튼 클릭 핸들러
   */
  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  /**
   * 🎯 목적: 삭제 확인 핸들러 (실제 Pod 삭제 수행)
   */
  const handleDeleteConfirm = async () => {
    try {
      await Promise.all(
        selectedRows.map(async (pod) => {
          await podStore.remove(pod);
        }),
      );

      setSelectedRows([]);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("[Pods] Failed to delete pods:", error);
    }
  };

  return (
    <div className={className || ""}>
      <ResourceTableLayout
        title="Pods"
        itemCount={itemCount}
        showNamespaceFilter={true}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search pods..."
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
        {/* 🎯 PodTableContent: observer 범위를 테이블로 제한 */}
        {/* ============================================ */}
        <PodTableContent
          podStore={podStore}
          dockStore={dockStore}
          subscribeStores={subscribeStores}
          appActivityState={appActivityState}
          searchValue={searchValue}
          selectedPod={selectedPod}
          isPanelOpen={isPanelOpen}
          onRowClick={handleRowClick}
          onSelectionChange={handleSelectionChange}
          onItemCountChange={handleItemCountChange}
        />
      </ResourceTableLayout>

      {/* ============================================ */}
      {/* 🎯 Pod Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
      {/* ============================================ */}
      <PodDetailPanel isOpen={isPanelOpen} pod={selectedPod} onClose={() => setIsPanelOpen(false)} />

      {/* ============================================ */}
      {/* 🎯 Delete Confirmation Dialog: 삭제 확인 다이얼로그 */}
      {/* ============================================ */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pods</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} selected Pod(s)?
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
};

/**
 * 🎯 목적: Injectable로 감싼 PodCommonTable 컴포넌트
 */
export const PodCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "podStore" | "namespaceStore" | "dockStore" | "subscribeStores" | "appActivityState">
>(NonInjectedPodCommonTable, {
  getProps: (di, props) => ({
    podStore: di.inject(podStoreInjectable),
    namespaceStore: di.inject(namespaceStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    appActivityState: di.inject(appActivityStateInjectable),
    ...props,
  }),
});
