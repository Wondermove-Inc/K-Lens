/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Helm Charts 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Charts {count} items, 검색 입력)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - Helm Chart Details Panel (선택적 - 기존 HelmChartDetails 재사용)
 * - IAsyncComputed helmCharts 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - HelmChart는 KubeObject가 아닌 ItemObject 타입
 * - helmChartsInjectable은 IAsyncComputed<HelmChart[]> 타입
 * - Helm Charts는 클러스터 전역 리소스 → 네임스페이스 필터 불필요
 * - KubeDataTable은 순수 배열 필요 → charts.value.get() 변환
 * - 컬럼 정의는 helm-charts-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 *
 * 🔄 변경이력:
 * - 2025-11-07: 초기 생성 (CronJobs/Events CommonTable 패턴 기반, Helm Charts 적용)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React, { useState } from "react";
import navigateToHelmChartsInjectable from "../../../common/front-end-routing/routes/cluster/helm/charts/navigate-to-helm-charts.injectable";
import { KubeDataTable } from "../common/kube-data-table/kube-data-table";
import { ResourceTableLayout } from "../common/resource-table-layout";
import dockStoreInjectable from "../dock/dock/store.injectable";
import { HelmChartDetailPanel } from "./helm-chart-detail-panel";
import helmChartsInjectable from "./helm-charts/helm-charts.injectable";
import { helmChartsColumns } from "./helm-charts-columns";

import type { IAsyncComputed } from "@ogre-tools/injectable-react";

import type { NavigateToHelmCharts } from "../../../common/front-end-routing/routes/cluster/helm/charts/navigate-to-helm-charts.injectable";
import type { HelmChart } from "../../../common/k8s-api/endpoints/helm-charts.api";
import type { DockStore } from "../dock/dock/store";

/**
 * 🎯 목적: HelmChartsCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  helmCharts: IAsyncComputed<HelmChart[]>;
  dockStore: DockStore;
  navigateToHelmCharts: NavigateToHelmCharts;
  className?: string;
}

/**
 * 🎯 목적: 레이아웃 높이 상수 (Events/CronJobs Table과 동일)
 *
 * @remarks
 * 테이블 maxHeight 계산을 위한 정확한 오프셋 값
 * - calc(100vh - TOTAL_TABLE_OFFSET - dockHeight)
 */
const LAYOUT_OFFSETS = {
  clusterManagerHeader: 40, // ClusterManager Header
  statusBar: 21, // StatusBar
  mainLayoutTabs: 36, // MainTabContainer (탭)
  chartsMenuBar: 65, // HelmChartsCommonTable 상단 메뉴 (제목, 검색)
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.chartsMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: Helm Charts 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (helmCharts, dockStore, navigateToHelmCharts, className)
 * @returns KubeDataTable 기반 Helm Charts 목록 테이블 + Details Panel
 */
const NonInjectedHelmChartsCommonTable = observer(
  ({ helmCharts, dockStore, navigateToHelmCharts, className }: Dependencies) => {
    // IAsyncComputed → 순수 배열 변환
    const charts = helmCharts.value.get() || [];

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [selectedChart, setSelectedChart] = useState<HelmChart | undefined>(undefined);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - Name, Description, Repository, Keywords 기준 검색
     * - IAsyncComputed.value.get()로 데이터 추출
     */
    const filteredCharts = React.useMemo(() => {
      let filtered = charts.slice(); // 순수 배열 복사

      // 검색 필터 (Name, Description, Repository, Keywords 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (chart) =>
            chart.getName().toLowerCase().includes(search) ||
            chart.getDescription().toLowerCase().includes(search) ||
            chart.getRepository().toLowerCase().includes(search) ||
            chart.getKeywords().some((keyword: string) => keyword.toLowerCase().includes(search)),
        );
      }

      return filtered;
    }, [charts, searchValue]);

    /**
     * 🎯 목적: Helm Chart 행 클릭 핸들러 (Details 표시/숨김 토글)
     * @param chart - 클릭된 HelmChart 객체
     */
    const handleRowClick = (chart: HelmChart) => {
      if (chart === selectedChart) {
        // 이미 선택된 차트 클릭 → 숨기기
        setSelectedChart(undefined);
        navigateToHelmCharts();
      } else {
        // 새 차트 선택 → 표시
        setSelectedChart(chart);
        navigateToHelmCharts({
          chartName: chart.getName(),
          repo: chart.getRepository(),
        });
      }
    };

    /**
     * 🎯 목적: Details Panel 닫기 핸들러
     */
    const hideDetails = () => {
      setSelectedChart(undefined);
      navigateToHelmCharts();
    };

    return (
      <div className={className || ""}>
        <ResourceTableLayout
          title="Charts"
          itemCount={filteredCharts.length}
          showNamespaceFilter={false} // Helm Charts는 클러스터 전역 리소스
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search charts..."
        >
          {/* ============================================ */}
          {/* 🎯 KubeDataTable: Helm Charts 목록 테이블 */}
          {/* ============================================ */}
          <KubeDataTable
            data={filteredCharts}
            columns={helmChartsColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(chart) => chart.getFullName("-")}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            onRowClick={handleRowClick}
            emptyMessage="No Charts found"
            className="h-full"
            selectedItem={selectedChart}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Helm Chart Details Panel: shadcn DetailPanel 사용 */}
        {/* ============================================ */}
        <HelmChartDetailPanel chart={selectedChart} hideDetails={hideDetails} />
      </div>
    );
  },
);

/**
 * 🎯 목적: Injectable로 감싼 HelmChartsCommonTable 컴포넌트
 *
 * @remarks
 * - helmCharts: IAsyncComputed<HelmChart[]> - Helm Charts 목록 (비동기 computed)
 * - dockStore: Dock 높이 정보 제공 (테이블 maxHeight 계산용)
 * - navigateToHelmCharts: Helm Charts 라우팅 (Details 표시/숨김)
 */
export const HelmChartsCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "helmCharts" | "dockStore" | "navigateToHelmCharts">
>(NonInjectedHelmChartsCommonTable, {
  getProps: (di, props) => ({
    helmCharts: di.inject(helmChartsInjectable),
    dockStore: di.inject(dockStoreInjectable),
    navigateToHelmCharts: di.inject(navigateToHelmChartsInjectable),
    ...props,
  }),
});
