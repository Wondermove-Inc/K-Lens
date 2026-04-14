/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Helm Release 목록 테이블 - ResourceTableLayout 기반 구현
 *
 * 구성 요소:
 * - ResourceTableLayout (제목, 네임스페이스 필터, 검색)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - Release Detail Panel (행 클릭 시 상세 정보 표시)
 * - Rollback Dialog (ReleaseRollbackDialog)
 * - MobX observable releases 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → releases.get().slice() 변환
 * - 컬럼 정의는 releases-columns.tsx에서 import
 * - 검색 필터: Name, Namespace, Chart, Status, Version 기준
 *
 * 🔄 변경이력:
 * - 2025-10-31: 초기 생성 (Pod 패턴 적용)
 * - 2025-11-01: ResourceTableLayout 적용 (shadcn Select 네임스페이스 필터 통합)
 * - 2025-11-02: ReleaseDetailPanel 연결 (shadcn DetailPanel 기반)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ArrowUpToLine, History, Trash2 } from "lucide-react";
import { observer } from "mobx-react";
import React, { useMemo, useState } from "react";
import navigateToHelmReleasesInjectable from "../../../common/front-end-routing/routes/cluster/helm/releases/navigate-to-helm-releases.injectable";
import { KubeDataTable } from "../common/kube-data-table/kube-data-table";
import { ResourceTableLayout } from "../common/resource-table-layout";
import dockStoreInjectable from "../dock/dock/store.injectable";
import createUpgradeChartTabInjectable from "../dock/upgrade-chart/create-upgrade-chart-tab.injectable";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
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
import { ContextMenuItem, ContextMenuSeparator } from "../shadcn-ui/context-menu";
import { ReleaseRollbackDialog } from "./dialog/dialog";
import openHelmReleaseRollbackDialogInjectable from "./dialog/open.injectable";
import { ReleaseDetailPanel } from "./release-detail-panel";
import releasesInjectable from "./releases.injectable";
import { releaseColumns } from "./releases-columns";
import removableReleasesInjectable from "./removable-releases.injectable";

import type { IComputedValue } from "mobx";

import type { NavigateToHelmReleases } from "../../../common/front-end-routing/routes/cluster/helm/releases/navigate-to-helm-releases.injectable";
import type { HelmRelease } from "../../../common/k8s-api/endpoints/helm-releases.api";
import type { DockStore } from "../dock/dock/store";
import type { OpenHelmReleaseRollbackDialog } from "./dialog/open.injectable";
import type { RemovableHelmRelease } from "./removable-releases";

/**
 * 🎯 목적: ReleasesCommonTable Dependencies 인터페이스
 *
 * 📝 주의사항: export 필수 (withInjectables 타입 추론에 필요)
 */
export interface ReleasesCommonTableDependencies {
  releases: IComputedValue<RemovableHelmRelease[]>;
  releasesArePending: IComputedValue<boolean>;
  navigateToHelmReleases: NavigateToHelmReleases;
  dockStore: DockStore;
  createUpgradeChartTab: (release: HelmRelease) => string;
  openRollbackDialog: OpenHelmReleaseRollbackDialog;
  className?: string;
}

/**
 * 🎯 목적: Helm Release 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (releases, releasesArePending, navigateToHelmReleases, dockStore, className)
 * @returns KubeDataTable 기반 Helm Release 목록 테이블 + Rollback Dialog
 */
const NonInjectedReleasesCommonTable = observer(
  ({
    releases,
    releasesArePending,
    navigateToHelmReleases,
    dockStore,
    createUpgradeChartTab,
    openRollbackDialog,
    className,
  }: ReleasesCommonTableDependencies) => {
    // releases는 IComputedValue<RemovableHelmRelease[]>
    const releaseList = releases.get().slice();

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedRelease, setSelectedRelease] = useState<(typeof releaseList)[0] | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof releaseList)[number][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 검색 필터링 (Name, Namespace, Chart, Status, Version 기준)
     */
    const filteredReleases = useMemo(() => {
      if (!searchValue.trim()) {
        return releaseList;
      }

      const search = searchValue.toLowerCase();
      return releaseList.filter(
        (r) =>
          r.getName().toLowerCase().includes(search) ||
          r.getNs().toLowerCase().includes(search) ||
          r.getChart().toLowerCase().includes(search) ||
          r.getStatus().toLowerCase().includes(search) ||
          r.getVersion().toLowerCase().includes(search),
      );
    }, [releaseList, searchValue]);

    /**
     * 🎯 목적: Helm Release 행 클릭 핸들러 (Detail Panel 토글)
     * @param release - 클릭된 Helm Release 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (release: (typeof releaseList)[0]) => {
      if (selectedRelease?.getId() === release.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedRelease(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedRelease(release);
        setIsPanelOpen(true);
      }
    };

    // 🎯 선택된 행 개수 계산
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 테이블 행 선택 핸들러 (Delete 버튼 활성화)
     * @param selectedItems - 선택된 Helm Release 배열
     */
    const handleSelectionChange = (selectedItems: (typeof releaseList)[number][]) => {
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
          selectedRows.map(async (release) => {
            await release.delete();
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[HelmReleases] Failed to delete:", error);
      }
    };

    return (
      <SiblingsInTabLayout>
        <ResourceTableLayout
          title="Releases"
          itemCount={filteredReleases.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search releases..."
          showNamespaceFilter={true}
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
            data={filteredReleases}
            columns={releaseColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage="No Releases found"
            selectedItem={isPanelOpen ? selectedRelease : undefined}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            renderContextMenu={(item) => (
              <>
                <ContextMenuItem onSelect={() => requestAnimationFrame(() => createUpgradeChartTab(item))}>
                  <ArrowUpToLine className="h-4 w-4" />
                  Upgrade
                </ContextMenuItem>
                {item.getRevision() > 1 && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => requestAnimationFrame(() => openRollbackDialog(item))}>
                      <History className="h-4 w-4" />
                      Rollback
                    </ContextMenuItem>
                  </>
                )}
              </>
            )}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Release Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <ReleaseDetailPanel isOpen={isPanelOpen} release={selectedRelease} onClose={() => setIsPanelOpen(false)} />

        {/* ============================================ */}
        {/* 🎯 Rollback Dialog: 기존 다이얼로그 유지 */}
        {/* ============================================ */}
        <ReleaseRollbackDialog />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Helm Releases</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Helm Release(s)?
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
      </SiblingsInTabLayout>
    );
  },
);

/**
 * 🎯 목적: Injectable로 감싼 ReleasesCommonTable 컴포넌트
 */
export const ReleasesCommonTable = withInjectables<
  ReleasesCommonTableDependencies,
  Omit<
    ReleasesCommonTableDependencies,
    | "releases"
    | "releasesArePending"
    | "navigateToHelmReleases"
    | "dockStore"
    | "createUpgradeChartTab"
    | "openRollbackDialog"
  >
>(NonInjectedReleasesCommonTable, {
  getProps: (di, props) => ({
    releases: di.inject(removableReleasesInjectable),
    releasesArePending: di.inject(releasesInjectable).pending,
    navigateToHelmReleases: di.inject(navigateToHelmReleasesInjectable),
    dockStore: di.inject(dockStoreInjectable),
    createUpgradeChartTab: di.inject(createUpgradeChartTabInjectable),
    openRollbackDialog: di.inject(openHelmReleaseRollbackDialogInjectable),
    ...props,
  }),
});
