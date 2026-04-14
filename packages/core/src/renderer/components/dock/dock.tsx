/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./dock.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { ErrorBoundary } from "@skuberplus/error-boundary";
import { cssNames } from "@skuberplus/utilities";
import { ipcRenderer } from "electron";
import { computed, makeObservable, observable, reaction } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import activeKubernetesClusterInjectable from "../../cluster-frame-context/active-kubernetes-cluster.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { ResizeHandle } from "../resize/resize-handle";
import createResourceTabInjectable from "./create-resource/create-resource-tab.injectable";
import { CreateResource } from "./create-resource/view";
import { DEFAULT_DOCK_HEIGHT } from "./dock/dock-storage.injectable";
import { TabKind } from "./dock/store";
import dockStoreInjectable from "./dock/store.injectable";
import { DockTabs } from "./dock-tabs";
import { EditResource } from "./edit-resource/view";
import { InstallChart } from "./install-chart/view";
import { LogsDockTab } from "./logs/view";
import createTerminalTabInjectable from "./terminal/create-terminal-tab.injectable";
import terminalStoreInjectable from "./terminal/store.injectable";
import { TerminalSearchPopover } from "./terminal/terminal-search-popover";
import { TerminalWindow } from "./terminal/view";
import { UpgradeChart } from "./upgrade-chart/view";

import type { IComputedValue } from "mobx";

import type { KubernetesCluster } from "../../../common/catalog-entities";
import type { Cluster } from "../../../common/cluster/cluster";
import type { DockStore, DockTab } from "./dock/store";
import type { TerminalStore } from "./terminal/store";

export interface DockProps {
  className?: string;
}

interface Dependencies {
  createResourceTab: () => void;
  createTerminalTab: () => void;
  dockStore: DockStore;
  terminalStore: TerminalStore;
  activeKubernetesCluster: IComputedValue<KubernetesCluster | null>;
  hostedCluster: Cluster | undefined;
}

enum Direction {
  NEXT = 1,
  PREV = -1,
}

class NonInjectedDock extends Component<DockProps & Dependencies> {
  private readonly element = React.createRef<HTMLDivElement>();
  tokensPrefetched = false; // 🎯 MobX observable - 배치 토큰 생성 성공 플래그
  private disposeRetry?: () => void; // 🎯 MobX reaction cleanup 함수

  constructor(props: DockProps & Dependencies) {
    super(props);
    makeObservable(this, {
      activeTerminal: computed,
      tokensPrefetched: observable.ref,
    });
  }

  restoreDockToDefaultHeight = () => {
    const { dockStore } = this.props;
    const normalizedHeight = Math.min(Math.max(DEFAULT_DOCK_HEIGHT, dockStore.minHeight), dockStore.maxHeight);

    dockStore.fullSize = false;
    dockStore.height = normalizedHeight;
    dockStore.open();
  };

  /**
   * 🎯 목적: 모든 Terminal 탭의 인증 토큰을 배치로 미리 생성
   *
   * 📝 주의사항:
   * - Dock 마운트 시 한 번만 호출 (모든 Terminal 탭 토큰 동시 생성)
   * - Main Process IPC 호출 1회로 N개 토큰 병렬 생성 (~15ms)
   * - 생성된 토큰은 TerminalStore 캐시에 저장
   * - preFetchTerminalTokens() 완료 후 connectTerminal() 호출 보장
   * - hostedCluster 사용 (iframe context에서 항상 사용 가능)
   *
   * 🔄 변경이력:
   * - 2025-10-28 - 배치 토큰 생성으로 IPC 병목 해결
   * - 2025-10-28 - 토큰 생성 후 명시적 connect 호출 추가
   * - 2025-10-29 - hostedCluster 사용으로 타이밍 문제 해결
   */
  async preFetchTerminalTokens() {
    const terminalTabs = this.props.dockStore.tabs.filter((tab) => tab.kind === TabKind.TERMINAL);

    const { selectedTab } = this.props.dockStore;
    const activeTerminal = selectedTab ? this.props.terminalStore.getTerminal(selectedTab.id) : undefined;

    for (const tab of terminalTabs) {
      const terminal = this.props.terminalStore.getTerminal(tab.id);

      if (!terminal) {
        continue;
      }

      const fallbackSize = tab.id !== selectedTab?.id ? activeTerminal?.getLastKnownSize() : undefined;
      terminal.ensureSizeFallback(fallbackSize);
    }
    if (terminalTabs.length === 0) {
      return;
    }

    const tabsByCluster = new Map<string, DockTab[]>();

    for (const tab of terminalTabs) {
      const targetClusterId = tab.clusterId ?? this.props.hostedCluster?.id;

      if (!targetClusterId) {
        console.warn("[DOCK-PREFETCH] 클러스터 ID를 찾을 수 없어 토큰 프리페치 생략", { tabId: tab.id });
        continue;
      }

      const list = tabsByCluster.get(targetClusterId) ?? [];
      list.push(tab);
      tabsByCluster.set(targetClusterId, list);
    }

    if (tabsByCluster.size === 0) {
      return;
    }

    let prefetchedAny = false;

    for (const [clusterId, tabsForCluster] of tabsByCluster.entries()) {
      const success = await this.preFetchTokensForCluster(clusterId, tabsForCluster);
      prefetchedAny = prefetchedAny || success;
    }

    if (prefetchedAny) {
      this.tokensPrefetched = true;
    }
  }

