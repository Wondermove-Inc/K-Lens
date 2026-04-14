/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { withInjectables } from "@ogre-tools/injectable-react";
import { reaction } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { matchPath } from "react-router";
import { cn } from "../../lib/utils";
import currentPathInjectable from "../../routes/current-path.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { EditorGroupView } from "./editor-group-view";
import { EmptyTabsScreen } from "./empty-tabs-screen";
import { MainTabContextProvider } from "./main-tab-context";
import { MainTabHeader } from "./main-tab-header";
import mainTabStoreInjectable from "./main-tab-store.injectable";
import { MainTabToolbar } from "./main-tab-toolbar";
import { SplitView } from "./split-view";
// 🎯 Side-effect import: 키보드 단축키 등록 (onLoadOfApplication)
import "./main-tab-hotkeys.injectable";
import navigateInjectable from "../../navigation/navigate.injectable";
// 🆕 파일 에디터 탭 컴포넌트
import { FileEditorTab, SaveConfirmDialog } from "../file-editor";

import type { StrictReactNode } from "@skuberplus/utilities";

import type { DropResult } from "@hello-pangea/dnd";
import type { IComputedValue } from "mobx";

import type { Route } from "../../../common/front-end-routing/front-end-route-injection-token";
import type { Navigate } from "../../navigation/navigate.injectable";
import type { SaveConfirmResult } from "../file-editor/save-confirm-dialog";
import type { EditorGroup, EditorGroupId, MainTabId } from "./main-tab.model";
import type { MainTabStore } from "./main-tab-store";

/**
 * 🎯 목적: 메인 콘텐츠 영역의 탭 시스템 전체 컨테이너
 *
 * @description
 * - 탭 헤더 영역과 콘텐츠 영역으로 구성
 * - 탭이 없을 때는 children을 그대로 렌더링 (기존 동작 유지)
 * - 탭이 있을 때는 탭 시스템으로 children 래핑
 * - 크롬 브라우저와 유사한 탭 레이아웃 구현
 * - Split 모드 지원 (2-pane horizontal split)
 *
 * 📝 주의사항:
 * - 탭이 없는 상황에서도 정상 동작해야 함 (하위 호환성)
 * - 탭 헤더 영역의 스크롤 처리 (탭이 많을 때)
 * - 반응형 디자인 고려 (화면 크기에 따른 탭 크기 조정)
 * - Split 활성 시 children은 무시됨 (각 그룹별로 라우팅 처리)
 *
 * 🔄 변경이력:
 * - 2025-09-25: 초기 생성 (메인 탭 컨테이너 시스템)
 * - 2025-10-29: Split 기능 추가 (Level 4)
 */

export interface MainTabContainerProps {
  /** 📄 탭 콘텐츠로 렌더링될 children */
  children?: StrictReactNode;

  /** 🎨 추가 CSS 클래스명 */
  className?: string;
}

interface Dependencies {
  mainTabStore: MainTabStore;
  navigate: Navigate;
  currentPath: IComputedValue<string>;
  routeComponents: {
    route: Route<unknown>;
    Component: React.ElementType<any>;
  }[];
}

