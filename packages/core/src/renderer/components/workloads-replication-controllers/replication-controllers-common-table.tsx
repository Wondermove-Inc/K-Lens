/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Replication Controller 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Replication Controllers {count} items, 네임스페이스 드롭다운, 검색 입력)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable replicationControllerStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → replicationControllerStore.items.slice() 변환
 * - 컬럼 정의는 replication-controllers-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 *
 * 🔄 변경이력:
 * - 2025-10-31: 초기 생성 (KubeDataTable 기반 구현, ReplicaSets CommonTable 패턴 참조)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { KubeDataTable } from "../common/kube-data-table/kube-data-table";
import { ResourceContextMenu } from "../common/resource-context-menu";
import { ResourceTableLayout } from "../common/resource-table-layout";
import dockStoreInjectable from "../dock/dock/store.injectable";
import { ReplicationControllerDetailPanel } from "./replication-controller-detail-panel";
import replicationControllerStoreInjectable from "./replication-controller-store.injectable";
import { replicationControllerColumns } from "./replication-controllers-columns";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { ReplicationControllerStore } from "./replication-controller-store";

/**
 * 🎯 목적: ReplicationControllersCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  replicationControllerStore: ReplicationControllerStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  className?: string;
}

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
  rcMenuBar: 65, // ReplicationControllersCommonTable 상단 메뉴 (제목, 네임스페이스, 검색)
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.rcMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: Replication Controller 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (replicationControllerStore, dockStore, subscribeStores, className)
 * @returns KubeDataTable 기반 Replication Controller 목록 테이블
 */
const NonInjectedReplicationControllersCommonTable = observer(
  ({ replicationControllerStore, dockStore, subscribeStores, className }: Dependencies) => {
    // replicationControllerStore.contextItems는 MobX computed getter (namespace 필터링 자동 적용)
    const replicationControllers = replicationControllerStore.contextItems;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedRC, setSelectedRC] = useState<(typeof replicationControllers)[0] | undefined>(undefined);

    // 🎯 subscribeStores - Kubernetes API watch 연결
    useEffect(() => {
      const unsubscribe = subscribeStores([replicationControllerStore], {
        onLoadFailure: (error) => {
          console.error("[ReplicationControllers] Failed to load replication controllers:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [replicationControllerStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링 (Name, Namespace, Selector 라벨 기준)
     *
     * @remarks
     * - replicationControllerStore.contextItems가 이미 namespace 필터링 수행
     * - 검색 필터만 추가로 적용
     */
    const filteredRCs = React.useMemo(() => {
      // MobX observable → 순수 배열 변환
      let filtered = replicationControllers.slice();

      // 검색 필터 (Name, Namespace, Selector 라벨)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter((rc) => {
          return (
            rc.getName().toLowerCase().includes(search) ||
            rc.getNs().toLowerCase().includes(search) ||
            rc.getSelectorLabels().some((label) => label.toLowerCase().includes(search))
          );
        });
      }

      return filtered;
    }, [replicationControllers, searchValue]);

    /**
     * 🎯 목적: Replication Controller 행 클릭 핸들러 (Detail Panel 토글)
     *
     * @param rc - 클릭된 Replication Controller 객체
     *
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (rc: (typeof replicationControllers)[0]) => {
      if (selectedRC?.getId() === rc.getId()) {
        setIsPanelOpen(false);
        setSelectedRC(undefined);
      } else {
        setSelectedRC(rc);
        setIsPanelOpen(true);
      }
    };

    return (
      <div className={className || ""}>
        <ResourceTableLayout
          title="Replication Controllers"
          itemCount={filteredRCs.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search replication controllers..."
        >
          {/* ============================================ */}
          {/* 🎯 KubeDataTable: Replication Controller 목록 테이블 */}
          {/* ============================================ */}
          <KubeDataTable
            data={filteredRCs}
            columns={replicationControllerColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            onRowClick={handleRowClick}
            emptyMessage="No Replication Controllers found"
            className="h-full"
            selectedItem={isPanelOpen ? selectedRC : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Replication Controller Detail Panel */}
        {/* ============================================ */}
        <ReplicationControllerDetailPanel
          isOpen={isPanelOpen}
          replicationController={selectedRC}
          onClose={() => setIsPanelOpen(false)}
        />
      </div>
    );
  },
);

/**
 * 🎯 목적: Injectable DI 패턴 적용
 *
 * @remarks
 * - withInjectables HOC로 replicationControllerStore, dockStore, subscribeStores 주입
 * - observer HOC로 MobX observable 변화 자동 감지
 * - 외부에서 className prop 전달 가능
 */
export const ReplicationControllersCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "replicationControllerStore" | "dockStore" | "subscribeStores">
>(NonInjectedReplicationControllersCommonTable, {
  getProps: (di, props) => ({
    replicationControllerStore: di.inject(replicationControllerStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    ...props,
  }),
});