  private async preFetchTokensForCluster(clusterId: string, tabs: DockTab[]) {
    if (tabs.length === 0) {
      return false;
    }

    try {
      await ipcRenderer.invoke("cluster:prewarm-kube-auth-proxy", clusterId);
    } catch (error) {
      console.error("[DOCK-PREFETCH] kube-auth-proxy 선기동 실패:", { clusterId, error });
    }

    const tabIds = tabs.map((tab) => tab.id);

    try {
      const tokenMap = await ipcRenderer.invoke("cluster:shell-api-batch", clusterId, tabIds);

      if (!tokenMap || Object.keys(tokenMap).length === 0) {
        console.warn("[DOCK-PREFETCH] 빈 토큰 맵 반환", { clusterId });
        return false;
      }

      for (const tabId of tabIds) {
        const tokenArray = tokenMap[tabId];
        if (tokenArray) {
          const token = new Uint8Array(tokenArray);
          this.props.terminalStore.setTokenCache(tabId, token);
        }
      }
      return true;
    } catch (error) {
      console.error("[DOCK-PREFETCH] 배치 토큰 생성 실패:", { clusterId, error });
      return false;
    }
  }

  /**
   * 🎯 목적: 클러스터 준비되면 백그라운드에서 배치 토큰 재생성
   *
   * 📝 주의사항:
   * - componentDidMount에서 클러스터가 없었을 경우에만 호출
   * - MobX reaction은 클러스터 준비 시 한 번만 실행 후 자동 dispose
   * - hostedCluster.ready.get() 직접 호출로 MobX tracking 보장
   * - tokensPrefetched observable 변경 시 자동 dispose
   * - componentWillUnmount에서 수동 dispose 필요
   *
   * 🔄 변경이력:
   * - 2025-10-28 - 백그라운드 재시도 로직 추가 (클러스터 타이밍 문제 해결)
   * - 2025-10-29 - MobX tracking 개선 (.get() 직접 호출, observable tokensPrefetched)
   */
  retryPrefetchInBackground() {
    this.disposeRetry = reaction(
      () => ({
        ready: this.props.hostedCluster?.ready?.get(), // 🎯 Direct .get() call for MobX tracking
        tokensPrefetched: this.tokensPrefetched, // 🎯 Observable tracked
      }),
      async ({ ready, tokensPrefetched }) => {
        // 🎯 tokensPrefetched가 false이고 cluster가 ready일 때만 실행
        if (!tokensPrefetched && ready) {
          await this.preFetchTerminalTokens();

          if (this.tokensPrefetched) {
            // 🎯 재시도 성공 시 모든 Terminal 재연결
            const terminalTabs = this.props.dockStore.tabs.filter((tab) => tab.kind === TabKind.TERMINAL);

            for (const tab of terminalTabs) {
              const api = this.props.terminalStore.getTerminalApi(tab.id);
              if (api) {
                // 🛡️ Await async destroy to avoid race conditions
                if (typeof api.destroy === "function") {
                  await Promise.resolve(api.destroy());
                }
              }
              this.props.terminalStore.connectTerminal(tab.id);
            }

            // 🎯 Dispose reaction - tokensPrefetched = true will prevent re-trigger
            if (this.disposeRetry) {
              this.disposeRetry();
              this.disposeRetry = undefined;
            }
          } else {
          }
        }
      },
      { delay: 100 }, // 🎯 100ms debounce
    );
  }

