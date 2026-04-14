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
import { ErrorBoundary } from "@skuberplus/error-boundary";
import { cssNames } from "@skuberplus/utilities";
import { ipcRenderer } from "electron";
import { debounce } from "lodash";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { panelSyncChannels, type SidebarWidthPayload } from "../../../common/ipc/panel-sync";
import { ResizeHandle } from "../resize/resize-handle";
import { SidebarProvider } from "../shadcn-ui/sidebar";
import sidebarStorageInjectable, { defaultSidebarWidth } from "./sidebar-storage/sidebar-storage.injectable";

import type { StrictReactNode } from "@skuberplus/utilities";

import type { StorageLayer } from "../../utils/storage-helper";
import type { SidebarStorageState } from "./sidebar-storage/sidebar-storage.injectable";

export interface MainLayoutProps {
  hotbar: StrictReactNode; // 🔄 추가: Hotbar 영역
  sidebar: StrictReactNode;
  className?: string;
  footer?: StrictReactNode;
  children?: StrictReactNode;
  hideHotbar?: boolean; // 🎯 추가: Hotbar 영역 숨기기 (Observability 등에서 사용)
  // topBar prop 제거 - ClusterManager로 이동
}

/**
 * Main layout is commonly used as a wrapper for "global pages"
 *
 * @link https://api-docs.k8slens.dev/master/extensions/capabilities/common-capabilities/#global-pages
 */

interface Dependencies {
  sidebarStorage: StorageLayer<SidebarStorageState>;
}

class NonInjectedMainLayout extends Component<MainLayoutProps & Dependencies> {
  /**
   * 🎯 목적: 사이드바 폭 변경 시 IPC로 Main Process에 전송 (debounced)
   * 📝 배경: Origin 격리로 인해 localStorage가 공유되지 않음
   * 📝 동작: 150ms debounce로 IPC 부하 최소화
   */
  private sendWidthToMain = debounce((width: number) => {
    const payload: SidebarWidthPayload = { width };
    ipcRenderer.send(panelSyncChannels.sidebarWidthChanged, payload);
  }, 150);

  onSidebarResize = (width: number) => {
    this.props.sidebarStorage.merge({ width });
    // 🎯 IPC로 Main Process에 폭 변경 알림 (다른 Frame들에 브로드캐스트)
    this.sendWidthToMain(width);
  };

  // 🔧 shadcn Sidebar의 position: fixed를 relative로 강제 변경
  componentDidMount() {
    this.fixSidebarPosition();
  }

  componentDidUpdate() {
    // ✅ setTimeout으로 다음 tick에 실행하여 React 렌더 사이클 외부로 이동
    // 🎯 목적: "Can't perform a React state update on a component that hasn't mounted yet" 경고 방지
    setTimeout(() => this.fixSidebarPosition(), 0);
  }

  fixSidebarPosition = () => {
    // shadcn Sidebar container를 찾아서 position을 relative로 강제 변경
    // 🔄 width 설정 제거: shadcn의 w-(--sidebar-width)를 사용하여 resizer 변경에 동적 반응
    const sidebarContainer = document.querySelector('[data-slot="sidebar-container"]') as HTMLElement;
    if (sidebarContainer) {
      sidebarContainer.style.setProperty("position", "relative", "important");
      sidebarContainer.style.setProperty("inset", "auto", "important");
      sidebarContainer.style.setProperty("top", "auto", "important");
      sidebarContainer.style.setProperty("left", "auto", "important");
      sidebarContainer.style.setProperty("right", "auto", "important");
      sidebarContainer.style.setProperty("bottom", "auto", "important");
      sidebarContainer.style.setProperty("height", "100%", "important");
      // sidebarContainer.style.setProperty("width", "100%", "important"); // 🔄 제거: shadcn의 w-(--sidebar-width) 사용
    }
  };

