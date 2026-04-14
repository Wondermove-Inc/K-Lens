/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: shadcn Hotbar 컴포넌트 (structure-hotbar-template 동기화)
 *
 * ✨ 특징:
 * - VS Code Activity Bar 스타일 (3rem 고정 폭)
 * - Explorer → Skuber+ Ecosystem 순서의 단일 아이콘 그룹
 * - 좌측 인디케이터, Badge, 이미지 아이콘, 텍스트 아이콘 지원
 * - 하단 Settings 푸터
 *
 * 🔄 변경이력:
 * - 2025-10-23: base template 적용
 * - 2025-10-24: structure-hotbar-template 1:1 반영
 */

import { CircleGauge, Files, Settings } from "lucide-react";
import React from "react";
import { cn } from "../../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./sidebar";

import type { SidebarCSSVars } from "./sidebar";

/**
 * 🎯 목적: Hotbar 아이템 타입 정의
 *
 * - Lucide 아이콘(icon), 이미지(imageUrl), 텍스트(text) 중 하나 이상 사용
 * - Badge 값/스타일 지정 가능
 */
export interface HotbarItem {
  id: string;
  icon?: React.ElementType;
  imageUrl?: string;
  text?: string;
  label: string;
  isActive?: boolean;
  badge?: string | number;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

/**
 * 🎯 목적: Hotbar 컴포넌트 Props
 */
interface HotbarProps {
  items?: HotbarItem[];
  footerItems?: HotbarItem[];
  activeItem?: string;
  onItemClick?: (itemId: string) => void;
  onSettingsClick?: () => void; // 🔄 추가: 설정 버튼 클릭 핸들러
  className?: string;
}

/**
 * 🎯 목적: 기본 메인 아이콘 목록 (Explorer → Skuber+)
 */
const defaultHotbarItems: HotbarItem[] = [
  {
    id: "explorer",
    icon: Files,
    label: "Explorer",
    isActive: true,
  },
  // 🔒 임시 비활성화: 추후 업데이트 예정
  // {
  //   id: "extensions",
  //   icon: Blocks,
  //   label: "Updated Soon Extensions",
  // },
  {
    id: "skuber-observability",
    icon: CircleGauge,
    label: "Skuber⁺ Observability",
  },
  // {
  //   id: "skuber-management",
  //   icon: FolderKanban,
  //   label: "Updated Soon Skuber+ Management",
  // },
  // {
  //   id: "skuber-optimization",
  //   icon: Server,
  //   label: "Updated Soon Skuber+ Optimization",
  // },
];

/**
 * 🎯 목적: 기본 푸터 아이콘 목록 (Settings)
 */
const defaultFooterItems: HotbarItem[] = [
  {
    id: "settings",
    icon: Settings,
    label: "Settings",
  },
];

/**
 * 🎯 목적: VS Code Activity Bar 스타일의 Hotbar 컴포넌트
 */
export function Hotbar({
  items = defaultHotbarItems,
  footerItems = defaultFooterItems,
  activeItem,
  onItemClick,
  onSettingsClick,
  className,
}: HotbarProps) {
  const getButtonStyle = React.useCallback(
    (): SidebarCSSVars => ({
      "--sidebar-line-offset": "0rem",
      paddingLeft: 0,
    }),
    [],
  );

  const shouldUseDefaultActive = React.useMemo(
    () => activeItem === undefined && !onItemClick,
    [activeItem, onItemClick],
  );

  return (
    <Sidebar
      collapsible="none"
      className={cn("bg-sidebar text-sidebar-foreground h-full border-r", className)}
      style={
        {
          "--sidebar-width": "3rem",
          "--sidebar-width-icon": "3rem",
        } as React.CSSProperties
      }
    >
      <SidebarContent className="flex w-12 flex-1 flex-col justify-between">
        {/* 🎯 상단 메인 아이콘 그룹 */}
        <div className="w-12">
          <SidebarGroup className="w-12 p-2">
            <SidebarGroupContent className="flex flex-col gap-2 px-0">
              <SidebarMenu className="w-8 gap-2">
                {items.map((item) => {
                  const isActive =
                    activeItem !== undefined
                      ? activeItem === item.id
                      : shouldUseDefaultActive && Boolean(item.isActive);
                  const buttonStyle = getButtonStyle();

                  return (
                    <SidebarMenuItem key={item.id} className="relative">
                      {isActive && (
                        <div className="bg-primary absolute top-1/2 -left-2 h-8 w-[2px] -translate-y-1/2 rounded-r-sm" />
                      )}

                      <SidebarMenuButton
                        tooltip={{
                          children: item.label,
                          hidden: false,
                        }}
                        onClick={() => onItemClick?.(item.id)}
                        isActive={isActive}
                        className={cn(
                          "h-8 w-8 items-center justify-center p-0 rounded-md",
                          !isActive && "!text-muted-foreground",
                        )}
                        size="sm"
                        style={buttonStyle}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.label} className="h-8 w-8" />
                        ) : item.icon ? (
                          <item.icon />
                        ) : item.text ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-xs font-semibold">
                            {item.text}
                          </Button>
                        ) : null}
                        <span className="sr-only">{item.label}</span>
                      </SidebarMenuButton>

                      {item.badge && (
                        <Badge
                          variant={item.badgeVariant || "destructive"}
                          className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] font-semibold leading-none"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* 🎯 하단 푸터 (User / Settings) */}
        <div className="flex w-12 flex-col items-center gap-2 p-2">
          {footerItems.map((item) => {
            const isActive = Boolean(item.isActive);

            const buttonStyle = getButtonStyle();

            return (
              <div key={item.id} className="relative">
                <SidebarMenuButton
                  tooltip={{
                    children: item.label,
                    hidden: false,
                  }}
                  onClick={() => {
                    if (item.id === "settings" && onSettingsClick) {
                      onSettingsClick();
                    } else {
                      onItemClick?.(item.id);
                    }
                  }}
                  isActive={isActive}
                  className={cn(
                    "h-8 w-8 items-center justify-center p-0 rounded-md",
                    !isActive && "!text-muted-foreground",
                  )}
                  size="sm"
                  style={buttonStyle}
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.label} className="h-6 w-6 object-contain" />
                  ) : item.icon ? (
                    <item.icon />
                  ) : null}
                  <span className="sr-only">{item.label}</span>
                </SidebarMenuButton>

                {item.badge && (
                  <Badge
                    variant={item.badgeVariant || "destructive"}
                    className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] font-semibold leading-none"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
