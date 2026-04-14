/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: DAIVE 클러스터 리소스 사이드바 아이템 컴포넌트 (shadcn 스타일)
 * 📝 변경: VSCode 스타일 → shadcn SidebarMenuSubItem/Button 구조
 * 🎨 스타일: shadcn Collapsible + ChevronRight 회전 애니메이션
 * 🔄 변경이력:
 * - 2025-10-22 - shadcn 스타일 기반 마이그레이션
 * - 2025-11-03 - compact 버튼 패딩 유지 + CSS 변수 기반 라인 정렬 도입
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ChevronRight } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../shadcn-ui/collapsible";
// 🎯 shadcn UI 컴포넌트 - 상대 경로 import
import { SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "../shadcn-ui/sidebar";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
// 🎯 DAIVE imports
import sidebarStorageInjectable from "./sidebar-storage/sidebar-storage.injectable";

import type { SidebarItemDeclaration } from "@skuberplus/cluster-sidebar";

import type { StorageLayer } from "../../utils/storage-helper";
import type { SidebarStorageState } from "./sidebar-storage/sidebar-storage.injectable";

// 🎯 DI Dependencies 인터페이스
interface Dependencies {
  sidebarStorage: StorageLayer<SidebarStorageState>;
}

// 🎯 Props 인터페이스
export interface SidebarItemProps {
  item: SidebarItemDeclaration;
  depth?: number;
  onEnsureClusterActive?: () => Promise<boolean> | boolean;
  clusterName?: string;
}

export type SidebarLineStyle = React.CSSProperties & {
  "--sidebar-line-offset"?: string;
  "--sidebar-padding-extra"?: string;
};

export const SIDEBAR_LINE_BASE_REM = 0.625; // 10px: Chevron 중심선
export const SIDEBAR_INDENT_STEP_REM = 1.5; // 24px: 하위 레벨 추가 들여쓰기
export const SIDEBAR_ICON_SLOT_REM = 1.0; // 16px: 아이콘 + gap 보정

export const createSidebarLineStyle = (offsetRem: number): SidebarLineStyle => ({
  "--sidebar-line-offset": `${offsetRem}rem`,
});

export const createSidebarButtonStyle = (offsetRem: number, reserveChevronSlot: boolean): SidebarLineStyle => ({
  ...createSidebarLineStyle(offsetRem),
  ...(reserveChevronSlot ? { "--sidebar-padding-extra": `${SIDEBAR_ICON_SLOT_REM}rem` } : {}),
});

/**
 * 🎯 목적: 리소스 항목 렌더링 (Pods, Deployments 등)
 *
 * @param item - 사이드바 리소스 항목 (SidebarItemDeclaration)
 * @param sidebarStorage - 접기/펼치기 상태 저장소
 *
 * 📝 구조:
 * - 접기 가능한 항목: Collapsible + ChevronRight 회전
 * - 리프 노드: SidebarMenuSubButton
 * - 계층 구조: SidebarMenuSub > SidebarMenuSubItem
 *
 * 🔄 변경이력: 2025-10-22 - shadcn UI 구조 적용
 */
const NonInjectedSidebarItem = observer((props: SidebarItemProps & Dependencies) => {
  const { item, sidebarStorage, depth = 0, onEnsureClusterActive, clusterName } = props;
  const id = item.id;
  const expanded = sidebarStorage.get().expanded[id] ?? false;
  const isExpandable = item.children.length > 0 && item.children.some((item) => item.isVisible.get());
  const isActive = item.isActive.get();
  const currentOffsetRem = SIDEBAR_LINE_BASE_REM + depth * SIDEBAR_INDENT_STEP_REM;
  const childOffsetRem = SIDEBAR_LINE_BASE_REM + (depth + 1) * SIDEBAR_INDENT_STEP_REM;
  const resourceLabel = typeof item.title === "string" ? item.title : item.id;
  const clusterLabel = clusterName ?? "클러스터";

  const runWithClusterEnsure = (action: () => void) => {
    if (!onEnsureClusterActive) {
      action();
      return;
    }

    Promise.resolve(onEnsureClusterActive())
      .then((shouldProceed) => {
        if (shouldProceed === false) {
          // 🎯 FIX-037: NotificationPanel으로 마이그레이션
          notificationPanelStore.addError(
            "cluster",
            "Cluster Inactive",
            `Cluster "${clusterLabel}" is not active. Cannot open "${resourceLabel}" item.`,
          );
          return;
        }
        action();
      })
      .catch((error) => {
        const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "";
        const message = detail
          ? `Error while activating cluster "${clusterLabel}": ${detail}`
          : `Error while activating cluster "${clusterLabel}".`;
        // 🎯 FIX-037: NotificationPanel으로 마이그레이션
        notificationPanelStore.addError("cluster", "Cluster Activation Error", message);
        console.error("[SIDEBAR] 클러스터 활성화 확인 중 오류", error);
      });
  };

  /**
   * 🎯 목적: 접기/펼치기 토글
   */
  const toggleExpand = () => {
    runWithClusterEnsure(() => {
      sidebarStorage.merge((draft) => {
        draft.expanded[id] = !draft.expanded[id];
      });
    });
  };

  // 🎯 보이지 않는 항목은 렌더링하지 않음
  if (!item.isVisible.get()) {
    return null;
  }

  // 🎯 접기 가능한 항목 (children이 있는 경우)
  if (isExpandable) {
    return (
      <SidebarMenuSubItem>
        <Collapsible
          open={expanded}
          onOpenChange={toggleExpand}
          className="group/collapsible [&[data-state=open]>*>svg:first-child]:rotate-90"
        >
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton
              data-testid={`link-for-${id}`}
              data-active={isActive}
              className="!border-b-0"
              style={createSidebarButtonStyle(currentOffsetRem, true)}
            >
              {/* ChevronRight (shadcn 표준 - 회전 애니메이션) */}
              <ChevronRight className="transition-transform" data-testid={`expand-icon-for-${id}`} />

              {/* 🎯 리소스 아이콘 (getIcon이 있는 경우에만 렌더링) */}
              {/* 📝 추가: lucide-react 아이콘 지원으로 메뉴 의미 시각화 */}
              {/* 🎨 색상: Muted 컬러로 Cluster 아이콘과 계층 구분 */}
              {item.getIcon && (
                <span className="shrink-0" style={{ color: "var(--muted-foreground)" }}>
                  {item.getIcon()}
                </span>
              )}

              {/* 🎯 리소스 이름 - flex-1 min-w-0로 truncate 활성화 */}
              {/* 📝 주의: sidebar 너비 변경 시 자동으로 truncate 반응 */}
              {/* 🎨 폰트: font-light로 더 얇은 폰트 적용 (클러스터 이름과 구분) */}
              <span className="flex-1 min-w-0 truncate font-light">{item.title}</span>
            </SidebarMenuSubButton>
          </CollapsibleTrigger>

          {/* 하위 항목들 */}
          <CollapsibleContent>
            <SidebarMenuSub style={createSidebarLineStyle(childOffsetRem)}>
              {item.children.map((child) => (
                <SidebarItem
                  key={child.id}
                  item={child}
                  depth={depth + 1}
                  onEnsureClusterActive={onEnsureClusterActive}
                  clusterName={clusterName}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuSubItem>
    );
  }

  // 🎯 리프 노드 (children이 없는 경우)
  return (
    <SidebarMenuSubItem data-testid={id}>
      <SidebarMenuSubButton
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          runWithClusterEnsure(() => {
            item.onClick();
          });
        }}
        data-testid={`link-for-${id}`}
        data-active={isActive}
        className="!border-b-0"
        style={createSidebarButtonStyle(currentOffsetRem, true)}
      >
        {/* 🎯 리소스 아이콘 (getIcon이 있는 경우에만 렌더링) */}
        {/* 📝 추가: lucide-react 아이콘 지원으로 메뉴 의미 시각화 */}
        {/* 🎨 색상: Muted 컬러로 Cluster 아이콘과 계층 구분 */}
        {item.getIcon && (
          <span className="shrink-0" style={{ color: "var(--muted-foreground)" }}>
            {item.getIcon()}
          </span>
        )}

        {/* 🎯 리소스 이름 - flex-1 min-w-0로 truncate 활성화 */}
        {/* 📝 주의: sidebar 너비 변경 시 자동으로 truncate 반응 */}
        {/* 🎨 폰트: font-light로 더 얇은 폰트 적용 (클러스터 이름과 구분) */}
        <span className="flex-1 min-w-0 truncate font-light">{item.title}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
});

// 🎯 DI 패턴 적용 (기존과 동일)
export const SidebarItem = withInjectables<Dependencies, SidebarItemProps>(NonInjectedSidebarItem, {
  getProps: (di, props) => ({
    ...props,
    sidebarStorage: di.inject(sidebarStorageInjectable),
  }),
});

SidebarItem.displayName = "SidebarItem";