const NonInjectedMainTabContainer = observer(
  ({
    children,
    className,
    mainTabStore,
    navigate,
    currentPath,
    routeComponents,
  }: MainTabContainerProps & Dependencies) => {
    const { hasTabs, tabs, activeTabId, isSplitActive, leftGroup, rightGroup, splitLayout } = mainTabStore;

    // 🎯 활성 탭 참조 (자동 스크롤용)
    const activeTabRef = React.useRef<HTMLDivElement>(null);

    const clusterRouteComponents = React.useMemo(
      () => routeComponents.filter(({ route }) => route.clusterFrame),
      [routeComponents],
    );

    // URL 변경 시 매칭되는 탭 자동 활성화 (command palette, browser back/forward 등 대응)
    React.useEffect(() => {
      const disposer = reaction(
        () => currentPath.get(),
        (path) => {
          if (!mainTabStore.hasTabs) return;

          const matchingTab = mainTabStore.allTabs.find((tab) => matchPath(path, { path: tab.route, exact: true }));

          if (matchingTab && matchingTab.id !== mainTabStore.activeTabId) {
            mainTabStore.activateTab(matchingTab.id);
          }
        },
      );

      return disposer;
    }, [currentPath, mainTabStore]);

    const renderGroupContent = React.useCallback(
      (group: EditorGroup | undefined) => {
        if (!group || group.tabs.length === 0) {
          return (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              분할된 영역에 열린 탭이 없습니다.
            </div>
          );
        }

        const activeTab = group.tabs.find((tab) => tab.id === group.activeTabId) ?? group.tabs[group.tabs.length - 1];

        if (!activeTab) {
          return (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              활성화된 탭을 찾을 수 없습니다.
            </div>
          );
        }

        // 🆕 파일 탭인 경우 FileEditorTab 렌더링
        if (activeTab.type === "file" && activeTab.filePath) {
          return (
            <MainTabContextProvider key={`${group.id}-${activeTab.id}`} value={{ groupId: group.id, tab: activeTab }}>
              <FileEditorTab
                tabId={activeTab.id}
                filePath={activeTab.filePath}
                language={activeTab.language}
                originalContent={activeTab.originalContent || ""}
                currentContent={activeTab.currentContent || ""}
                isDirty={activeTab.isDirty || false}
                readOnly={activeTab.readOnly}
                clusterId={activeTab.clusterId}
                markdownViewMode={activeTab.markdownViewMode}
                onContentChange={(tabId, content) => {
                  mainTabStore.updateFileContent(tabId, content);
                }}
                onSave={(tabId, content) => {
                  mainTabStore.markFileSaved(tabId, content);
                }}
                onRefresh={(tabId) => {
                  mainTabStore.refreshFileFromDisk(tabId);
                }}
                onMarkdownViewModeChange={(tabId, viewMode) => {
                  mainTabStore.updateMarkdownViewMode(tabId, viewMode);
                }}
              />
            </MainTabContextProvider>
          );
        }

        // 기존 리소스 탭 렌더링 로직
        const matchedRouteComponent = clusterRouteComponents.find(({ route }) =>
          matchPath(activeTab.route, {
            path: route.path,
            exact: true,
          }),
        );

        const RouteComponent = matchedRouteComponent?.Component;

        if (!RouteComponent) {
          return (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {`${activeTab.route} 경로에 대한 화면 구성이 정의되지 않았습니다.`}
            </div>
          );
        }

        return (
          <MainTabContextProvider key={`${group.id}-${activeTab.id}`} value={{ groupId: group.id, tab: activeTab }}>
            <RouteComponent />
          </MainTabContextProvider>
        );
      },
      [clusterRouteComponents, mainTabStore],
    );

    // 🎯 활성 탭으로 자동 스크롤 (탭 전환 시)
    // 💡 useLayoutEffect: DOM 업데이트 직후 동기적 실행 (초기 로딩 포커스 보장)
    React.useLayoutEffect(() => {
      if (isSplitActive || !activeTabRef.current) {
        return;
      }

      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center", // 가로 스크롤 시 중앙 정렬
      });
    }, [tabs, activeTabId, isSplitActive]); // tabs 또는 activeTabId 변경 시마다 실행 (Split 비활성 시)

    // 🎯 드래그 앤 드롭 완료 처리
    const handleDragEnd = (result: DropResult) => {
      const { destination, source, draggableId } = result;

      // 🛡️ 드롭 위치가 없거나 같은 위치인 경우 무시
      if (!destination || destination.index === source.index) {
        return;
      }

      // 🎯 그룹 간 이동 vs 그룹 내 재정렬
      const sourceGroupId = source.droppableId.replace("group-", "") as EditorGroupId;
      const destGroupId = destination.droppableId.replace("group-", "") as EditorGroupId;

      if (sourceGroupId === destGroupId) {
        // 🔄 같은 그룹 내 재정렬
        mainTabStore.reorderTabs(source.index, destination.index, sourceGroupId);
      } else {
        const tabId = draggableId as MainTabId;

        mainTabStore.moveTabToGroup(tabId, destGroupId, destination.index);
      }
    };

    // 🔒 닫기 확인 다이얼로그 결과 처리
    const handleCloseConfirmResult = React.useCallback(
      async (result: SaveConfirmResult) => {
        try {
          const closeResult = await mainTabStore.handleCloseConfirmResult(result);

          if (closeResult?.wasActive && closeResult.nextActiveTab) {
            navigate(closeResult.nextActiveTab.route);
          }
        } catch (error) {
          console.error("[CloseConfirm] Unexpected error:", error);
        }
      },
      [mainTabStore, navigate],
    );

    // 📭 탭이 없는 경우 빈 화면 표시
    if (!hasTabs) {
      return (
        <div className={cn("w-full h-full flex flex-col bg-background", className)}>
          <EmptyTabsScreen />
        </div>
      );
    }

    /**
     * 🎯 목적: Split 활성화 여부에 따라 다른 UI 렌더링
     *
     * 📝 주의사항:
     * - 양쪽 그룹 모두 children을 렌더링하여 동시에 콘텐츠 표시
     * - isActive는 시각적 구분(border 등)만 담당
     * - Phase 3에서 각 그룹이 독립적으로 다른 컴포넌트를 렌더링하도록 개선 예정
     */
    if (isSplitActive && leftGroup && rightGroup) {
      return (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={cn("w-full h-full flex flex-col bg-background", className)}>
            <SplitView
              left={
                <EditorGroupView group={leftGroup} isActive={splitLayout.activeGroupId === "left"}>
                  {/* 좌측 그룹 콘텐츠: 그룹별 활성 탭에 대응 */}
                  {renderGroupContent(leftGroup)}
                </EditorGroupView>
              }
              right={
                <EditorGroupView group={rightGroup} isActive={splitLayout.activeGroupId === "right"}>
                  {/* 우측 그룹 콘텐츠: 그룹별 활성 탭에 대응 */}
                  {renderGroupContent(rightGroup)}
                </EditorGroupView>
              }
              initialLeftRatio={splitLayout.leftRatio}
              onRatioChange={(ratio) => mainTabStore.setSplitRatio(ratio)}
              orientation={splitLayout.orientation}
            />
          </div>
          <SaveConfirmDialog
            open={mainTabStore.isCloseConfirmOpen}
            fileName={mainTabStore.pendingCloseFileName}
            filePath={mainTabStore.pendingCloseFilePath}
            onResult={handleCloseConfirmResult}
          />
        </DragDropContext>
      );
    }

    /**
     * 🎯 목적: Split 비활성 시 기존 UI (backward compatible)
     */
    return (
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={cn("w-full h-full flex flex-col bg-background", className)}>
          {/* 🎯 탭 헤더 영역 */}
          <div className="flex items-stretch bg-sidebar min-h-[32px] h-8 overflow-hidden relative" role="tablist">
            <Droppable droppableId="group-left" direction="horizontal">
              {(provided, snapshot) => (
                <div
                  className={cn(
                    "flex items-stretch overflow-x-auto overflow-y-hidden flex-1 pr-px",
                    "[&::-webkit-scrollbar]:hidden",
                    "[-ms-overflow-style:none]",
                    "[scrollbar-width:none]",
                    snapshot.isDraggingOver && "bg-sidebar-accent",
                  )}
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {tabs.map((tab, index) => (
                    <MainTabHeader
                      key={tab.id}
                      tab={tab}
                      index={index}
                      isActive={tab.id === activeTabId}
                      activeTabRef={tab.id === activeTabId ? activeTabRef : undefined}
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            {/* 🎯 Split 툴바 (VSCode 스타일 우측 배치) */}
            <div className="flex items-center border-l border-border/40 bg-sidebar px-2">
              <MainTabToolbar hasContent={tabs.length > 0} />
            </div>
          </div>

          {/* 📄 탭 콘텐츠 영역 */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background" role="tabpanel">
            {leftGroup ? renderGroupContent(leftGroup) : children}
          </div>
        </div>
        <SaveConfirmDialog
          open={mainTabStore.isCloseConfirmOpen}
          fileName={mainTabStore.pendingCloseFileName}
          filePath={mainTabStore.pendingCloseFilePath}
          onResult={handleCloseConfirmResult}
        />
      </DragDropContext>
    );
  },
);

export const MainTabContainer = withInjectables<Dependencies, MainTabContainerProps>(NonInjectedMainTabContainer, {
  getProps: (di, props) => ({
    ...props,
    mainTabStore: di.inject(mainTabStoreInjectable),
    navigate: di.inject(navigateInjectable),
    currentPath: di.inject(currentPathInjectable),
    routeComponents: di.injectMany(routeSpecificComponentInjectionToken),
  }),
});