  async componentDidMount() {
    document.addEventListener("keydown", this.onKeyDown);

    // 1단계: 모든 Terminal 탭의 토큰을 배치로 미리 생성 (즉시 시도)
    await this.preFetchTerminalTokens();

    // 2단계: 모든 Terminal 연결 트리거 (캐시 or 개별 IPC fallback)
    const terminalTabs = this.props.dockStore.tabs.filter((tab) => tab.kind === TabKind.TERMINAL);

    for (const tab of terminalTabs) {
      this.props.terminalStore.connectTerminal(tab.id);
    }

    // 3단계: 백그라운드에서 재시도 (클러스터 없었다면)
    if (!this.tokensPrefetched) {
      this.retryPrefetchInBackground();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyDown);

    // 🎯 백그라운드 reaction 정리
    if (this.disposeRetry) {
      this.disposeRetry();
      this.disposeRetry = undefined;
    }
  }

  /**
   * 🎯 목적: 현재 활성 terminal instance 가져오기 (MobX computed)
   *
   * 📝 주의사항:
   * - terminalStore.terminals Map 변경 시 자동 재계산
   * - selectedTab 변경 시 자동 재계산
   * - null 반환 시 Popover 렌더링 안 됨
   */
  get activeTerminal() {
    const { selectedTab } = this.props.dockStore;

    if (selectedTab?.kind !== TabKind.TERMINAL) {
      return null;
    }

    const terminal = this.props.terminalStore.getTerminal(selectedTab.id);

    return terminal;
  }

  onKeyDown = (evt: KeyboardEvent) => {
    const { close, selectedTab, closeTab } = this.props.dockStore;
    const { code, ctrlKey, metaKey, shiftKey } = evt;

    // Determine if user working inside <Dock/> or using any other areas in app
    const dockIsFocused = this.element.current?.contains(document.activeElement);

    if (!selectedTab || !dockIsFocused) return;

    if (shiftKey && code === "Escape") {
      close();
    }

    if ((ctrlKey && code === "KeyW") || (metaKey && code === "KeyW")) {
      closeTab(selectedTab.id);
      this.element.current?.focus(); // Avoid loosing focus when closing tab
    }

    if (ctrlKey && code === "Period") {
      this.switchToNextTab(selectedTab, Direction.NEXT);
    }

    if (ctrlKey && code === "Comma") {
      this.switchToNextTab(selectedTab, Direction.PREV);
    }
  };

  /**
   * 🎯 목적: 탭 전환 시 Dock 열기, 탭 선택, 포커스 이동, Terminal 크기 재조정
   *
   * 📝 주의사항:
   * - Terminal 탭 전환 시 현재 활성 탭의 크기를 새 탭에 즉시 적용 (resize 지연 제거)
   * - 현재 활성 탭이 없거나 크기를 가져올 수 없는 경우만 비동기 resize
   *
   * 🔄 변경이력:
   * - 2025-10-28 - Terminal 탭 크기 재조정 로직 추가
   * - 2025-10-28 - 현재 탭 크기 즉시 복사 방식으로 개선 (resize 지연 제거)
   */
  onChangeTab = (tab: DockTab) => {
    const { open, selectTab } = this.props.dockStore;

    // 🎯 selectTab() 호출 전에 현재 활성 terminal 저장 (중요!)
    // selectTab() 후에 호출하면 이미 변경된 selectedTab 기준으로 가져오게 됨
    const currentTerminal = this.activeTerminal;

    open();
    selectTab(tab.id);
    this.element.current?.focus();

    // 🎯 Terminal 탭인 경우 크기 재조정
    if (tab.kind === TabKind.TERMINAL) {
      const newTerminal = this.props.terminalStore.getTerminal(tab.id);

      if (newTerminal && currentTerminal && currentTerminal !== newTerminal) {
        // ✅ 현재 활성 탭의 올바른 크기를 새 탭에 즉시 적용 (resize 지연 제거)
        // 모든 terminal은 동일한 Dock height을 공유하므로 크기가 동일해야 함
        newTerminal.resize(currentTerminal.cols, currentTerminal.rows);
      } else if (newTerminal) {
        // fallback: 현재 활성 탭이 없거나 크기를 가져올 수 없는 경우만 비동기 resize
        setTimeout(() => newTerminal.onResize(), 0);
      }
    }
  };

