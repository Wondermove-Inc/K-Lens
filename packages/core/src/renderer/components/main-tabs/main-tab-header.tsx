/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Draggable } from "@hello-pangea/dnd";
import { withInjectables } from "@ogre-tools/injectable-react";
import {
  ArrowRightLeft,
  Circle,
  CopyCheck,
  CopyX,
  Server,
  SquareSplitHorizontal,
  SquareSplitVertical,
  X,
} from "lucide-react";
import { observer } from "mobx-react";
import React, { forwardRef, useState } from "react";
import { isKubernetesCluster } from "../../../common/catalog-entities";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import { cn } from "../../lib/utils";
import navigateInjectable from "../../navigation/navigate.injectable";
import { getClusterColor } from "../layout/cluster-colors";
import { getFileIcon, getFileIconColorClass } from "../layout/file-explorer/file-icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../shadcn-ui/context-menu";
import mainTabStoreInjectable from "./main-tab-store.injectable";
import splitActionsInjectable from "./split-actions.injectable";

import type { CatalogEntityRegistry } from "../../api/catalog/entity/registry";
import type { Navigate } from "../../navigation/navigate.injectable";
import type { MainTab, MainTabId } from "./main-tab.model";
import type { MainTabStore } from "./main-tab-store";
import type { SplitActions } from "./split-actions.injectable";

/**
 * 🎯 목적: 개별 탭을 렌더링하는 헤더 컴포넌트
 *
 * @description
 * - 크롬 브라우저 스타일의 탭 UI 구현
 * - 탭 제목, 아이콘, 닫기 버튼 포함
 * - 활성/비활성 상태 시각적 표현
 * - 클릭 시 탭 활성화 및 라우트 이동
 *
 * 📝 주의사항:
 * - 탭 클릭과 닫기 버튼 클릭의 이벤트 버블링 방지 필요
 * - 긴 제목의 경우 적절한 텍스트 truncation 적용
 *
 * 🔄 변경이력: 2025-09-25 - 초기 생성 (크롬 스타일 탭 헤더)
 */

export interface MainTabHeaderProps {
  /** 📄 렌더링할 탭 데이터 */
  tab: MainTab;

  /** 🔢 탭의 현재 인덱스 (드래그 앤 드롭용) */
  index: number;

  /** 🎯 활성 상태 여부 */
  isActive: boolean;

  /** 🔄 탭 클릭 핸들러 (선택사항, 기본값: 라우트 이동) */
  onTabClick?: (tabId: MainTabId) => void;

  /** ❌ 탭 닫기 핸들러 (선택사항, 기본값: 탭 제거) */
  onTabClose?: (tabId: MainTabId) => void;

  /** 🎯 활성 탭 참조 (자동 스크롤용) */
  activeTabRef?: React.Ref<HTMLDivElement>;
}

interface Dependencies {
  mainTabStore: MainTabStore;
  navigate: Navigate;
  entityRegistry: CatalogEntityRegistry;
  splitActions: SplitActions;
}

