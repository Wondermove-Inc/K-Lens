/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */
/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import {
  ArrowUpFromLine,
  Edit,
  Expand,
  FileText,
  Loader2,
  Package,
  Plus,
  SquareTerminal,
  Terminal,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { isKubernetesCluster, LensKubernetesClusterStatus } from "../../../common/catalog-entities";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import activeKubernetesClusterInjectable from "../../cluster-frame-context/active-kubernetes-cluster.injectable";
import { cn } from "../../lib/utils";
import { sortClustersByConnectionStatus } from "../layout/cluster-ordering";
import { Button } from "../shadcn-ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../shadcn-ui/popover";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { TabKind } from "./dock/store";
import styles from "./dock-tabs.module.scss";
import createTerminalTabInjectable from "./terminal/create-terminal-tab.injectable";

// import { getClusterColor } from "../layout/cluster-colors";  // 임시 비활성화

import type { IComputedValue } from "mobx";

import type { KubernetesCluster } from "../../../common/catalog-entities";
import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";
import type { DockTab as DockTabModel } from "./dock/store";

export interface DockTabsProps {
  tabs: DockTabModel[];
  autoFocus: boolean;
  selectedTab: DockTabModel | undefined;
  onChangeTab: (tab: DockTabModel) => void;
  closeTab: (tabId: string) => void;
  toggleFillSize: () => void;
  close: () => void;
  isDockOpen: boolean;
  onRestoreDefaultSize: () => void;
}

/**
 * 🎯 목적: Dependencies 인터페이스 정의 (DI 패턴용)
 */
interface Dependencies {
  entityRegistry: CatalogEntityRegistry;
  activeKubernetesCluster: IComputedValue<KubernetesCluster | null>;
  createTerminalTab: (params?: any) => void;
}

/**
 * 🎯 목적: DockTabs 컴포넌트 (shadcn Panel 구조로 마이그레이션)
 * - base-structure-template.stories.tsx Panel 구조 100% 재현
 * - SkuberPlus Core 기능 100% 보존
 */
const NonInjectedDockTabs = ({
  tabs,
  selectedTab,
  onChangeTab,
  closeTab,
  toggleFillSize,
  close,
  isDockOpen,
  onRestoreDefaultSize,
  entityRegistry,
  activeKubernetesCluster,
  createTerminalTab,
}: DockTabsProps & Dependencies) => {
  // 🎯 목적: 각 탭의 hover 상태 관리
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  // 🎯 목적: 선택된 탭 참조 (자동 스크롤용)
  const selectedTabRef = useRef<HTMLDivElement>(null);

  // 🎯 목적: Popover 표시 상태 관리
  const [showClusterPopover, setShowClusterPopover] = useState(false);

  // 🎯 목적: Popover에서 선택된 클러스터 ID
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  // 🎯 목적: 클러스터별 Terminal 생성 진행 상태 추적
  const [pendingClusterIds, setPendingClusterIds] = useState<Set<string>>(new Set());

  // 🎯 목적: 모든 클러스터 목록 가져오기
  const clusters = entityRegistry.items.get().filter(isKubernetesCluster);
  const sortedClusters = useMemo(() => sortClustersByConnectionStatus(clusters), [clusters]);

  // 🎯 목적: 현재 활성 클러스터 가져오기
  const activeCluster = activeKubernetesCluster.get();

  // 🎨 목적: 클러스터 색상 할당을 위한 전체 클러스터 ID 목록 - 임시 비활성화
  // const allClusterIds = clusters.map((cluster) => cluster.getId());

  /**
   * 🎯 목적: TabKind에 따라 lucide-react 아이콘 렌더링
   * @param kind - 탭 종류 (TERMINAL, POD_LOGS, etc.)
   * @param isActive - 활성 탭 여부 (true일 때 text-primary 적용)
   */
  const renderTabIcon = (kind: TabKind, isActive: boolean) => {
    const iconClassName = cn("h-4 w-4 flex-shrink-0", isActive && "text-primary");

    switch (kind) {
      case TabKind.TERMINAL:
        return <Terminal className={iconClassName} />;
      case TabKind.POD_LOGS:
        return <FileText className={iconClassName} />;
      case TabKind.CREATE_RESOURCE:
      case TabKind.EDIT_RESOURCE:
        return <Edit className={iconClassName} />;
      case TabKind.INSTALL_CHART:
      case TabKind.UPGRADE_CHART:
        return <Package className={iconClassName} />;
      default:
        return <Terminal className={iconClassName} />;
    }
  };

  const markClusterPending = (clusterId: string, pending: boolean) => {
    setPendingClusterIds((prev) => {
      const next = new Set(prev);

      if (pending) {
        next.add(clusterId);
      } else {
        next.delete(clusterId);
      }

      return next;
    });
  };

  const waitForClusterConnection = async (cluster: KubernetesCluster, timeoutMs = 20000) => {
    const startedAt = performance.now();

    while (performance.now() - startedAt < timeoutMs) {
      if (cluster.status?.phase === LensKubernetesClusterStatus.CONNECTED) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    throw new Error(`클러스터 "${cluster.getName()}" 연결이 제한 시간을 초과했습니다.`);
  };

  const ensureClusterConnected = async (cluster: KubernetesCluster) => {
    if (cluster.status?.phase === LensKubernetesClusterStatus.CONNECTED) {
      return;
    }

    await cluster.connect();
    await waitForClusterConnection(cluster);
  };

  /**
   * 🎯 목적: 클러스터 선택 후 Terminal 탭 생성 (화면 전환 없이)
   */
  const handleAddTerminalTab = async (cluster: KubernetesCluster) => {
    const clusterId = cluster.getId();
    setSelectedClusterId(clusterId);
    markClusterPending(clusterId, true);

    try {
      await ensureClusterConnected(cluster);
      createTerminalTab({ clusterId });
      setShowClusterPopover(false);
      setSelectedClusterId(null);
    } catch (error) {
      console.error("[DOCK-TABS] 클러스터 터미널 생성 실패", {
        clusterId,
        error,
      });

      notificationPanelStore.addError(
        "system",
        "Terminal Error",
        `Failed to open terminal for cluster "${cluster.getName()}". Please try again.`,
      );
    } finally {
      markClusterPending(clusterId, false);
    }
  };

  // 🎯 목적: 선택된 탭이 변경될 때 자동 스크롤
  useEffect(() => {
    selectedTabRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedTab?.id]);

  // 🎯 목적: Popover가 열릴 때 activeCluster를 default로 선택
  useEffect(() => {
    if (showClusterPopover && activeCluster) {
      setSelectedClusterId(activeCluster.getId());
    }
  }, [showClusterPopover, activeCluster]);

  return (
    <div className="bg-background flex h-8 w-full items-center" role="tablist" data-shadcn-skip-bg>
      {/* 좌측: 탭 목록 */}
      <div className="flex flex-1 items-center gap-0 overflow-x-auto pr-px [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {tabs.map((tab, index) => {
          const isActive = selectedTab?.id === tab.id;

          // 🎨 목적: 탭의 클러스터 색상 계산 (활성 탭 밑줄용) - 임시 비활성화
          // const tabClusterColor = tab.clusterId
          //   ? getClusterColor(tab.clusterId, allClusterIds)
          //   : "var(--primary)";

          return (
            <div
              key={tab.id}
              ref={isActive ? selectedTabRef : null}
              className={cn(
                "relative", // 🎨 클러스터 색상 바 absolute positioning을 위해 필요
                isActive
                  ? cn(
                      "bg-background border-t-primary z-[1] flex flex-shrink-0 items-center border-t-2 border-r",
                      index > 0 && "-ml-px",
                    )
                  : cn(
                      "flex flex-shrink-0 items-center",
                      index > 0 && "-ml-px",
                      "bg-muted/20 border-t border-r border-l",
                    ),
              )}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              data-shadcn-skip-bg
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChangeTab(tab)}
                className={cn(
                  "group relative h-8 gap-2 px-3 py-2",
                  !isActive &&
                    "bg-muted/20 hover:bg-sidebar-accent/30 opacity-50 transition-all duration-200 hover:opacity-100",
                )}
              >
                {renderTabIcon(tab.kind, isActive)}
                <span
                  className={cn("text-xs font-medium whitespace-nowrap", isActive && "font-bold italic")}
                  title={tab.title}
                >
                  {tab.title}
                </span>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      closeTab(tab.id);
                    }
                  }}
                  className={cn(
                    "hover:bg-muted/50 flex-shrink-0 rounded-sm p-0.5 transition-opacity cursor-pointer",
                    isActive || hoveredTab === tab.id ? "opacity-100" : "opacity-0",
                  )}
                  aria-label={`${tab.title} 탭 닫기`}
                >
                  <X className="h-4 w-4" />
                </div>
              </Button>

              {/* 🎨 활성 탭 밑줄 - 클러스터 색상으로 표시 (dock-tab.tsx:135-147 로직) */}
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "1px",
                    // backgroundColor: tabClusterColor,  // 🎨 클러스터별 고유 색상 (임시 비활성화)
                    zIndex: 10,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 우측: 컨트롤 버튼들 */}
      <div className="controls-buttons flex h-8 flex-shrink-0 items-center gap-1 px-1 py-0.5 text-muted-foreground">
        {/* Plus 버튼 + Popover (클러스터 선택) */}
        <Popover open={showClusterPopover} onOpenChange={setShowClusterPopover}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={styles.controlButton}
              data-state={showClusterPopover ? "active" : "inactive"}
              title="Add New Terminal"
              aria-label="Add New Terminal"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3">
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <SquareTerminal className="h-4 w-4" aria-hidden />
                <span>Select Cluster</span>
              </h4>
              <div className="space-y-1">
                {sortedClusters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No clusters available.</p>
                ) : (
                  sortedClusters.map((cluster) => {
                    const clusterId = cluster.getId();
                    const isSelected = selectedClusterId === clusterId;
                    const isDefaultCluster = activeCluster?.getId() === clusterId;
                    const isPending = pendingClusterIds.has(clusterId);

                    const clusterName = cluster.getName();

                    return (
                      <Button
                        key={clusterId}
                        variant={isSelected ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-start"
                        disabled={isPending}
                        onClick={() => {
                          setSelectedClusterId(clusterId);
                          void handleAddTerminalTab(cluster);
                        }}
                      >
                        {isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Terminal className="mr-2 h-4 w-4" />
                        )}
                        <span className="mr-2 flex-1 truncate text-left">{clusterName}</span>
                        {isDefaultCluster && <span className="text-xs text-muted-foreground">(Current)</span>}
                      </Button>
                    );
                  })
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Expand 버튼 */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={styles.controlButton}
          title="Expand Panel"
          onClick={toggleFillSize}
          aria-label="Expand Panel"
        >
          <Expand className="h-4 w-4" />
        </Button>

        {/* Close 버튼 */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={styles.controlButton}
          title={isDockOpen ? "Close Panel" : "Restore Panel"}
          onClick={isDockOpen ? close : onRestoreDefaultSize}
          aria-label={isDockOpen ? "Close Panel" : "Restore Panel"}
        >
          {isDockOpen ? <X className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

/**
 * 🎯 목적: withInjectables 패턴 적용 (DI 주입)
 */
export const DockTabs = withInjectables<Dependencies, DockTabsProps>(NonInjectedDockTabs, {
  getProps: (di, props) => ({
    ...props,
    entityRegistry: di.inject(catalogEntityRegistryInjectable),
    activeKubernetesCluster: di.inject(activeKubernetesClusterInjectable),
    createTerminalTab: di.inject(createTerminalTabInjectable),
  }),
});