  render() {
    const { className, footer, children, sidebar, hotbar, hideHotbar = false } = this.props;
    const { width: sidebarWidth, isOpen } = this.props.sidebarStorage.get();

    // 🎯 sidebar={null}일 때는 2열 grid, 있을 때는 3열 grid
    const hasSidebar = Boolean(sidebar);

    // 🎯 Grid columns 동적 변경: hideHotbar, sidebar 존재 여부, 열림/닫힘 상태에 따라
    const gridTemplateColumns = hideHotbar
      ? hasSidebar
        ? isOpen
          ? "0px var(--sidebar-width) 1fr"
          : "0px 0px 1fr"
        : "0px 1fr"
      : hasSidebar
        ? isOpen
          ? "48px var(--sidebar-width) 1fr"
          : "48px 0px 1fr"
        : "48px 1fr";

    const gridTemplateAreas = hasSidebar
      ? `
        "hotbar sidebar contents"
        "hotbar sidebar footer"
      `
      : `
        "hotbar contents"
        "hotbar footer"
      `;

    const style = {
      "--sidebar-width": `${sidebarWidth}px`,
      // 🎯 Grid template areas - sidebar 존재 여부에 따라 동적 변경
      gridTemplateAreas,
    } as React.CSSProperties;

    // 🎯 목적: Grid 구조 복원 - 검증된 Grid 레이아웃 + Tailwind 색상
    return (
      <div className={cssNames("flex flex-col w-full min-h-0 z-[1]", className)} style={style}>
        <SidebarProvider
          open={isOpen}
          style={
            {
              "--sidebar-width": `${sidebarWidth}px`,
              height: "100%",
            } as React.CSSProperties
          }
        >
          {/* 🏗️ 메인 본문 레이아웃 (Grid 구조 - sidebar 유무에 따라 2열/3열 동적 변경) */}
          <div
            className="grid flex-1 min-h-0 w-full overflow-hidden"
            style={{
              gridTemplateColumns,
              gridTemplateRows: "1fr auto",
              gridTemplateAreas,
            }}
          >
            {/* 🎯 Hotbar 영역 */}
            <div className="relative z-10 overflow-hidden" style={{ gridArea: "hotbar" }}>
              {hotbar}
            </div>

            {/* 📁 Sidebar wrapper + Resizer */}
            {sidebar && (
              <div
                className="flex relative min-h-0 h-full"
                style={{ gridArea: "sidebar" }}
                data-panel-id="sidebar"
                tabIndex={-1}
              >
                <div className="flex-1 h-full overflow-hidden bg-sidebar flex">{sidebar}</div>
                {isOpen && (
                  <ResizeHandle
                    orientation="horizontal"
                    getCurrent={() => sidebarWidth}
                    min={150}
                    max={400}
                    onResize={this.onSidebarResize}
                    onDoubleClick={() => this.onSidebarResize(defaultSidebarWidth)}
                    thickness={8}
                  />
                )}
              </div>
            )}

            {/* 📋 메인 콘텐츠 영역 */}
            <div className="overflow-hidden" style={{ gridArea: "contents" }} data-panel-id="contents" tabIndex={-1}>
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>

            {/* 🦶 푸터 (터미널 Dock) — DAIVE 패널 열릴 때 같은 paddingRight 적용 */}
            {footer && (
              <div
                className="bg-background border-t border-border relative min-w-0 transition-[padding]"
                style={{ gridArea: "footer", paddingRight: "var(--ai-panel-width, 0px)" }}
                data-panel-id="dock"
                tabIndex={-1}
              >
                {footer}
              </div>
            )}
          </div>
        </SidebarProvider>
      </div>
    );
  }
}

export const MainLayout = withInjectables<Dependencies, MainLayoutProps>(observer(NonInjectedMainLayout), {
  getProps: (di, props) => ({
    ...props,
    sidebarStorage: di.inject(sidebarStorageInjectable),
  }),
});