const NonInjectedMainTabHeader = observer(
  forwardRef<HTMLDivElement, MainTabHeaderProps & Dependencies>(
    (
      {
        tab,
        index,
        isActive,
        onTabClick,
        onTabClose,
        activeTabRef, // ⭐ 커스텀 ref prop (withInjectables 호환성)
        mainTabStore,
        navigate,
        entityRegistry,
        splitActions,
      },
      ref, // ⭐ forwardRef의 ref 파라미터 (사용 안 함, activeTabRef 사용)
    ) => {
      // 🎯 탭 hover 상태 관리 (Close 버튼 표시용)
      const [hoveredTab, setHoveredTab] = useState<string | null>(null);

      // 🔒 Close 버튼 중복 클릭 방지 상태
      const [isClosing, setIsClosing] = useState(false);

      // 🎨 전체 클러스터 ID 목록 (색상 할당용)
      const clusters = entityRegistry.items.get().filter(isKubernetesCluster);
      const allClusterIds = clusters.map((cluster) => cluster.getId());

      // 🔍 디버깅: iconComponent 검증 (개발 중 확인용)
      if (isActive && tab.iconComponent) {
        if (!React.isValidElement(tab.iconComponent)) {
          console.error(`[Tab Icon Error] ${tab.title}: iconComponent is not a valid React element`, tab.iconComponent);
        }
      }

      // 🎯 탭 클릭 처리 - 탭 활성화 및 라우트 이동
      const handleTabClick = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (onTabClick) {
          onTabClick(tab.id);
        } else {
          // 🔥 기본 동작: 탭 활성화 + 라우트 이동
          mainTabStore.activateTab(tab.id);
          navigate(tab.route);
        }
      };

      // ❌ 탭 닫기 처리
      const handleCloseClick = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation(); // 🛡️ 탭 클릭 이벤트와 분리

        // 🔒 중복 클릭 방지: 이미 닫기 진행 중이면 무시
        if (isClosing) {
          return;
        }

        if (onTabClose) {
          onTabClose(tab.id);
        } else {
          const tabExists = mainTabStore.tabs.some((t) => t.id === tab.id);

          if (!tabExists) {
            console.warn(`🚨 닫기 대상 탭을 찾을 수 없습니다: ${tab.id}`);
            return;
          }

          // 🔒 닫기 시작 플래그 설정
          setIsClosing(true);

          try {
            // 🔥 requestCloseTab: dirty 파일 탭이면 다이얼로그 표시, 아니면 즉시 닫기
            const result = mainTabStore.requestCloseTab(tab.id);

            if (result.closed) {
              // 즉시 닫힌 경우 (clean 탭 또는 non-file 탭)
              if (result.wasActive && result.nextActiveTab) {
                navigate(result.nextActiveTab.route);
              }
            }
            // result.closed === false이면 다이얼로그가 표시됨 (컨테이너에서 처리)
          } catch (error) {
            console.error("[Tab Close Error]", error);
          } finally {
            setIsClosing(false);
          }
        }
      };

      /**
       * 🎯 목적: Split Right 메뉴 클릭 핸들러
       */
      const handleSplitRight = () => {
        // 먼저 탭 활성화 (split할 탭이 활성 탭이어야 함)
        if (!isActive) {
          mainTabStore.activateTab(tab.id);
          navigate(tab.route);
        }
        splitActions.splitTabRight();
      };

      /**
       * 🎯 목적: Split Down 메뉴 클릭 핸들러
       */
      const handleSplitDown = () => {
        if (!isActive) {
          mainTabStore.activateTab(tab.id);
          navigate(tab.route);
        }
        splitActions.splitTabDown();
      };

      /**
       * 🎯 목적: Move to Other Group 메뉴 클릭 핸들러
       */
      const handleMoveToOtherGroup = () => {
        splitActions.moveTabToOtherGroup(tab.id);
      };

      /**
       * 🎯 목적: Close Others 메뉴 클릭 핸들러
       */
      const handleCloseOthers = () => {
        mainTabStore.closeOtherTabs(tab.id);
      };

      /**
       * 🎯 목적: Close All 메뉴 클릭 핸들러
       */
      const handleCloseAll = () => {
        mainTabStore.clearAllTabs();
      };

      return (
        <ContextMenu>
          <Draggable draggableId={tab.id} index={index}>
            {(provided, snapshot) => (
              <ContextMenuTrigger asChild>
                <div
                  ref={(node) => {
                    // 🎯 다중 ref 처리: provided.innerRef + activeTabRef
                    if (typeof provided.innerRef === "function") {
                      provided.innerRef(node);
                    } else if (provided.innerRef) {
                      (provided.innerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                    }
                    if (activeTabRef) {
                      if (typeof activeTabRef === "function") {
                        activeTabRef(node);
                      } else {
                        (activeTabRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                      }
                    }
                  }}
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  className={cn(
                    // 🎯 기본 레이아웃 (항상 적용) - 120px 고정 (padding 포함)
                    "relative w-[120px] min-w-[120px] max-w-[120px] flex h-8 flex-shrink-0 items-center",
                    // 🎨 활성/비활성 스타일
                    isActive
                      ? cn("bg-background border-t-primary z-[2] border-t-2 border-r", index > 0 && "-ml-px")
                      : cn("bg-muted/20 border-t border-r border-l", index > 0 && "-ml-px"),
                    // 🎯 드래그 중 스타일
                    snapshot.isDragging && "opacity-80 rotate-2 z-[1000] shadow-lg",
                  )}
                  data-testid={`dock-tab-for-${tab.id}`}
                  data-main-tab-id={`main-tab-${tab.id}`}
                  data-shadcn-skip-bg
                  role="tab"
                  aria-selected={isActive}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                >
                  {/* 🎯 탭 클릭 영역 (div로 변경 - Drag & Drop 이벤트 전파 허용) */}
                  <div
                    onClick={handleTabClick}
                    className={cn(
                      "group relative flex h-8 w-full items-center gap-1 px-1 cursor-pointer rounded-sm min-w-0",
                      !isActive &&
                        "bg-muted/20 hover:bg-sidebar-accent/30 opacity-50 transition-all duration-200 hover:opacity-100",
                    )}
                  >
                    {/* 🎨 탭 아이콘 (메뉴명 왼쪽) */}
                    {/* 📝 우선순위: 파일 탭 > iconComponent > fallback(클러스터 Server 아이콘) */}
                    {/* 🎨 색상: cluster 아이콘은 cluster color 유지, 일반 아이콘은 mute */}
                    {/* 🛡️ React element 검증 + MobX Proxy 방어: cloneElement로 안전하게 렌더링 */}
                    {tab.type === "file" && tab.filePath ? (
                      // 🆕 파일 탭 아이콘 (확장자별 아이콘)
                      (() => {
                        const Icon = getFileIcon(tab.filePath);
                        const colorClass = getFileIconColorClass(tab.filePath);
                        return (
                          <span className={cn("ml-1 flex-shrink-0", colorClass)}>
                            <Icon className="h-4 w-4" />
                          </span>
                        );
                      })()
                    ) : tab.iconComponent && React.isValidElement(tab.iconComponent) ? (
                      <span className="ml-1 flex-shrink-0 text-muted-foreground">
                        {React.cloneElement(tab.iconComponent as React.ReactElement)}
                      </span>
                    ) : (
                      <Server
                        className="ml-1 h-4 w-4 flex-shrink-0"
                        style={{
                          color: tab.clusterId
                            ? getClusterColor(tab.clusterId, allClusterIds)
                            : "var(--muted-foreground)",
                        }}
                      />
                    )}

                    {/* 📝 탭 제목 */}
                    {/* 🆕 isDirty일 때 탭 제목에 * 표시 */}
                    <span
                      className={cn(
                        "text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0",
                        isActive && "font-bold italic",
                        // 🎯 THEME-024: Semantic color for unsaved tab indicator
                        tab.isDirty && "text-status-warning",
                      )}
                      title={tab.type === "file" ? tab.filePath : tab.title}
                    >
                      {tab.isDirty ? `${tab.title} *` : tab.title}
                    </span>

                    {/* ❌ 닫기 버튼 (hover 시에만 표시) */}
                    {/* 🆕 isDirty일 때 닫기 버튼 색상 변경 (점 아이콘) */}
                    <button
                      onClick={(e) => {
                        // 🛡️ 항상 부모로 버블링 방지 (탭 클릭 이벤트와 분리)
                        e.stopPropagation();

                        // 🚫 비활성 탭이고 hover 아니면 클릭 무시
                        if (!isActive && hoveredTab !== tab.id) {
                          return;
                        }

                        handleCloseClick(e);
                      }}
                      className={cn(
                        "hover:bg-muted/50 ml-1 flex-shrink-0 rounded-sm p-0.5 transition-opacity cursor-pointer",
                        isActive || hoveredTab === tab.id ? "opacity-100" : "opacity-0",
                      )}
                      aria-label={`${tab.title} 탭 닫기`}
                      data-testid={`close-tab-${tab.id}`}
                      disabled={snapshot.isDragging || isClosing}
                    >
                      {/* isDirty일 때는 점 아이콘, 아니면 X 아이콘 */}
                      {tab.isDirty ? (
                        <Circle className="h-3 w-3 fill-status-warning text-status-warning" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </ContextMenuTrigger>
            )}
          </Draggable>

          {/* 🎯 우클릭 메뉴 */}
          <ContextMenuContent className="w-fit min-w-0">
            <ContextMenuItem
              className="whitespace-nowrap"
              onClick={handleSplitRight}
              disabled={mainTabStore.isSplitActive}
            >
              <SquareSplitHorizontal className="mr-2 h-4 w-4" />
              <span>Split Right</span>
            </ContextMenuItem>

            <ContextMenuItem
              className="whitespace-nowrap"
              onClick={handleSplitDown}
              disabled={mainTabStore.isSplitActive}
            >
              <SquareSplitVertical className="mr-2 h-4 w-4" />
              <span>Split Down</span>
            </ContextMenuItem>

            <ContextMenuItem
              className="whitespace-nowrap"
              onClick={handleMoveToOtherGroup}
              disabled={!mainTabStore.isSplitActive}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              <span>Move to Other Group</span>
            </ContextMenuItem>

            <ContextMenuSeparator />

            <ContextMenuItem className="whitespace-nowrap" onClick={handleCloseClick}>
              <X className="mr-2 h-4 w-4" />
              <span>Close</span>
            </ContextMenuItem>

            <ContextMenuItem className="whitespace-nowrap" onClick={handleCloseOthers}>
              <CopyCheck className="mr-2 h-4 w-4" />
              <span>Close Others</span>
            </ContextMenuItem>

            <ContextMenuItem className="whitespace-nowrap" onClick={handleCloseAll}>
              <CopyX className="mr-2 h-4 w-4" />
              <span>Close All</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    },
  ),
);

export const MainTabHeader = withInjectables<Dependencies, MainTabHeaderProps>(NonInjectedMainTabHeader, {
  getProps: (di, props) => ({
    ...props,
    mainTabStore: di.inject(mainTabStoreInjectable),
    navigate: di.inject(navigateInjectable),
    entityRegistry: di.inject(catalogEntityRegistryInjectable),
    splitActions: di.inject(splitActionsInjectable),
  }),
});
