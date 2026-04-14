/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { SquareSplitHorizontal, SquareSplitVertical } from "lucide-react";
import { observer } from "mobx-react-lite";
import React from "react";
import { cn } from "../../lib/utils";
import mainTabStoreInjectable from "./main-tab-store.injectable";
import splitActionsInjectable from "./split-actions.injectable";

import type { EditorGroupId } from "./main-tab.model";
import type { MainTabStore } from "./main-tab-store";
import type { SplitActions } from "./split-actions.injectable";

export interface MainTabToolbarProps {
  /** 🎨 추가 클래스 */
  className?: string;

  /** 🆔 툴바가 속한 그룹 ID (Split 조건 판별용) */
  groupId?: EditorGroupId;

  /** 📦 콘텐츠 존재 여부 (탭이 있어야 아이콘 노출) */
  hasContent?: boolean;
}

interface Dependencies {
  mainTabStore: MainTabStore;
  splitActions: SplitActions;
}

const NonInjectedMainTabToolbar = observer(
  ({ className, groupId, hasContent, mainTabStore, splitActions }: MainTabToolbarProps & Dependencies) => {
    const contentAvailable = hasContent ?? true;
    const isSplitActive = mainTabStore.isSplitActive;
    const orientation = mainTabStore.splitLayout.orientation;

    const shouldRender = React.useMemo(() => {
      if (!contentAvailable) {
        return false;
      }

      // Split 미적용 시 항상 표시
      if (!isSplitActive) {
        return true;
      }

      // 그룹 정보가 없으면 렌더링하지 않음
      if (!groupId) {
        return false;
      }

      if (orientation === "horizontal") {
        // ↕️ 수직 분할 (좌/우) → 오른쪽 그룹만 아이콘 표시
        return groupId === "right";
      }

      if (orientation === "vertical") {
        // ↔️ 수평 분할 (상/하) → 상단(=left 그룹)만 아이콘 표시
        return groupId === "left";
      }

      return false;
    }, [contentAvailable, groupId, isSplitActive, orientation]);

    if (!shouldRender) {
      return null;
    }

    /**
     * 🎯 목적: Split Right 버튼 클릭 핸들러
     */
    const handleSplitRight = React.useCallback(() => {
      if (!isSplitActive) {
        splitActions.splitTabRight();
      }
    }, [isSplitActive, splitActions]);

    /**
     * 🎯 목적: Split Down 버튼 클릭 핸들러
     */
    const handleSplitDown = React.useCallback(() => {
      if (!isSplitActive) {
        splitActions.splitTabDown();
      }
    }, [isSplitActive, splitActions]);

    return (
      <div
        className={cn(
          "flex h-8 items-center gap-1 px-1 py-0.5",
          "text-muted-foreground",
          mainTabStore.isSplitActive && "opacity-80",
          className,
        )}
        style={{ color: "var(--sidebar-ring, var(--muted-foreground, rgba(161, 161, 161, 1)))" }}
      >
        <button
          type="button"
          onClick={handleSplitRight}
          className={cn(
            "rounded-sm p-1 transition-colors",
            mainTabStore.isSplitActive
              ? "cursor-not-allowed bg-transparent text-muted-foreground"
              : "cursor-pointer hover:bg-muted/60",
          )}
          aria-label="Split Right"
          title="Split Right (Cmd + \\)"
          disabled={mainTabStore.isSplitActive}
        >
          <SquareSplitHorizontal className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={handleSplitDown}
          className={cn(
            "rounded-sm p-1 transition-colors",
            mainTabStore.isSplitActive
              ? "cursor-not-allowed bg-transparent text-muted-foreground"
              : "cursor-pointer hover:bg-muted/60",
          )}
          aria-label="Split Down"
          title="Split Down (Cmd + K, Cmd + \\)"
          disabled={mainTabStore.isSplitActive}
        >
          <SquareSplitVertical className="h-4 w-4" />
        </button>
      </div>
    );
  },
);

export const MainTabToolbar = withInjectables<Dependencies, MainTabToolbarProps>(NonInjectedMainTabToolbar, {
  getProps: (di, props) => ({
    ...props,
    mainTabStore: di.inject(mainTabStoreInjectable),
    splitActions: di.inject(splitActionsInjectable),
  }),
});
