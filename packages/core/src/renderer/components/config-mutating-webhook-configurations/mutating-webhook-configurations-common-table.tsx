/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Mutating Webhook Configurations 공통 테이블 컴포넌트 (shadcn UI + TanStack Table 사용)
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 *   - 2025-10-31: ResourceTableLayout 적용 (검색 추가, cluster-scoped 리소스)
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
import { MutatingWebhookConfigurationDetailPanel } from "./mutating-webhook-configuration-detail-panel";
import mutatingWebhookConfigurationsStoreInjectable from "./mutating-webhook-configuration-store.injectable";
import { mutatingWebhookConfigurationColumns } from "./mutating-webhook-configurations-columns";

import type { MutatingWebhookConfiguration } from "@skuberplus/kube-object";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { MutatingWebhookConfigurationStore } from "./mutating-webhook-configuration-store";

export interface MutatingWebhookConfigurationsCommonTableProps {
  title?: string;
}

interface Dependencies {
  store: MutatingWebhookConfigurationStore;
  subscribeStores: SubscribeStores;
}

const NonInjectedMutatingWebhookConfigurationsCommonTable = observer(
  ({
    title = "Mutating Webhook Configs",
    store,
    subscribeStores,
  }: MutatingWebhookConfigurationsCommonTableProps & Dependencies) => {
    const [searchValue, setSearchValue] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedConfig, setSelectedConfig] = useState<MutatingWebhookConfiguration | undefined>(undefined);
    const [selectedRows, setSelectedRows] = useState<MutatingWebhookConfiguration[]>([]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // 🔄 Kubernetes API 구독: Mutating Webhook Configurations 데이터 자동 로딩
    useEffect(() => {
      const unsubscribe = subscribeStores([store], {
        onLoadFailure: (error) => console.error("[MutatingWebhookConfigs] Failed to load:", error),
      });
      return () => unsubscribe();
    }, [store, subscribeStores]);

    const items = store.items.slice() as MutatingWebhookConfiguration[];

    const filteredItems = useMemo(() => {
      let filtered = items;

      // 검색 필터 (Name 기준)
      if (searchValue.trim()) {
        const search = searchValue.toLowerCase();
        filtered = filtered.filter((item) => item.getName().toLowerCase().includes(search));
      }

      return filtered;
    }, [items, searchValue]);

    const selectedCount = selectedRows.length;

    /**
     * 🎯 목적: MutatingWebhookConfiguration 행 클릭 핸들러 (Detail Panel 토글)
     * @param config - 클릭된 MutatingWebhookConfiguration 객체
     * @remarks 같은 행 재클릭 시 패널 닫힘, 다른 행 클릭 시 패널 전환
     */
    const handleRowClick = (config: MutatingWebhookConfiguration) => {
      if (selectedConfig?.getId() === config.getId()) {
        // 같은 행 클릭 시 패널 닫기
        setSelectedConfig(undefined);
        setIsPanelOpen(false);
      } else {
        // 다른 행 클릭 시 패널 열기/전환
        setSelectedConfig(config);
        setIsPanelOpen(true);
      }
    };

    const handleSelectionChange = (selectedItems: MutatingWebhookConfiguration[]) => {
      setSelectedRows(selectedItems);
    };

    const handleDeleteClick = () => {
      setIsDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
      try {
        await Promise.all(
          selectedRows.map(async (config) => {
            await store.remove(config);
          }),
        );
        setSelectedRows([]);
        setIsDeleteDialogOpen(false);
      } catch (error) {
        console.error("[MutatingWebhookConfig] Failed to delete:", error);
      }
    };

    return (
      <>
        <ResourceTableLayout
          title={title}
          itemCount={filteredItems.length}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          searchPlaceholder="Search webhook configs..."
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
            data={filteredItems}
            columns={mutatingWebhookConfigurationColumns}
            enableRowSelection={true}
            enablePagination={true}
            defaultPageSize={40}
            onRowClick={handleRowClick}
            onSelectionChange={handleSelectionChange}
            getRowId={(row) => row.getId()}
            emptyMessage="No Mutating Webhook Configurations found"
            selectedItem={isPanelOpen ? selectedConfig : undefined}
            renderContextMenu={(item) => <ResourceContextMenu object={item} />}
          />
        </ResourceTableLayout>

        {/* ============================================ */}
        {/* 🎯 MutatingWebhookConfiguration Detail Panel: 우측 슬라이드 패널로 상세 정보 표시 */}
        {/* ============================================ */}
        <MutatingWebhookConfigurationDetailPanel
          isOpen={isPanelOpen}
          config={selectedConfig}
          onClose={() => setIsPanelOpen(false)}
        />

        {/* ============================================ */}
        {/* 🎯 Delete 확인 다이얼로그 */}
        {/* ============================================ */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Mutating Webhook Configurations</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedCount} selected Mutating Webhook Configuration(s)?
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

export const MutatingWebhookConfigurationsCommonTable = withInjectables<
  Dependencies,
  MutatingWebhookConfigurationsCommonTableProps
>(NonInjectedMutatingWebhookConfigurationsCommonTable, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(mutatingWebhookConfigurationsStoreInjectable),
    subscribeStores: di.inject(subscribeStoresInjectable),
  }),
});
