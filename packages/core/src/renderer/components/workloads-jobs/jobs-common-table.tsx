/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Job 목록 테이블 - KubeDataTable 기반 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Jobs {count} items, 네임스페이스 드롭다운, 검색 입력)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - Job Detail Panel (행 클릭 시 상세 정보 표시)
 * - MobX observable jobStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → jobStore.items.slice() 변환
 * - 컬럼 정의는 jobs-columns.tsx에서 import
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 * - Jobs는 메트릭이 없으므로 메트릭 관련 코드 제거
 *
 * 🔄 변경이력:
 * - 2025-10-30: 초기 생성 (Pod 패턴 참조, shadcn 마이그레이션)
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
import { JobDetailPanel } from "./job-detail-panel";
import { jobColumns } from "./jobs-columns";
import jobStoreInjectable from "./store.injectable";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { NamespaceStore } from "../namespaces/store";
import type { JobStore } from "./store";

/**
 * 🎯 목적: JobCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  jobStore: JobStore;
  namespaceStore: NamespaceStore;
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
  jobMenuBar: 65, // JobCommonTable 상단 메뉴 (제목, 네임스페이스, 검색)
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.jobMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: Job 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (jobStore, dockStore, subscribeStores, className)
 * @returns KubeDataTable 기반 Job 목록 테이블 + Detail Panel
 */
const NonInjectedJobCommonTable = observer(
  ({ jobStore, namespaceStore, dockStore, subscribeStores, className }: Dependencies) => {
    // jobStore.contextItems는 MobX computed getter (즉시 필터링된 데이터)
    const jobs = jobStore.contextItems;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState<(typeof jobs)[0] | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof jobs)[0][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - jobs는 이미 contextItems로 필터링됨
     * - Jobs는 메트릭이 없으므로 메트릭 전처리 제거
     */
    const filteredJobs = React.useMemo(() => {
      // jobs는 이미 contextItems로 필터링됨
      let filtered = jobs.slice();

      // 검색 필터 (Name, Namespace, Status 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (job) =>
            job.getName().toLowerCase().includes(search) ||
            job.getNs().toLowerCase().includes(search) ||
            job.getSearchFields().some((field) => field.toLowerCase().includes(search)),
        );
      }

      return filtered;
    }, [jobs, searchValue]);

    /**
     * 🎯 목적: Job Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     *
     * @remarks
     * - KubeWatchApi.subscribeStores()를 통한 중앙 집중식 구독 관리
     * - 중복 구독 방지 및 namespace 변경 자동 감지
     * - 컴포넌트 마운트 시 store.loadAll() → store.subscribe() 자동 실행
     * - 언마운트 시 구독 자동 해제로 메모리 누수 방지
     *
     * 🔄 변경이력:
     * - 2025-10-31: Store 구독 로직 추가 (KubeWatchApi.subscribeStores() 사용)
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([jobStore], {
        onLoadFailure: (error) => {
          console.error("[Jobs] Failed to load jobs:", error);
        },
      });

      return () => {
        unsubscribe();
      };
    }, [jobStore, subscribeStores]);

    /**
     * 🎯 목적: Job 행 클릭 핸들러 (Detail Panel 토글)
     *
     * @param job - 클릭된 Job 객체
     *
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (job: (typeof jobs)[0]) => {
      if (selectedJob?.getId() === job.getId()) {
        setIsPanelOpen(false);
        setSelectedJob(undefined);
      } else {
        setSelectedJob(job);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 선택된 행 개수 계산
     */
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 행 선택 변경 핸들러
     * @param selectedJobs - 선택된 Job 배열
     */
    const handleSelectionChange = (selectedJobs: (typeof jobs)[0][]) => {
      setSelectedRows(selectedJobs);
    };

    /**
     * 🎯 목적: Delete 버튼 클릭 핸들러 (삭제 확인 다이얼로그 열기)
     */
    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    /**
     * 🎯 목적: 삭제 확인 핸들러 (실제 Job 삭제 수행)
     *
     * @remarks
     * - 선택된 모든 Job을 삭제
     * - jobStore.remove() 메서드를 사용하여 Kubernetes API 호출
     * - 삭제 후 선택 상태 초기화 및 다이얼로그 닫기
     */
    const handleDeleteConfirm = async () => {
      try {
        // 각 Job 삭제 (병렬 처리)
        await Promise.all(
          selectedRows.map(async (job) => {
            await jobStore.remove(job);
          }),
        );

        // 삭제 성공 후 선택 상태 초기화
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[Jobs] Failed to delete jobs:", error);
        // TODO: 에러 토스트 메시지 표시
      }
    };

    return (
      <div className={className || ""}>
        <ResourceTableLayout
          title="Jobs"
          itemCount={filteredJobs.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search jobs..."
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
          {/* 🎯 KubeDataTable: Job 목록 테이블 */}
          {/* ============================================ */}
          <KubeDataTable
            data={filteredJobs}
            columns={jobColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage="No Jobs found"
            className="h-full"
            selectedItem={isPanelOpen ? selectedJob : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Job Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <JobDetailPanel isOpen={isPanelOpen} job={selectedJob} onClose={() => setIsPanelOpen(false)} />

        {/* ============================================ */}
        {/* 🎯 Delete Confirmation Dialog: 삭제 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Jobs</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Job(s)?
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
 * 🎯 목적: Injectable로 감싼 JobCommonTable 컴포넌트
 *
 * @remarks
 * - jobStore: Job 목록 및 상태 관리
 * - namespaceStore: 전역 네임스페이스 필터 관리
 * - dockStore: Dock 높이 정보 제공 (테이블 maxHeight 계산용)
 * - subscribeStores: KubeWatchApi의 중앙 집중식 구독 관리자
 */
export const JobCommonTable = withInjectables<
  Dependencies,
  Omit<Dependencies, "jobStore" | "namespaceStore" | "dockStore" | "subscribeStores">
>(NonInjectedJobCommonTable, {
  getProps: (di, props) => ({
    jobStore: di.inject(jobStoreInjectable),
    namespaceStore: di.inject(namespaceStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    ...props,
  }),
});
