/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Ingress Class 목록 테이블 - ResourceTableLayout 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (제목, 검색)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - MobX observable ingressClassStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - ingressClassStore.items 사용 (Cluster-scoped 리소스)
 * - 컬럼 정의는 ingress-classes-columns.tsx에서 import
 * - 검색 필터: Name, Controller, API Group, Scope, Kind 기준
 * - Ingress Classes는 Cluster-scoped 리소스이므로 네임스페이스 필터 없음
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
import { IngressClassDetailPanel } from "./ingress-class-detail-panel";
import ingressClassStoreInjectable from "./ingress-class-store.injectable";
import { ingressClassColumns } from "./ingress-classes-columns";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { IngressClassStore } from "./ingress-class-store";

/**
 * 🎯 목적: IngressClassCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  ingressClassStore: IngressClassStore;
  dockStore: DockStore;
  subscribeStores: SubscribeStores;
  className?: string;
}

/**
 * 🎯 목적: Ingress Class 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (ingressClassStore, dockStore, subscribeStores, className)
 * @returns KubeDataTable 기반 Ingress Class 목록 테이블
 */
const NonInjectedIngressClassCommonTable = observer(
  ({ ingressClassStore, dockStore, subscribeStores, className }: Dependencies) => {
    // ingressClassStore.items는 MobX observable 배열 (Cluster-scoped)
    const ingressClasses = ingressClassStore.items.slice();

    /**
     * 🎯 목적: Ingress Class Store 구독
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([ingressClassStore], {
        onLoadFailure: (error) => {
          console.error("[Ingress Classes] Failed to load:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [ingressClassStore, subscribeStores]);

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedIngressClass, setSelectedIngressClass] = useState<(typeof ingressClasses)[0] | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof ingressClasses)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 검색 필터링 (Name, Controller, API Group, Scope, Kind 기준)
     */
    const filteredIngressClasses = useMemo(() => {
      if (!searchValue.trim()) {
        return ingressClasses;
      }

      const search = searchValue.toLowerCase();
      return ingressClasses.filter(
        (ic) =>
          ic.getName().toLowerCase().includes(search) ||
          ic.getController().toLowerCase().includes(search) ||
          (ic.getCtrlApiGroup() ?? "").toLowerCase().includes(search) ||
          (ic.getCtrlScope() ?? "").toLowerCase().includes(search) ||
          (ic.getCtrlKind() ?? "").toLowerCase().includes(search),
      );
    }, [ingressClasses, searchValue]);

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 행 클릭 핸들러 - Ingress Class Detail Panel 토글
     *
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (ingressClass: (typeof ingressClasses)[0]) => {
      if (selectedIngressClass?.getId() === ingressClass.getId()) {
        setIsPanelOpen(false);
        setSelectedIngressClass(undefined);
      } else {
        setSelectedIngressClass(ingressClass);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: Detail Panel 닫기 핸들러
     */
    const handleClosePanel = () => {
      setIsPanelOpen(false);
      setSelectedIngressClass(undefined);
    };

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Ingress Class 배열
     */
    const handleSelectionChange = (selectedItems: (typeof ingressClasses)[number][]) => {
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
          selectedRows.map(async (ingressClass) => {
            await ingressClassStore.remove(ingressClass);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[IngressClass] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title="Ingress Classes"
          itemCount={filteredIngressClasses.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search ingress classes..."
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
            data={filteredIngressClasses}
            columns={ingressClassColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(row) => row.getId()}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage="No Ingress Classes found"
            selectedItem={isPanelOpen ? selectedIngressClass : undefined}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 우측 슬라이드 패널: Ingress Class 상세 정보 */}
        {/* ============================================ */}
        <IngressClassDetailPanel isOpen={isPanelOpen} ingressClass={selectedIngressClass} onClose={handleClosePanel} />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Ingress Classes</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Ingress Class(es)?
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
 * 🎯 목적: Injectable로 감싼 IngressClassCommonTable 컴포넌트
 */
export const IngressClassCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "ingressClassStore" | "dockStore" | "subscribeStores">
>(NonInjectedIngressClassCommonTable, {
  getProps: (di, props) => ({
    ingressClassStore: di.inject(ingressClassStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    ...props,
  }),
});