  switchToNextTab = (selectedTab: DockTab, direction: Direction) => {
    const { tabs } = this.props.dockStore;
    const currentIndex = tabs.indexOf(selectedTab);
    const nextIndex = currentIndex + direction;

    // check if moving to the next or previous tab is possible.
    if (nextIndex >= tabs.length || nextIndex < 0) return;

    const nextElement = tabs[nextIndex];

    this.onChangeTab(nextElement);
  };

  renderTab(tab: DockTab, isVisible: boolean) {
    switch (tab.kind) {
      case TabKind.CREATE_RESOURCE:
        return <CreateResource tabId={tab.id} />;
      case TabKind.EDIT_RESOURCE:
        return <EditResource tabId={tab.id} />;
      case TabKind.INSTALL_CHART:
        return <InstallChart tabId={tab.id} />;
      case TabKind.UPGRADE_CHART:
        return <UpgradeChart tab={tab} />;
      case TabKind.POD_LOGS:
        return <LogsDockTab tab={tab} isVisible={isVisible} />;
      case TabKind.TERMINAL:
        return <TerminalWindow tab={tab} />;
    }
  }

  /**
   * 🎯 목적: 모든 탭의 컴포넌트를 렌더링하여 각 탭의 componentDidMount 호출 보장
   *
   * 📝 주의사항:
   * - 선택되지 않은 탭은 display:none으로 숨김 (DOM에는 존재)
   * - 모든 TerminalWindow가 마운트되어야 terminal instance가 생성됨
   * - 탭 전환 시 컴포넌트 unmount/remount 없이 display만 변경
   *
   * 🔄 변경이력: 2025-10-28 - 선택된 탭만 렌더링하던 방식에서 모든 탭 렌더링으로 변경
   */
  renderTabContent() {
    const { isOpen, height, tabs, selectedTab } = this.props.dockStore;

    if (!isOpen) return null;

    return (
      <div className="tab-content-area" style={{ flexBasis: height }}>
        {tabs.map((tab) => {
          const isVisible = selectedTab?.id === tab.id;

          return (
            <div
              key={tab.id}
              className={`tab-content ${tab.kind}`}
              style={{
                visibility: isVisible ? "visible" : "hidden",
                pointerEvents: isVisible ? "auto" : "none",
              }}
              aria-hidden={!isVisible}
              data-testid={`dock-tab-content-for-${tab.id}`}
            >
              {this.renderTab(tab, isVisible)}
            </div>
          );
        })}
      </div>
    );
  }

  render() {
    const { className, dockStore } = this.props;
    const { isOpen, tabs, toggleFillSize, selectedTab, hasTabs, fullSize } = this.props.dockStore;
    const { activeTerminal } = this; // 🎯 MobX computed getter 사용

    return (
      <div className={cssNames("Dock", className, { isOpen, fullSize })} ref={this.element} tabIndex={-1}>
        {hasTabs() && (
          <ResizeHandle
            orientation="vertical"
            invertDelta
            getCurrent={() => dockStore.height}
            min={dockStore.minHeight}
            max={dockStore.maxHeight}
            onResizeStart={dockStore.open}
            onResize={(next) => {
              dockStore.height = next;
              if (next <= dockStore.minHeight) {
                dockStore.close();
              } else {
                dockStore.open();
              }
            }}
            thickness={8}
          />
        )}
        <div className="tabs-container flex align-center">
          {/* 🎯 DockTabs가 탭 목록 + 컨트롤 버튼(Plus, Separator, Expand, X)을 모두 포함 */}
          <DockTabs
            tabs={tabs}
            selectedTab={selectedTab}
            autoFocus={isOpen}
            isDockOpen={isOpen}
            onChangeTab={this.onChangeTab}
            closeTab={dockStore.closeTab}
            toggleFillSize={toggleFillSize}
            close={dockStore.close}
            onRestoreDefaultSize={this.restoreDockToDefaultHeight}
          />
          {activeTerminal && <TerminalSearchPopover terminal={activeTerminal} />}
        </div>
        <ErrorBoundary>{this.renderTabContent()}</ErrorBoundary>
      </div>
    );
  }
}

export const Dock = withInjectables<Dependencies, DockProps>(
  observer(NonInjectedDock),

  {
    getProps: (di, props) => ({
      createResourceTab: di.inject(createResourceTabInjectable),
      dockStore: di.inject(dockStoreInjectable),
      createTerminalTab: di.inject(createTerminalTabInjectable),
      terminalStore: di.inject(terminalStoreInjectable),
      activeKubernetesCluster: di.inject(activeKubernetesClusterInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
      ...props,
    }),
  },
);
