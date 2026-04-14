/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Droppable } from "@hello-pangea/dnd";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react-lite";
/**
 * 🎯 목적: 개별 에디터 그룹 뷰
 *
 * @description
 * - 그룹별 탭 헤더 렌더링
 * - 그룹별 활성 탭 콘텐츠 표시
 * - 포커스 이벤트 처리 (activeGroupId 변경)
 *
 * 📝 참고:
 * - VSCode EditorGroupView 패턴
 * - 드래그 앤 드롭은 그룹 내에서만 동작
 *
 * 🔄 변경이력: 2025-10-29 - Level 4 Split 기능 구현
 */
import React from "react";
import { cn } from "../../lib/utils";
import { MainTabHeader } from "./main-tab-header";
import mainTabStoreInjectable from "./main-tab-store.injectable";
import { MainTabToolbar } from "./main-tab-toolbar";

import type { EditorGroup } from "./main-tab.model";
import type { MainTabStore } from "./main-tab-store";

interface EditorGroupViewProps {
  /** 에디터 그룹 */
  group: EditorGroup;

  /** 이 그룹이 활성 그룹인지 여부 */
  isActive: boolean;

  /** 그룹의 활성 탭 컴포넌트 */
  children: React.ReactNode;
}

interface Dependencies {
  mainTabStore: MainTabStore;
}

const NonInjectedEditorGroupView = observer(
  ({ group, isActive, children, mainTabStore }: EditorGroupViewProps & Dependencies) => {
    const activeTabRef = React.useRef<HTMLDivElement>(null);

    React.useLayoutEffect(() => {
      if (!activeTabRef.current) {
        return;
      }

      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }, [group.activeTabId, group.tabs.length, isActive]);

    /**
     * 🎯 목적: 그룹 클릭 시 활성화
     */
    const handleGroupClick = () => {
      if (!isActive) {
        mainTabStore.activateGroup(group.id);
      }
    };

    return (
      <div
        className={cn("flex flex-col h-full", "border border-border/50", isActive && "border-primary/50")}
        onClick={handleGroupClick}
      >
        {/* 탭 헤더 영역 */}
        <Droppable droppableId={`group-${group.id}`} direction="horizontal">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "flex items-center border-b bg-muted/30 min-h-[32px] h-8",
                snapshot.isDraggingOver && "bg-primary/10",
              )}
            >
              <div
                className={cn(
                  "flex items-stretch overflow-x-auto overflow-y-hidden flex-1 pr-px h-full",
                  "[&::-webkit-scrollbar]:hidden",
                  "[-ms-overflow-style:none]",
                  "[scrollbar-width:none]",
                )}
              >
                {group.tabs.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-muted-foreground">No tabs</div>
                ) : (
                  group.tabs.map((tab, index) => {
                    const isTabActive = tab.id === group.activeTabId;

                    return (
                      <MainTabHeader
                        key={tab.id}
                        tab={tab}
                        index={index}
                        isActive={isTabActive}
                        activeTabRef={isTabActive ? activeTabRef : undefined}
                      />
                    );
                  })
                )}
                {provided.placeholder}
              </div>

              <MainTabToolbar
                className="border-l border-border/40 bg-muted/30"
                groupId={group.id}
                hasContent={group.tabs.length > 0}
              />
            </div>
          )}
        </Droppable>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">{children}</div>
      </div>
    );
  },
);

export const EditorGroupView = withInjectables<Dependencies, EditorGroupViewProps>(NonInjectedEditorGroupView, {
  getProps: (di, props) => ({
    ...props,
    mainTabStore: di.inject(mainTabStoreInjectable),
  }),
});
