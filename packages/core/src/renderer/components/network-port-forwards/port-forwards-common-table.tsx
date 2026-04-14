/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Port Forward 목록 테이블 - ResourceTableLayout 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (제목, 검색)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - Port Forward Detail Drawer (행 클릭 시 상세 정보 표시)
 * - MobX observable portForwardStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - portForwardStore.items 사용 (active port forwards 목록)
 * - 컬럼 정의는 port-forwards-columns.tsx에서 import
 * - Port Forwards는 네임스페이스 필터 없음 (active sessions 관리)
 *
 * 🔄 변경이력:
 * - 2025-10-31: 초기 생성 (shadcn UI 마이그레이션, Pod 패턴 기반)
 * - 2025-11-01: ResourceTableLayout 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useState } from "react";
import navigateToPortForwardsInjectable from "../../../common/front-end-routing/routes/cluster/network/port-forwards/navigate-to-port-forwards.injectable";
import portForwardStoreInjectable from "../../port-forward/port-forward-store/port-forward-store.injectable";
import { KubeDataTable } from "../common/kube-data-table/kube-data-table";
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
import { PortForwardDetails } from "./port-forward-details";
import { portForwardColumns } from "./port-forwards-columns";
import portForwardsRouteParametersInjectable from "./port-forwards-route-parameters.injectable";

import type { IComputedValue } from "mobx";

import type { NavigateToPortForwards } from "../../../common/front-end-routing/routes/cluster/network/port-forwards/navigate-to-port-forwards.injectable";
import type { PortForwardItem, PortForwardStore } from "../../port-forward";
import type { DockStore } from "../dock/dock/store";

/**
 * 🎯 목적: PortForwardCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  portForwardStore: PortForwardStore;
  dockStore: DockStore;
  forwardport: IComputedValue<string>;
  navigateToPortForwards: NavigateToPortForwards;
  className?: string;
}

/**
 * 🎯 목적: Port Forward 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (portForwardStore, dockStore, forwardport, navigateToPortForwards, className)
 * @returns KubeDataTable 기반 Port Forward 목록 테이블 + Detail Panel
 */
const NonInjectedPortForwardCommonTable = observer(
  ({ portForwardStore, dockStore, forwardport, navigateToPortForwards, className }: Dependencies) => {
    // portForwardStore.items는 MobX observable array
    const portForwards = portForwardStore.items.slice();

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [_isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedPortForward, setSelectedPortForward] = useState<PortForwardItem | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof portForwards)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: URL 파라미터에서 선택된 Port Forward 찾기
     */
    useEffect(() => {
      const forwardportId = forwardport.get();
      if (forwardportId) {
        const pf = portForwardStore.getById(forwardportId);
        if (pf) {
          setSelectedPortForward(pf);
          setIsPanelOpen(true);
        }
      }
    }, [forwardport, portForwardStore]);

    /**
     * 🎯 목적: 검색 필터링 (Name, Namespace, Kind, Status 기준)
     */
    const filteredPortForwards = useMemo(() => {
      if (!searchValue.trim()) {
        return portForwards;
      }

      const search = searchValue.toLowerCase();
      return portForwards.filter(
        (pf) =>
          pf.getName().toLowerCase().includes(search) ||
          pf.getNs().toLowerCase().includes(search) ||
          pf.getKind().toLowerCase().includes(search) ||
          pf.getStatus().toLowerCase().includes(search),
      );
    }, [portForwards, searchValue]);

    /**
     * 🎯 목적: Port Forward Store 구독 (watch)
     */
    useEffect(() => {
      const unsubscribe = portForwardStore.watch();

      return () => {
        unsubscribe();
      };
    }, [portForwardStore]);

    /**
     * 🎯 목적: Port Forward 행 클릭 핸들러 (Detail Panel 열기)
     */
    const handleRowClick = (pf: PortForwardItem) => {
      if (selectedPortForward === pf) {
        hideDetails();
      } else {
        showDetails(pf);
      }
    };

    /**
     * 🎯 목적: Port Forward 상세 정보 표시
     */
    const showDetails = (pf: PortForwardItem) => {
      setSelectedPortForward(pf);
      setIsPanelOpen(true);
      navigateToPortForwards({ forwardport: pf.getId() });
    };

    /**
     * 🎯 목적: Port Forward 상세 정보 숨기기
     */
    const hideDetails = () => {
      setIsPanelOpen(false);
      setSelectedPortForward(undefined);
      navigateToPortForwards();
    };

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Port Forward 배열
     */
    const handleSelectionChange = (selectedItems: (typeof portForwards)[number][]) => {
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
        await portForwardStore.removeItems(selectedRows);
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[PortForward] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title="Port Forwarding"
          itemCount={filteredPortForwards.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search port forwards..."
          showNamespaceFilter={false}
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
            data={filteredPortForwards}
            columns={portForwardColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            getRowId={(row) => row.getId()}
            emptyMessage="No Port Forwards found"
            selectedItem={_isPanelOpen ? selectedPortForward : undefined}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
          />
        </ResourceTableLayout>

        <PortForwardDetails isOpen={_isPanelOpen} portForward={selectedPortForward} onClose={hideDetails} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Port Forwards</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Port Forward(s)?
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
 * 🎯 목적: Injectable로 감싼 PortForwardCommonTable 컴포넌트
 *
 * @remarks
 * - portForwardStore: Port Forward 목록 및 상태 관리
 * - dockStore: Dock 높이 정보 제공 (테이블 maxHeight 계산용)
 * - forwardport: URL 파라미터 (선택된 Port Forward ID)
 * - navigateToPortForwards: 라우팅 함수 (Detail Panel 열기/닫기)
 */
export const PortForwardCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "portForwardStore" | "dockStore" | "forwardport" | "navigateToPortForwards">
>(NonInjectedPortForwardCommonTable, {
  getProps: (di, props) => ({
    portForwardStore: di.inject(portForwardStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    ...di.inject(portForwardsRouteParametersInjectable),
    navigateToPortForwards: di.inject(navigateToPortForwardsInjectable),
    ...props,
  }),
});
