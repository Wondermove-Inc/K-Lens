/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Secret 목록 테이블 - CommonTable 패턴 구현
 *
 * 구성 요소:
 * - 상단 메뉴 (Secrets {count} items, 네임스페이스 드롭다운, 검색 입력, Add 버튼)
 * - KubeDataTable 컴포넌트 (컬럼 리사이징, 정렬 자동 지원)
 * - AddSecretDialog 통합 (Add 버튼 클릭 시 열림)
 * - MobX observable secretStore 연동
 * - Injectable DI 패턴 유지
 *
 * 📝 주의사항:
 * - KubeDataTable은 순수 배열 필요 → secretStore.items.slice() 변환
 * - 컬럼 정의는 secrets-columns.tsx에서 import
 * - Keys/Type 컬럼은 모바일에서 숨김 (반응형)
 * - 컬럼 리사이징 상태는 localStorage에 자동 저장됨
 * - 반응형 디자인 (Pod 패턴 준수)
 *
 * 🔄 변경이력:
 * - 2025-10-30: CommonTable 패턴으로 마이그레이션 (shadcn UI + Add 버튼)
 * - 2025-10-31: ResourceTableLayout 적용 (상단 메뉴 공통화)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Plus, Trash2 } from "lucide-react";
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
import openAddSecretDialogInjectable from "./add-dialog/open.injectable";
import { SecretDetailPanel } from "./secret-detail-panel";
import { secretColumns } from "./secrets-columns";
import secretStoreInjectable from "./store.injectable";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { DockStore } from "../dock/dock/store";
import type { SecretStore } from "./store";

/**
 * 🎯 목적: SecretsCommonTable Dependencies 인터페이스
 */
interface Dependencies {
  secretStore: SecretStore;
  dockStore: DockStore;
  openAddSecretDialog: () => void;
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
  secretMenuBar: 65, // Secrets 상단 메뉴
  margins: 16, // 여백
} as const;

/**
 * 🎯 목적: 테이블 maxHeight 계산을 위한 총 오프셋 (178px)
 */
const TOTAL_TABLE_OFFSET =
  LAYOUT_OFFSETS.clusterManagerHeader +
  LAYOUT_OFFSETS.statusBar +
  LAYOUT_OFFSETS.mainLayoutTabs +
  LAYOUT_OFFSETS.secretMenuBar +
  LAYOUT_OFFSETS.margins;

/**
 * 🎯 목적: Secret 목록을 KubeDataTable로 렌더링 (MobX observer)
 *
 * @param props - Dependencies (secretStore, dockStore, openAddSecretDialog, className)
 * @returns KubeDataTable 기반 Secret 목록 테이블
 */
const NonInjectedSecretsCommonTable = observer(
  ({ secretStore, dockStore, openAddSecretDialog, className, subscribeStores }: Dependencies) => {
    // secretStore.contextItems는 MobX computed getter (namespace 필터링된 데이터)
    const secrets = secretStore.contextItems;

    // 🎯 상태 관리
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedSecret, setSelectedSecret] = useState<(typeof secrets)[0] | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<(typeof secrets)[0][]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    /**
     * 🎯 목적: Secret Store 데이터 로드 및 구독 (KubeWatchApi 사용)
     */
    useEffect(() => {
      const unsubscribe = subscribeStores([secretStore], {
        onLoadFailure: (error) => console.error("[Secret] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [secretStore, subscribeStores]);

    /**
     * 🎯 목적: 검색 필터링
     *
     * @remarks
     * - contextItems가 이미 namespace 필터링 수행
     * - MobX observable 배열을 순수 배열로 변환
     * - 검색 필터: Name, Namespace, Keys, Type 기준
     */
    const filteredSecrets = React.useMemo(() => {
      // MobX observable 배열을 순수 배열로 변환 (KubeDataTable 요구사항)
      let filtered = secrets.slice();

      // 검색 필터 (Name, Namespace, Keys, Type 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter(
          (secret) =>
            secret.getName().toLowerCase().includes(search) ||
            secret.getNs().toLowerCase().includes(search) ||
            secret.getKeys().some((key) => key.toLowerCase().includes(search)) ||
            secret.type?.toLowerCase().includes(search),
        );
      }

      return filtered;
    }, [secrets, searchValue]);

    /**
     * 🎯 목적: Secret 행 클릭 핸들러 (Detail Panel 토글)
     * @param secret - 클릭된 Secret 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (secret: (typeof secrets)[0]) => {
      if (selectedSecret?.getId() === secret.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedSecret(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedSecret(secret);
        setIsPanelOpen(true);
      }
    };

    /**
     * 🎯 목적: 선택된 행 개수 계산
     */
    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: 행 선택 변경 핸들러
     * @param selectedSecrets - 선택된 Secret 배열
     */
    const handleSelectionChange = (selectedSecrets: (typeof secrets)[0][]) => {
      setSelectedRows(selectedSecrets);
    };

    /**
     * 🎯 목적: Delete 버튼 클릭 핸들러 (삭제 확인 다이얼로그 열기)
     */
    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    /**
     * 🎯 목적: 삭제 확인 핸들러 (실제 Secret 삭제 수행)
     *
     * @remarks
     * - 선택된 모든 Secret을 삭제
     * - secretStore.remove() 메서드를 사용하여 Kubernetes API 호출
     * - 삭제 후 선택 상태 초기화 및 다이얼로그 닫기
     */
    const handleDeleteConfirm = async () => {
      try {
        // 각 Secret 삭제 (병렬 처리)
        await Promise.all(
          selectedRows.map(async (secret) => {
            await secretStore.remove(secret);
          }),
        );

        // 삭제 성공 후 선택 상태 초기화
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[Secrets] Failed to delete secrets:", error);
        // TODO: 에러 토스트 메시지 표시
      }
    };

    return (
      <div className={className || ""}>
        <ResourceTableLayout
          title="Secrets"
          itemCount={filteredSecrets.length}
          showNamespaceFilter={true}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search secrets..."
          headerActions={
            <>
              <Button variant="default" onClick={openAddSecretDialog} className="gap-2 !px-4">
                <Plus className="h-4 w-4" />
                Add
              </Button>
              {selectedCount > 0 && (
                <Button
                  variant="secondary"
                  onClick={handleDeleteClick}
                  className="!bg-secondary !text-destructive gap-2 !px-4"
                >
                  <Trash2 className="!text-destructive h-4 w-4" />
                  Delete ({selectedCount})
                </Button>
              )}
            </>
          }
        >
          <KubeDataTable
            data={filteredSecrets}
            columns={secretColumns}
            enableColumnResizing={true}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            getRowId={(item) => item.getId()}
            dockHeight={dockStore.isOpen ? dockStore.height : 0}
            tableOffset={TOTAL_TABLE_OFFSET}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            emptyMessage="No Secrets found"
            className="h-full"
            selectedItem={isPanelOpen ? selectedSecret : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 Secret Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <SecretDetailPanel isOpen={isPanelOpen} secret={selectedSecret} onClose={() => setIsPanelOpen(false)} />

        {/* ============================================ */}
        {/* 🎯 Delete Confirmation Dialog: 삭제 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Secrets</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Secret(s)?
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
 * 🎯 목적: SecretsCommonTable 컴포넌트 (Injectable DI 적용)
 */
export const SecretsCommonTable = withInjectables<Dependencies>(NonInjectedSecretsCommonTable, {
  getProps: (di, props) => ({
    ...props,
    secretStore: di.inject(secretStoreInjectable),
    dockStore: di.inject(dockStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
    openAddSecretDialog: di.inject(openAddSecretDialogInjectable),
  }),
});
