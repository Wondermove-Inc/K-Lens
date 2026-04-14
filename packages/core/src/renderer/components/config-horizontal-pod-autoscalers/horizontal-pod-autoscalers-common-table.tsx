/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: HPA 공통 테이블 컴포넌트 (shadcn UI + TanStack Table 사용)
 *
 * 📱 반응형 디자인:
 * - 모바일 (<640px): flex-col, w-full (세로 배치, 전체 너비)
 * - 태블릿 (≥640px): sm:flex-row, sm:w-48 (가로 배치, 192px 너비)
 * - 데스크톱 (≥768px): md:w-64 (256px 너비)
 *
 * 📝 주의사항:
 *   - MobX store의 items를 pure array로 변환 (.slice())
 *   - KubeDataTable에 정렬/필터/페이지네이션 위임
 *   - 선택된 행은 rowSelection state로 관리
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 *   - 2025-10-31: ResourceTableLayout 적용 (네임스페이스 필터, 검색 추가)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useState } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { KubeDataTable } from "../common/kube-data-table/kube-data-table";
import { ResourceContextMenu } from "../common/resource-context-menu";
import { ResourceTableLayout } from "../common/resource-table-layout";
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
import getHorizontalPodAutoscalerMetrics from "./get-metrics.injectable";
import {
  type HorizontalPodAutoscalerWithMetrics,
  horizontalPodAutoscalerColumns,
} from "./horizontal-pod-autoscalers-columns";
import { HpaDetailPanel } from "./hpa-detail-panel";
import horizontalPodAutoscalerStoreInjectable from "./store.injectable";

import type { HorizontalPodAutoscaler } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { HorizontalPodAutoscalerStore } from "./store";

export interface HorizontalPodAutoscalersCommonTableProps {
  /**
   * 테이블 헤더 타이틀
   */
  title?: string;
}

interface Dependencies {
  horizontalPodAutoscalerStore: HorizontalPodAutoscalerStore;
  getMetrics: (hpa: HorizontalPodAutoscaler) => string[];
  subscribeStores: SubscribeStores;
}

/**
 * HPA 공통 테이블 컴포넌트 (Injectable 없는 순수 컴포넌트)
 */
const NonInjectedHorizontalPodAutoscalersCommonTable = observer(
  ({
    title = "Horizontal Pod Autoscalers",
    horizontalPodAutoscalerStore,
    getMetrics,
    subscribeStores,
  }: HorizontalPodAutoscalersCommonTableProps & Dependencies) => {
    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedHpa, setSelectedHpa] = useState<HorizontalPodAutoscalerWithMetrics | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<HorizontalPodAutoscaler[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // 🔄 Kubernetes API 구독: HPA 데이터 자동 로딩
    useEffect(() => {
      const unsubscribe = subscribeStores([horizontalPodAutoscalerStore], {
        onLoadFailure: (error) => console.error("[HPA] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [horizontalPodAutoscalerStore, subscribeStores]);

    // 🎯 MobX computed getter (namespace 필터링된 데이터) → pure array 변환
    const hpas = horizontalPodAutoscalerStore.contextItems.slice();

    // 🎯 검색 필터링
    const filteredHPAs = useMemo(() => {
      let filtered = hpas;

      // 검색 필터 (Name, Namespace 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (hpa) => hpa.getName().toLowerCase().includes(search) || hpa.getNs().toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [hpas, searchValue]);

    // 🎯 메트릭 전처리: Pod 패턴과 동일
    const hpasWithMetrics = useMemo(() => {
      return filteredHPAs.map((hpa): HorizontalPodAutoscalerWithMetrics => {
        // formatHpaTargets 로직 inline으로 이동
        const metrics = hpa.getMetrics();
        const cpuUtilization = hpa.spec?.targetCPUUtilizationPercentage;

        let formattedMetrics = "--";

        if (metrics.length === 0 && !cpuUtilization) {
          formattedMetrics = "--";
        } else {
          const metricsArray = getMetrics(hpa);
          if (metricsArray.length > 0) {
            const metricsRemain = metrics.length > 1 ? ` +${metrics.length - 1} more...` : "";
            formattedMetrics = `${metricsArray[0]}${metricsRemain}`;
          }
        }

        return Object.assign(hpa, { formattedMetrics });
      });
    }, [filteredHPAs, getMetrics]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: HPA 행 클릭 핸들러 (Detail Panel 토글)
     * @param hpa - 클릭된 HorizontalPodAutoscaler 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (hpa: HorizontalPodAutoscalerWithMetrics) => {
      if (selectedHpa?.getId() === hpa.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedHpa(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedHpa(hpa);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 HPA 배열
     */
    const handleSelectionChange = (selectedItems: HorizontalPodAutoscaler[]) => {
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
          selectedRows.map(async (hpa) => {
            await horizontalPodAutoscalerStore.remove(hpa);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[HPA] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title={title}
          itemCount={hpasWithMetrics.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search HPAs..."
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
            data={hpasWithMetrics}
            columns={horizontalPodAutoscalerColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            getRowId={(row) => row.getId()}
            emptyMessage="No Horizontal Pod Autoscalers found"
            selectedItem={isPanelOpen ? selectedHpa : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 HPA Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <HpaDetailPanel isOpen={isPanelOpen} hpa={selectedHpa} onClose={() => setIsPanelOpen(false)} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Horizontal Pod Autoscalers</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Horizontal Pod Autoscaler(s)?
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
 * 🎯 목적: Injectable로 감싼 HorizontalPodAutoscalersCommonTable 컴포넌트
 */
export const HorizontalPodAutoscalersCommonTable = withInjectables<
  Dependencies,
  HorizontalPodAutoscalersCommonTableProps
>(NonInjectedHorizontalPodAutoscalersCommonTable, {
  getProps: (di, props) => ({
    ...props,
    horizontalPodAutoscalerStore: di.inject(horizontalPodAutoscalerStoreInjectable),
    getMetrics: di.inject(getHorizontalPodAutoscalerMetrics),
    subscribeStores: di.inject(subscribeStoresInjectable),
  }),
});
