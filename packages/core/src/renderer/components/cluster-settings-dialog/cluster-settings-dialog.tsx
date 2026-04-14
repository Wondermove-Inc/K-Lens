/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 클러스터 설정 Dialog 모달 컴포넌트
 *
 * shadcn Dialog + Sidebar를 사용하여 클러스터 설정을 모달 형식으로 표시합니다.
 *
 * 📝 주의사항:
 * - Storybook templates/settings/cluster-settings 패턴 적용
 * - Dialog 크기: max-w-6xl, h-[85vh] (고정 크기)
 * - 3단 구조: 헤더(고정) + 사이드바(고정폭) + 콘텐츠(스크롤)
 * - 사이드바: SidebarProvider + Sidebar 컴포넌트 사용
 * - 콘텐츠: activeMenu 상태로 조건부 렌더링
 * - shadcn 디자인 토큰 사용 (테마 일관성)
 *
 * 🔄 변경이력:
 * - 2025-11-18: Storybook 패턴으로 완전히 재작성 (activeEntitySettingsTab → activeMenu useState)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@skuberplus/storybook-shadcn/src/components/ui/sidebar";
import React, { useState } from "react";
import catalogEntityRegistryInjectable from "../../api/catalog/entity/registry.injectable";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../shadcn-ui/breadcrumb";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../shadcn-ui/dialog";
// Content 컴포넌트 import
import { GeneralContent } from "./contents/general-content";
import { MetricsContent } from "./contents/metrics-content";
import { NamespaceContent } from "./contents/namespace-content";
import { NodeShellContent } from "./contents/node-shell-content";
import { ProxyContent } from "./contents/proxy-content";
import { TerminalContent } from "./contents/terminal-content";
import { clusterMenuData } from "./menu-data";

import type { CatalogEntity } from "../../api/catalog-entity";

/**
 * 🎯 목적: ClusterSettingsDialog Props 인터페이스
 */
export interface ClusterSettingsDialogProps {
  /**
   * Dialog 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * Dialog 상태 변경 핸들러
   */
  onOpenChange: (open: boolean) => void;

  /**
   * 설정을 표시할 클러스터 ID
   */
  clusterId?: string;
}

/**
 * 🎯 목적: ClusterSettingsDialog Dependencies 인터페이스
 */
interface Dependencies {
  /**
   * 카탈로그 엔티티 레지스트리
   */
  catalogEntityRegistry: {
    getById: (id: string) => CatalogEntity | undefined;
  };
}

/**
 * 🎯 목적: ClusterSettingsDialog 메인 컴포넌트
 *
 * shadcn Dialog를 사용하여 클러스터 설정 모달을 렌더링합니다.
 * 내부에서 ClusterSettingsContent를 사용하여 실제 설정 UI를 렌더링합니다.
 */
const NonInjectedClusterSettingsDialog = (props: ClusterSettingsDialogProps & Dependencies) => {
  const { isOpen, onOpenChange, clusterId, catalogEntityRegistry } = props;

  // 클러스터 엔티티 가져오기
  const entity = clusterId ? catalogEntityRegistry.getById(clusterId) : undefined;

  // 엔티티가 없으면 Dialog를 렌더링하지 않음
  if (!entity) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <ClusterSettingsContent entity={entity} />
    </Dialog>
  );
};

/**
 * 🎯 목적: DI 패턴 적용된 ClusterSettingsDialog export
 */
export const ClusterSettingsDialog = withInjectables<Dependencies, ClusterSettingsDialogProps>(
  NonInjectedClusterSettingsDialog,
  {
    getProps: (di, props) => ({
      ...props,
      catalogEntityRegistry: di.inject(catalogEntityRegistryInjectable),
    }),
  },
);

/**
 * 🎯 목적: ClusterSettingsContent Props 인터페이스
 */
interface ClusterSettingsContentProps {
  entity: CatalogEntity;
}

/**
 * 🎯 목적: ClusterSettingsContent 컴포넌트
 *
 * Dialog 내부의 실제 설정 UI를 렌더링합니다.
 *
 * 레이아웃 구조 (Storybook 패턴):
 * - DialogContent: 최외곽 컨테이너
 * - SidebarProvider: Sidebar 컨텍스트 제공
 *   - Sidebar: 좌측 메뉴 네비게이션
 *   - main: 우측 콘텐츠 영역
 *     - header: Breadcrumb 네비게이션
 *     - div: 스크롤 가능한 콘텐츠 (activeMenu에 따라 조건부 렌더링)
 */
function ClusterSettingsContent({ entity }: ClusterSettingsContentProps) {
  // 🎯 Storybook 패턴: activeMenu 상태로 메뉴 관리
  const [activeMenu, setActiveMenu] = useState("General");

  return (
    <DialogContent
      className="flex h-[85vh] max-h-[900px] max-w-[70%] flex-col overflow-hidden p-0 sm:h-[90vh] sm:max-w-[65%] lg:max-w-[60%] xl:max-w-[55%]"
      onOpenAutoFocus={(e) => {
        // 🎯 Dialog 열릴 때 자동 포커스 방지 (DropdownMenu와 충돌 방지)
        e.preventDefault();
      }}
      onCloseAutoFocus={(e) => {
        // 🎯 Dialog 닫을 때 pointer-events 복원
        e.preventDefault();
        // body에서 pointer-events: none 강제 제거
        setTimeout(() => {
          document.body.style.removeProperty("pointer-events");
        }, 0);
      }}
    >
      {/* Accessibility를 위한 숨김 제목 */}
      <DialogTitle className="sr-only">Cluster Settings</DialogTitle>
      <DialogDescription className="sr-only">Customize your cluster settings here.</DialogDescription>

      {/* ============================================ */}
      {/* 🎯 SidebarProvider: Sidebar + Content 레이아웃 */}
      {/* ============================================ */}
      <SidebarProvider className="items-start">
        {/* 📋 좌측 사이드바 네비게이션 */}
        <Sidebar collapsible="none" className="flex">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {clusterMenuData.nav.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton isActive={item.name === activeMenu} onClick={() => setActiveMenu(item.name)}>
                        <item.icon />
                        <span>{item.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* 📄 우측 메인 콘텐츠 영역 */}
        <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          {/* 헤더: Breadcrumb 네비게이션 */}
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">{entity.getName()}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{activeMenu}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>

          {/* 콘텐츠: activeMenu에 따라 조건부 렌더링 */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
            <div className="flex flex-col gap-6 p-4 pt-0">
              {activeMenu === "General" && <GeneralContent entity={entity} />}
              {activeMenu === "Proxy" && <ProxyContent entity={entity} />}
              {activeMenu === "Terminal" && <TerminalContent entity={entity} />}
              {activeMenu === "Namespace" && <NamespaceContent entity={entity} />}
              {activeMenu === "Metrics" && <MetricsContent entity={entity} />}
              {activeMenu === "Node Shell" && <NodeShellContent entity={entity} />}
            </div>
          </div>
        </main>
      </SidebarProvider>
    </DialogContent>
  );
}
